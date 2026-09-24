import type { AppSettings, FallbackProvider } from "./settings";
import { planWithOpenrouter } from "./dispatch";

export type { FallbackProvider };

export type FallbackPlan = { plan: string; plannerModel: string; provider: FallbackProvider } | null;

/** Local Ollama planner — no API key, no network egress beyond localhost. */
async function planWithOllama(baseUrl: string, model: string, task: string): Promise<FallbackPlan> {
  const url = `${(baseUrl || "http://127.0.0.1:11434").replace(/\/$/, "")}/api/chat`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model || "llama3.1",
      stream: false,
      messages: [
        { role: "system", content: "You turn a browsing goal into a short numbered plan of concrete web steps (max 10), naming official sources. No preamble." },
        { role: "user", content: task },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Ollama responded ${res.status}`);
  const j = (await res.json()) as { message?: { content?: string } };
  const plan = (j.message?.content ?? "").trim();
  return plan ? { plan, plannerModel: `ollama:${model || "llama3.1"}`, provider: "ollama" } : null;
}

/**
 * Resolves a planner for Fallback Agent Mode.
 * Tries the configured provider, returning null when it is the deterministic mock.
 */
export async function planWithFallback(settings: AppSettings, task: string): Promise<FallbackPlan> {
  if (settings.fallbackProvider === "openrouter") {
    const r = await planWithOpenrouter(task, settings.openrouterModel);
    return r.plan ? { plan: r.plan, plannerModel: `openrouter:${settings.openrouterModel}`, provider: "openrouter" } : null;
  }
  if (settings.fallbackProvider === "ollama") {
    return planWithOllama(settings.ollamaBaseUrl, settings.ollamaModel, task);
  }
  return null;
}

/**
 * Deterministic offline executor. Used when Fallback Agent Mode is on and no
 * network planner/key is available, so scheduled automations never stop flowing.
 */
export function runMockFallback(input: { task: string; label?: string | null }): { result: string; plan: string } {
  const now = new Date().toISOString();
  const plan = [
    "1. Parse the request and extract the target site plus the fields to collect.",
    "2. Resolve the official source for the request (government / registry / airline).",
    "3. Open the page and read the requested values.",
    "4. Verify the values against a second official source where available.",
    "5. Format the deliverable and hand it back to the operator.",
  ].join("\n");
  const result = [
    `Fallback agent run (offline mode) — ${now}`,
    "",
    `Task: ${input.task}`,
    input.label && input.label !== input.task ? `Label: ${input.label}` : "",
    "",
    "Status: completed without a Browser Use executor.",
    "No live browser was launched, so no upstream credits were spent.",
    "",
    "Why you are seeing this:",
    "  • Free / Fallback Agent Mode is ON, and no usable Browser Use key or network planner was configured.",
    "  • Add a Browser Use API key (Settings → API Keys) or turn the mode off to run this task on a real cloud browser.",
    "",
    "Generated plan:",
    plan,
  ]
    .filter((l) => l !== "")
    .join("\n");
  return { result, plan };
}

export function fallbackLabel(p: FallbackProvider) {
  return p === "openrouter" ? "OpenRouter" : p === "ollama" ? "Local Ollama" : "Mock";
}
