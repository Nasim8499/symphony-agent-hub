import { db, ensureSchema } from "@/db";
import { apiKeys } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";

export const BU_BASE = "https://api.browser-use.com/api";
export const DEEPSEEK_BASE = "https://api.deepseek.com";
export const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

export type Provider = "browser-use" | "deepseek" | "google" | "openrouter";

async function keyFor(provider: Provider) {
  await ensureSchema();
  const active = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.provider, provider), eq(apiKeys.isActive, true)))
    .orderBy(desc(apiKeys.createdAt))
    .limit(1);
  if (active[0]) return active[0];
  const any = await db.select().from(apiKeys).where(eq(apiKeys.provider, provider)).orderBy(desc(apiKeys.createdAt)).limit(1);
  return any[0] ?? null;
}

export async function getActiveKey(): Promise<{ key: string; id: number | null; name: string } | null> {
  const row = await keyFor("browser-use");
  if (row) return { key: row.key, id: row.id, name: row.name };
  if (process.env.BROWSER_USE_API_KEY) return { key: process.env.BROWSER_USE_API_KEY, id: null, name: "Environment" };
  return null;
}

export async function getDeepseekKey(): Promise<string | null> {
  const row = await keyFor("deepseek");
  if (row) return row.key;
  return process.env.DEEPSEEK_API_KEY ?? null;
}

export async function getOpenrouterKey(): Promise<string | null> {
  const row = await keyFor("openrouter");
  if (row) return row.key;
  return process.env.OPENROUTER_API_KEY ?? null;
}

export type AccountView = {
  name: string | null;
  totalCreditsBalanceUsd: number;
  monthlyCreditsBalanceUsd: number;
  additionalCreditsBalanceUsd: number;
  concurrentSessionLimit: number;
  activeSessionCount: number;
  isFreeTier: boolean;
  projectId: string;
  apiKeyId: string | null;
  planInfo?: Record<string, unknown>;
};

type VerifyResult = { ok: true; accountName: string | null; projectId: string | null; credits: number | null } | { ok: false; error: string; status: number };

function errText(text: string, status: number) {
  try {
    const j = JSON.parse(text);
    const d = j.detail ?? j.error?.message ?? j.error ?? j.message ?? j;
    return typeof d === "string" ? d : JSON.stringify(d);
  } catch {
    return text || `HTTP ${status}`;
  }
}

export async function verifyBrowserUseKey(key: string): Promise<VerifyResult> {
  try {
    const res = await fetch(`${BU_BASE}/v2/billing/account`, { headers: { "X-Browser-Use-API-Key": key }, cache: "no-store" });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: errText(text, res.status), status: res.status };
    const a = JSON.parse(text) as AccountView;
    return { ok: true, accountName: a.name, projectId: a.projectId, credits: a.totalCreditsBalanceUsd };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error", status: 502 };
  }
}

export async function verifyDeepseekKey(key: string): Promise<VerifyResult> {
  try {
    const res = await fetch(`${DEEPSEEK_BASE}/user/balance`, { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" }, cache: "no-store" });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: errText(text, res.status), status: res.status };
    const j = JSON.parse(text) as { is_available?: boolean; balance_infos?: { currency: string; total_balance: string }[] };
    const usd = j.balance_infos?.find((b) => b.currency === "USD") ?? j.balance_infos?.[0];
    return { ok: true, accountName: usd ? `DeepSeek (${usd.currency})` : "DeepSeek", projectId: null, credits: usd ? Number(usd.total_balance) : null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error", status: 502 };
  }
}

/** OpenRouter exposes the key's remaining credit via /credits. */
export async function verifyOpenrouterKey(key: string): Promise<VerifyResult> {
  try {
    const res = await fetch(`${OPENROUTER_BASE}/credits`, { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" }, cache: "no-store" });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: errText(text, res.status), status: res.status };
    const j = JSON.parse(text) as { data?: { total_credits?: number; total_usage?: number } };
    const remaining = typeof j.data?.total_credits === "number" ? (j.data.total_credits ?? 0) - (j.data.total_usage ?? 0) : null;
    return { ok: true, accountName: "OpenRouter", projectId: null, credits: remaining };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error", status: 502 };
  }
}

export function verifyKeyFor(provider: Provider, key: string) {
  if (provider === "deepseek") return verifyDeepseekKey(key);
  if (provider === "openrouter") return verifyOpenrouterKey(key);
  if (provider === "google") return Promise.resolve({ ok: true as const, accountName: "Google Workspace", projectId: null, credits: null });
  return verifyBrowserUseKey(key);
}

export function maskKey(key: string) {
  if (key.length <= 10) return "••••••••";
  return `${key.slice(0, 6)}••••••••${key.slice(-4)}`;
}

/** Server-side Browser Use request using the active key. */
export async function buFetch<T>(path: string, init?: { method?: string; body?: unknown; keyOverride?: string }): Promise<T> {
  const active = init?.keyOverride ? { key: init.keyOverride, id: null, name: "override" } : await getActiveKey();
  if (!active) throw new Error("No Browser Use API key configured. Add one in Settings → API Keys.");
  const res = await fetch(`${BU_BASE}/${path.replace(/^\//, "")}`, {
    method: init?.method ?? "GET",
    headers: { "X-Browser-Use-API-Key": active.key, "Content-Type": "application/json", Accept: "application/json" },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw Object.assign(new Error(errText(text, res.status)), { status: res.status, code: (() => { try { return JSON.parse(text).code; } catch { return undefined; } })() });
  return (text ? JSON.parse(text) : {}) as T;
}
