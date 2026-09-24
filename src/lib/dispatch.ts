import { db, ensureSchema } from "@/db";
import { automations, executions, type Automation, type BrowserSettingsJson } from "@/db/schema";
import { eq } from "drizzle-orm";
import { buFetch, DEEPSEEK_BASE, OPENROUTER_BASE, getDeepseekKey, getOpenrouterKey } from "./bu-server";
import { getSettings, type FallbackProvider } from "./settings";
import { rotateVaultKey } from "./vault";
import { planWithFallback, runMockFallback } from "./fallback";

export const DEEPSEEK_MODELS = ["deepseek-chat", "deepseek-reasoner"] as const;
export const DEFAULT_EXECUTOR = "gpt-5.6-luna";
export const isDeepseek = (m?: string | null) => Boolean(m && m.startsWith("deepseek-"));

const PLANNER_SYSTEM = `You are the planning brain for an autonomous cloud browser agent (Browser Use).
Turn the user's goal into a precise, executable browsing plan.
Rules:
- Output a numbered list of concrete steps (max 12). Name exact websites / official sources to visit.
- Prefer official government, embassy or company sources. Note what data to extract at each step.
- Include verification steps and a final "Deliverable" section describing the exact output format.
- Never instruct the agent to pay money, enter card details, or submit irreversible applications unless the goal explicitly authorises it; instead instruct it to stop and hand over to a human.
- Be concise. No preamble.`;

export async function planWithDeepseek(task: string, model: string): Promise<{ plan: string; reasoning: string | null }> {
  const key = await getDeepseekKey();
  if (!key) throw new Error("DeepSeek model selected but no DEEPSEEK_API_KEY is configured. Add it in Settings → API Keys.");
  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: PLANNER_SYSTEM },
        { role: "user", content: task },
      ],
      max_tokens: model === "deepseek-reasoner" ? 4000 : 1500,
      stream: false,
      ...(model === "deepseek-chat" ? { temperature: 0.3 } : {}),
    }),
    signal: AbortSignal.timeout(120_000),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try {
      msg = JSON.parse(text).error?.message ?? text;
    } catch {}
    throw new Error(`DeepSeek planning failed (${res.status}): ${msg}`);
  }
  const j = JSON.parse(text) as { choices: { message: { content: string; reasoning_content?: string } }[] };
  const m = j.choices?.[0]?.message;
  return { plan: (m?.content ?? "").trim(), reasoning: m?.reasoning_content ?? null };
}

/** Chat completion through OpenRouter — the free-tier planner used by Fallback Agent Mode. */
export async function planWithOpenrouter(task: string, model: string): Promise<{ plan: string; reasoning: string | null }> {
  const key = await getOpenrouterKey();
  if (!key) throw new Error("OpenRouter fallback selected but no OpenRouter key is configured. Add one in Settings → API Keys.");
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
      "X-Title": "Symphony Agent Hub",
    },
    body: JSON.stringify({
      model: model || "meta-llama/llama-3.3-70b-instruct:free",
      messages: [
        { role: "system", content: PLANNER_SYSTEM },
        { role: "user", content: task },
      ],
      max_tokens: 2000,
      stream: false,
    }),
    signal: AbortSignal.timeout(120_000),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try {
      msg = JSON.parse(text).error?.message ?? text;
    } catch {}
    throw new Error(`OpenRouter planning failed (${res.status}): ${msg}`);
  }
  const j = JSON.parse(text) as { choices: { message: { content: string; reasoning?: string } }[] };
  const m = j.choices?.[0]?.message;
  return { plan: (m?.content ?? "").trim(), reasoning: m?.reasoning ?? null };
}

export type DispatchInput = {
  task: string;
  model?: string;
  executorModel?: string | null;
  sessionId?: string | null;
  browserSettings?: BrowserSettingsJson | null;
  agentmail?: boolean;
  maxCostUsd?: number | null;
  automationId?: number | null;
  source?: string;
  label?: string | null;
  params?: Record<string, unknown> | null;
};

export type DispatchResult = {
  executionId: number;
  runId: string;
  sessionId: string;
  plan: string | null;
  plannerModel: string | null;
  executorModel: string;
  fallback?: boolean;
  fallbackProvider?: FallbackProvider;
};

async function driveBuless(
  body: Record<string, unknown>,
  opts: { allowRotation?: boolean } = {},
): Promise<{ id: string; sessionId: string; status: string }> {
  try {
    return await buFetch<{ id: string; sessionId: string; status: string }>("v4/runs", { method: "POST", body });
  } catch (e) {
    const err = e as { status?: number; message: string };
    const recoverable = err.status === 402 || err.status === 429 || err.status === 401 || /credit|balance|quota|insufficient|rate ?limit/i.test(err.message);
    const active = await rotateVaultKey();
    if (opts.allowRotation && recoverable && active) {
      return buFetch<{ id: string; sessionId: string; status: string }>("v4/runs", { method: "POST", body });
    }
    throw e;
  }
}

