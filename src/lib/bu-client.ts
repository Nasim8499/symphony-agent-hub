"use client";

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function formatDetail(detail: unknown): string {
  if (!detail) return "";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => (typeof d === "object" && d && "msg" in d ? `${(d as { loc?: unknown[] }).loc?.slice(1).join(".") ?? ""} ${(d as { msg: string }).msg}` : JSON.stringify(d)))
      .join("; ");
  }
  if (typeof detail === "object" && detail && "message" in detail) return String((detail as { message: unknown }).message);
  return JSON.stringify(detail);
}

export async function bu<T = unknown>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`/api/bu/${path.replace(/^\//, "")}`, {
    method: init?.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok) {
    const j = json as { detail?: unknown; code?: string } | null;
    throw new ApiError(formatDetail(j?.detail) || `Request failed (${res.status})`, res.status, j?.code);
  }
  return json as T;
}

export type RunStatus = "queued" | "dispatching" | "running" | "completed" | "failed" | "cancelled";
export const TERMINAL: RunStatus[] = ["completed", "failed", "cancelled"];

export type RunSummary = {
  id: string;
  task: string;
  title: string | null;
  model: string;
  status: RunStatus;
  result: string | null;
  error: string | null;
  sessionId: string;
  workspaceId: string | null;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: string;
  createdAt: string;
  updatedAt: string;
};

export type RunEvent = { runId: string; id: number; ts: string; type: string; data: Record<string, unknown> };
export type RunEventsResponse = { events: RunEvent[]; nextAfter: number | null; hasMore: boolean };

export type SessionInfo = {
  sessionId: string;
  workspaceId: string | null;
  latestRunId: string;
  task: string;
  title: string | null;
  status: RunStatus;
  createdAt: string;
  updatedAt: string;
};

export type BrowserSession = {
  id: string;
  status: "active" | "stopped";
  liveUrl: string | null;
  cdpUrl: string | null;
  timeoutAt: string;
  startedAt: string;
  finishedAt: string | null;
  proxyUsedMb: string;
  proxyCost: string;
  browserCost: string;
  agentSessionId: string | null;
  recordingUrl: string | null;
  recordingAvailable?: boolean;
};

export type Profile = {
  id: string;
  userId: string | null;
  name: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
  cookieDomains: string[] | null;
};

export type SkillParam = {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array" | "cookie";
  required: boolean;
  description: string | null;
  default?: unknown;
  cookieDomain?: string | null;
};

export type Skill = {
  id: string;
  slug: string | null;
  title: string;
  description: string;
  categories: string[];
  domains: string[];
  parameters: SkillParam[];
  outputSchema: Record<string, unknown>;
  isEnabled?: boolean;
  isPublic?: boolean;
  isOfficial?: boolean;
  cloneCount?: number;
  iconUrl: string | null;
  status?: string;
  createdAt: string;
};

export type Paged<T> = { items: T[]; totalItems: number; pageNumber: number; pageSize: number };

export type ExecuteSkillResponse = {
  success: boolean;
  result: unknown;
  error: string | null;
  stderr: string | null;
  latencyMs: number | null;
};

export type Account = {
  name: string | null;
  totalCreditsBalanceUsd: number;
  monthlyCreditsBalanceUsd: number;
  additionalCreditsBalanceUsd: number;
  concurrentSessionLimit: number;
  activeSessionCount: number;
  isFreeTier: boolean;
  projectId: string;
  apiKeyId: string | null;
  planInfo?: { planName?: string; subscriptionStatus?: string | null } & Record<string, unknown>;
};

export type ModelOption = { id: string; label: string; provider: string; note?: string; group: "executor" | "planner" };

export type VaultHealth = "unknown" | "healthy" | "low" | "invalid";

export type VaultKey = {
  id: number;
  provider: string;
  name: string;
  folder: string;
  masked: string;
  isActive: boolean;
  accountName: string | null;
  projectId: string | null;
  creditsUsd: number | null;
  health: VaultHealth;
  lastVerifiedAt: string | null;
  createdAt: string;
};

export type VaultResponse = {
  keys: VaultKey[];
  folders: { name: string; keys: VaultKey[] }[];
  activeId: number | null;
  count: number;
  max: number;
  provider: string;
  settings: AppSettingsView;
};

export type AppSettingsView = {
  fallbackMode: boolean;
  fallbackProvider: "mock" | "ollama" | "openrouter";
  openrouterModel: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
  deepseekPlanningModel: string;
  deepseekExecutorModel: string;
  googleClientId: string | null;
  hasGoogleClientSecret: boolean;
  googleConnected: boolean;
  googleAccountEmail: string | null;
  googleConnectedAt: string | null;
};

export type GoogleFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string | null;
  size: string | null;
  webViewLink: string | null;
  iconLink: string | null;
  owners: string[];
};

export type GoogleStatus = {
  configured: boolean;
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
  scopes: string[];
  previewCapable: boolean;
};

export type WorkspaceArtifact = {
  id: string | number;
  name: string;
  kind: "text" | "pdf" | "image" | "doc" | "sheet" | "slides" | "other";
  url?: string | null;
  content?: string;
  status?: string;
  createdAt?: string;
  source?: "google" | "task";
  sessionId?: string | null;
  runId?: string | null;
};

export const DEEPSEEK_MODELS: ModelOption[] = [
  { id: "deepseek-chat", label: "DeepSeek-V3", provider: "DeepSeek", note: "deepseek-chat · planner", group: "planner" },
  { id: "deepseek-reasoner", label: "DeepSeek-R1", provider: "DeepSeek", note: "deepseek-reasoner · deep planning", group: "planner" },
];

export const isDeepseekModel = (id?: string | null) => Boolean(id && id.startsWith("deepseek-"));

export type Execution = {
  id: number;
  automationId: number | null;
  source: string;
  kind: "agent" | "skill";
  label: string | null;
  task: string | null;
  params: Record<string, unknown> | null;
  runId: string | null;
  sessionId: string | null;
  plannerModel: string | null;
  plan: string | null;
  executorModel: string | null;
  status: string;
  result: string | null;
  error: string | null;
  costUsd: number | null;
  createdAt: string;
  updatedAt: string;
};

export type Automation = {
  id: number;
  name: string;
  description: string | null;
  kind: "agent" | "skill";
  source: string;
  workflow: string | null;
  template: string | null;
  skillId: string | null;
  skillSource: string | null;
  paramKeys: string[];
  batch: Record<string, string>[];
  model: string;
  executorModel: string | null;
  browserSettings: { proxyCountryCode?: string | null; profileId?: string | null; record?: boolean } | null;
  agentmail: boolean;
  scheduleType: "manual" | "once" | "interval" | "daily";
  intervalMinutes: number | null;
  runAt: string | null;
  dailyTime: string | null;
  enabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  runCount: number;
  createdAt: string;
};

export type DispatchResponse = { executionId: number; runId: string; sessionId: string; plan: string | null; plannerModel: string | null; executorModel: string };

/** Local JSON API helper (non-proxy routes). */
export async function api<T = unknown>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}
  if (!res.ok) {
    const msg = (json?.detail as string) || (json?.error as string) || `Request failed (${res.status})`;
    throw new ApiError(typeof msg === "string" ? msg : JSON.stringify(msg), res.status, json?.code as string | undefined);
  }
  return json as T;
}

export function dispatchAgent(body: Record<string, unknown>) {
  return api<DispatchResponse>("/api/agent/run", { method: "POST", body });
}

export function scheduleLabel(a: Pick<Automation, "scheduleType" | "intervalMinutes" | "dailyTime" | "runAt">) {
  if (a.scheduleType === "interval") {
    const m = a.intervalMinutes ?? 0;
    return m % 1440 === 0 ? `Every ${m / 1440}d` : m % 60 === 0 ? `Every ${m / 60}h` : `Every ${m}m`;
  }
  if (a.scheduleType === "daily") return `Daily ${a.dailyTime} UTC`;
  if (a.scheduleType === "once") return a.runAt ? `Once · ${new Date(a.runAt).toLocaleString()}` : "Once";
  return "Manual";
}

export function timeUntil(iso: string | null | undefined) {
  if (!iso) return "";
  const s = Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
  if (s <= 0) return "due now";
  if (s < 60) return `in ${s}s`;
  if (s < 3600) return `in ${Math.floor(s / 60)}m`;
  if (s < 86400) return `in ${Math.floor(s / 3600)}h`;
  return `in ${Math.floor(s / 86400)}d`;
}