export async function dispatchRun(input: DispatchInput): Promise<DispatchResult> {
  await ensureSchema();
  const settings = await getSettings();
  const model = input.model || DEFAULT_EXECUTOR;
  let plan: string | null = null;
  let plannerModel: string | null = null;
  let executorModel = model;
  let finalTask = input.task;
  let fallbackProvider: FallbackProvider | undefined;

  if (isDeepseek(model)) {
    plannerModel = model;
    executorModel = input.executorModel && !isDeepseek(input.executorModel) ? input.executorModel : settings.deepseekExecutorModel || DEFAULT_EXECUTOR;
    const dsModel = model || settings.deepseekPlanningModel;
    plan = (await planWithDeepseek(input.task, dsModel)).plan;
    if (plan) finalTask = `${input.task}\n\n---\nExecution plan (drafted by ${dsModel}). Follow it, adapting if a site differs:\n${plan}`;
  }

  // When Google Workspace is connected, give the agent the same context the viewer has.
  const google = await workspaceContext(finalTask);

  const [row] = await db
    .insert(executions)
    .values({
      automationId: input.automationId ?? null,
      source: input.source ?? "manual",
      kind: "agent",
      label: input.label ?? input.task.slice(0, 80),
      task: input.task,
      params: input.params ?? null,
      plannerModel,
      plan,
      executorModel,
      status: "dispatching",
    })
    .returning();

  const enrichedTask = google ? `${finalTask}\n\n---\n${google}` : finalTask;
  if (google && !plan) plan = "Context supplied from the connected Google Workspace account.";
  const body: Record<string, unknown> = { task: enrichedTask, model: executorModel };
  if (input.sessionId) body.sessionId = input.sessionId;
  else {
    if (input.browserSettings) body.browserSettings = input.browserSettings;
    if (input.agentmail) body.agentmail = true;
    if (input.maxCostUsd && input.maxCostUsd > 0) body.maxCostUsd = input.maxCostUsd;
  }
  // ---- Free / Fallback Agent Mode: never stop the automation flow for a missing key ----
  if (settings.fallbackMode) {
    fallbackProvider = settings.fallbackProvider as FallbackProvider;
    let effectiveTask = finalTask;
    if (settings.fallbackProvider !== "mock" && !plan) {
      try {
        const p = await planWithFallback(settings, input.task);
        if (p?.plan) {
          plan = p.plan;
          plannerModel = p.plannerModel;
          effectiveTask = `${input.task}\n\n---\nFallback plan (drafted by ${p.plannerModel}):\n${p.plan}`;
        }
      } catch {
        // Fall through to the deterministic mock planner.
      }
    }
    const mock = runMockFallback({ task: input.task, label: input.label ?? input.task.slice(0, 80) });
    const runId = `fallback-${row.id}-${Date.now().toString(36)}`;
    const sessionId = input.sessionId ?? `session-fallback-${row.id}-${Date.now().toString(36)}`;
    await db
      .update(executions)
      .set({ runId, sessionId, status: "completed", plannerModel, plan, result: mock.result, executorModel: `${settings.fallbackProvider}:mock-executor`, costUsd: 0, updatedAt: new Date() })
      .where(eq(executions.id, row.id));
    return { executionId: row.id, runId, sessionId, plan, plannerModel, executorModel: `${settings.fallbackProvider}:mock-executor`, fallback: true, fallbackProvider };
  }

  try {
    const r = await driveBuless(body, { allowRotation: true });
    await db.update(executions).set({ runId: r.id, sessionId: r.sessionId, status: r.status, updatedAt: new Date() }).where(eq(executions.id, row.id));
    return { executionId: row.id, runId: r.id, sessionId: r.sessionId, plan, plannerModel, executorModel };
  } catch (e) {
    const msg = (e as Error).message;
    // A dead Browser Use key should still keep the flow alive when fallback is enabled later.
    await db.update(executions).set({ status: "failed", error: msg, updatedAt: new Date() }).where(eq(executions.id, row.id));
    throw e;
  }
}

export function renderTemplate(tpl: string, vars: Record<string, unknown>) {
  return tpl.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, k: string) => {
    const v = vars[k];
    return v === undefined || v === null || v === "" ? `(${k} not provided)` : String(v);
  });
}

type SkillResp = { success: boolean; result: unknown; error: string | null };

async function runSkillExecution(a: Automation, params: Record<string, unknown>, source: string) {
  const [row] = await db
    .insert(executions)
    .values({ automationId: a.id, source, kind: "skill", label: a.name, params, status: "running", task: `Skill ${a.skillId}` })
    .returning();
  // Fire-and-forget: skills run synchronously upstream and can take a while.
  void (async () => {
    try {
      const path = a.skillSource === "marketplace" ? `v2/marketplace/skills/${a.skillId}/execute` : `v2/skills/${a.skillId}/execute`;
      const r = await buFetch<SkillResp>(path, { method: "POST", body: { parameters: params } });
      await db
        .update(executions)
        .set({
          status: r.success ? "completed" : "failed",
          result: r.result == null ? null : typeof r.result === "string" ? r.result : JSON.stringify(r.result, null, 2),
          error: r.error,
          updatedAt: new Date(),
        })
        .where(eq(executions.id, row.id));
    } catch (e) {
      await db.update(executions).set({ status: "failed", error: (e as Error).message, updatedAt: new Date() }).where(eq(executions.id, row.id));
    }
  })();
  return row.id;
}

function coerce(v: string) {
  const t = v.trim();
  if (t === "true") return true;
  if (t === "false") return false;
  if (t !== "" && !Number.isNaN(Number(t)) && /^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
    try {
      return JSON.parse(t);
    } catch {}
  }
  return v;
}

export function computeNextRun(a: Pick<Automation, "scheduleType" | "intervalMinutes" | "runAt" | "dailyTime">, from = new Date()): Date | null {
  if (a.scheduleType === "interval" && a.intervalMinutes && a.intervalMinutes > 0) return new Date(from.getTime() + a.intervalMinutes * 60_000);
  if (a.scheduleType === "once") return a.runAt && a.runAt.getTime() > from.getTime() ? a.runAt : null;
  if (a.scheduleType === "daily" && a.dailyTime && /^\d{1,2}:\d{2}$/.test(a.dailyTime)) {
    const [h, m] = a.dailyTime.split(":").map(Number);
    const d = new Date(from);
    d.setUTCHours(h, m, 0, 0);
    if (d.getTime() <= from.getTime()) d.setUTCDate(d.getUTCDate() + 1);
    return d;
  }
  return null;
}

/** Run every batch row of an automation (or a single empty row). Returns per-row outcomes. */
export async function runAutomation(a: Automation, opts?: { rows?: Record<string, string>[]; trigger?: "manual" | "schedule" }) {
  await ensureSchema();
  const rows = (opts?.rows ?? (a.batch?.length ? a.batch : [{}])).slice(0, 50);
  const results: { ok: boolean; executionId?: number; sessionId?: string; error?: string }[] = [];

  for (const r of rows) {
    const params: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) params[k] = a.kind === "skill" ? coerce(String(v ?? "")) : v;
    try {
      if (a.kind === "skill") {
        if (!a.skillId) throw new Error("No skill selected");
        const id = await runSkillExecution(a, params, a.source);
        results.push({ ok: true, executionId: id });
      } else {
        const task = renderTemplate(a.template ?? "", r);
        const label = Object.values(r).filter(Boolean).length ? `${a.name} · ${Object.values(r).filter(Boolean).slice(0, 2).join(" / ")}` : a.name;
        const d = await dispatchRun({
          task,
          model: a.model,
          executorModel: a.executorModel,
          browserSettings: a.browserSettings,
          agentmail: a.agentmail,
          automationId: a.id,
          source: a.source,
          label,
          params,
        });
        results.push({ ok: true, executionId: d.executionId, sessionId: d.sessionId });
      }
    } catch (e) {
      results.push({ ok: false, error: (e as Error).message });
    }
  }

  const now = new Date();
  const next = computeNextRun(a, now);
  await db
    .update(automations)
    .set({
      lastRunAt: now,
      runCount: a.runCount + 1,
      nextRunAt: next,
      ...(a.scheduleType === "once" && opts?.trigger === "schedule" ? { enabled: false } : {}),
    })
    .where(eq(automations.id, a.id));

  return results;
}

/** Attaches a short snapshot of the connected Google Workspace so agents can act on real files. */
async function workspaceContext(task: string): Promise<string | null> {
  const mentionsGoogle = /\b(google|drive|docs?|sheet|gmail|workspace|folder|spreadsheet|document)\b/i.test(task);
  if (!mentionsGoogle) return null;
  try {
    const { googleStatus, driveSearch } = await import("./google");
    const status = await googleStatus();
    if (!status.connected) {
      return "Google Workspace context: not connected on this dashboard, so no Drive results could be attached. Continue with public sources or ask the operator to connect Google Workspace.";
    }
    const keywords = task
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !["google", "drive", "workspace", "document", "spreadsheet", "folder", "sheet", "docs"].includes(w));
    const query = keywords.slice(0, 3).join(" ");
    const files = query ? await driveSearch(query, 8) : [];
    if (!files.length) {
      return `Google Workspace context: connected as ${status.email ?? "the operator's account"}, but no matching Drive files were found for "${query}".`;
    }
    const rows = files.map((f) => `- ${f.name} (${f.mimeType}) — ${f.webViewLink ?? "no link"}, modified ${f.modifiedTime ?? "unknown"}, owner ${f.owners[0] ?? "unknown"}`).join("\n");
    return `Google Workspace context (connected as ${status.email ?? "operator"}). Candidate Drive files:\n${rows}\nUse these files where relevant; the operator can preview any of them in the dashboard viewer.`;
  } catch {
    return null;
  }
}