export const MODELS: ModelOption[] = [
  { id: "gpt-5.6-luna", label: "GPT-5.6 Luna", provider: "OpenAI", note: "Recommended", group: "executor" },
  { id: "claude-opus-5", label: "Claude Opus 5", provider: "Anthropic", note: "Most capable", group: "executor" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5", provider: "Anthropic", group: "executor" },
  { id: "gpt-5.6-sol", label: "GPT-5.6 Sol", provider: "OpenAI", group: "executor" },
  { id: "gpt-6-astra", label: "GPT-6 Astra", provider: "OpenAI", group: "executor" },
  { id: "grok-4.5", label: "Grok 4.5", provider: "xAI", note: "Fast", group: "executor" },
  { id: "gemini-3.1-pro", label: "Gemini 3.1 Pro", provider: "Google", group: "executor" },
  { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash", provider: "Google", note: "Fast", group: "executor" },
  { id: "minimax-m3", label: "MiniMax M3", provider: "MiniMax", note: "Cheap", group: "executor" },
  { id: "kimi-k3", label: "Kimi K3", provider: "Moonshot", group: "executor" },
  { id: "glm-5.2", label: "GLM 5.2", provider: "Zhipu", group: "executor" },
];

export const COUNTRIES: { code: string; label: string; flag: string }[] = [
  { code: "us", label: "United States", flag: "🇺🇸" },
  { code: "uk", label: "United Kingdom", flag: "🇬🇧" },
  { code: "de", label: "Germany", flag: "🇩🇪" },
  { code: "fr", label: "France", flag: "🇫🇷" },
  { code: "ca", label: "Canada", flag: "🇨🇦" },
  { code: "in", label: "India", flag: "🇮🇳" },
  { code: "jp", label: "Japan", flag: "🇯🇵" },
  { code: "au", label: "Australia", flag: "🇦🇺" },
  { code: "br", label: "Brazil", flag: "🇧🇷" },
  { code: "nl", label: "Netherlands", flag: "🇳🇱" },
  { code: "sg", label: "Singapore", flag: "🇸🇬" },
  { code: "es", label: "Spain", flag: "🇪🇸" },
  { code: "it", label: "Italy", flag: "🇮🇹" },
  { code: "mx", label: "Mexico", flag: "🇲🇽" },
  { code: "kr", label: "South Korea", flag: "🇰🇷" },
];

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  const s = Math.max(0, Math.floor((Date.now() - d) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export const ALL_MODELS: ModelOption[] = [...MODELS, ...DEEPSEEK_MODELS];

export function modelLabel(id: string) {
  return ALL_MODELS.find((m) => m.id === id)?.label ?? id;
}

/* ---------------- Vault / fallback / Google helpers ---------------- */

export async function loadVault(provider: "browser-use" | "deepseek" | "openrouter" = "browser-use") {
  return api<VaultResponse>(`/api/vault?provider=${provider}`);
}

export async function saveVaultKey(body: { name?: string; key: string; provider?: string; folder?: string; skipVerify?: boolean; activate?: boolean }) {
  return api<{ key: VaultKey; id: number; name: string; masked: string }>("/api/vault", { method: "POST", body });
}

export async function updateVaultKey(id: number, body: { action?: string; name?: string; folder?: string }) {
  return api<{ ok: boolean; key?: VaultKey }>(`/api/vault/${id}`, { method: "PATCH", body });
}

export async function removeVaultKey(id: number) {
  return api<{ ok: boolean }>(`/api/vault/${id}`, { method: "DELETE" });
}

export function healthTone(h: VaultHealth) {
  return h === "healthy"
    ? { cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", label: "Healthy" }
    : h === "low"
      ? { cls: "border-amber-500/30 bg-amber-500/10 text-amber-300", label: "Low balance" }
      : h === "invalid"
        ? { cls: "border-red-500/30 bg-red-500/10 text-red-300", label: "Exhausted" }
        : { cls: "border-white/10 bg-white/5 text-neutral-400", label: "Unverified" };
}

export function isViewableMime(mime: string) {
  return mime === "application/pdf" || mime.startsWith("image/") || mime.startsWith("text/") || mime.startsWith("application/vnd.google-apps");
}

export function fileKind(mime: string): WorkspaceArtifact["kind"] {
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.includes("spreadsheet")) return "sheet";
  if (mime.includes("presentation")) return "slides";
  if (mime.includes("document") || mime.startsWith("text/")) return "doc";
  return "other";
}

export function prettySize(bytes: string | null | undefined) {
  const n = Number(bytes);
  if (!bytes || Number.isNaN(n) || n <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}
