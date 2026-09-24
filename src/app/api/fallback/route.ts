import { getSettings, publicSettings, updateSettings } from "@/lib/settings";
import { OPENROUTER_BASE, getOpenrouterKey, getDeepseekKey } from "@/lib/bu-server";
import type { FallbackProvider } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSettings();
  const [openrouter, deepseek] = await Promise.all([getOpenrouterKey(), getDeepseekKey()]);
  return Response.json({
    settings: publicSettings(s),
    providers: {
      openrouter: Boolean(openrouter),
      deepseek: Boolean(deepseek),
      ollama: false,
    },
  });
}

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};

  if (typeof body.fallbackMode === "boolean") patch.fallbackMode = body.fallbackMode;
  if (typeof body.fallbackProvider === "string" && ["mock", "ollama", "openrouter"].includes(body.fallbackProvider)) {
    patch.fallbackProvider = body.fallbackProvider as FallbackProvider;
  }
  if (typeof body.openrouterModel === "string" && body.openrouterModel.trim()) patch.openrouterModel = body.openrouterModel.trim();
  if (typeof body.ollamaBaseUrl === "string") patch.ollamaBaseUrl = body.ollamaBaseUrl.trim() || "http://127.0.0.1:11434";
  if (typeof body.ollamaModel === "string") patch.ollamaModel = body.ollamaModel.trim() || "llama3.1";
  if (typeof body.deepseekPlanningModel === "string" && body.deepseekPlanningModel.trim()) patch.deepseekPlanningModel = body.deepseekPlanningModel.trim();
  if (typeof body.deepseekExecutorModel === "string" && body.deepseekExecutorModel.trim()) patch.deepseekExecutorModel = body.deepseekExecutorModel.trim();

  const s = await updateSettings(patch);
  return Response.json({ settings: publicSettings(s) });
}

/** Connectivity probe for the configured fallback provider. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { provider?: FallbackProvider; model?: string };
  const s = await getSettings();
  const provider = body.provider ?? (s.fallbackProvider as FallbackProvider);
  const model = body.model || s.ollamaModel;

  if (provider === "mock") {
    return Response.json({ ok: true, detail: "Mock executor ready — runs offline with no external calls." });
  }

  if (provider === "openrouter") {
    const key = await getOpenrouterKey();
    if (!key) return Response.json({ ok: false, detail: "No OpenRouter key configured." }, { status: 400 });
    try {
      const res = await fetch(`${OPENROUTER_BASE}/models`, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
      return Response.json(res.ok ? { ok: true, detail: "OpenRouter reachable." } : { ok: false, detail: `OpenRouter responded ${res.status}.` }, { status: res.ok ? 200 : 400 });
    } catch (e) {
      return Response.json({ ok: false, detail: (e as Error).message }, { status: 400 });
    }
  }

  // Ollama runs on the operator's machine; probe its /api/tags from the server or browser.
  try {
    const base = (s.ollamaBaseUrl || "http://127.0.0.1:11434").replace(/\/$/, "");
    const res = await fetch(`${base}/api/tags`, { cache: "no-store", signal: AbortSignal.timeout(6_000) });
    if (!res.ok) return Response.json({ ok: false, detail: `Ollama responded ${res.status}. Is it running on ${base}?` }, { status: 400 });
    const j = (await res.json()) as { models?: { name: string }[] };
    const names = (j.models ?? []).map((m) => m.name);
    const has = names.some((n) => n.startsWith(model));
    return Response.json({ ok: true, detail: has ? `Ollama is running; "${model}" is available.` : `Ollama is running. Models found: ${names.slice(0, 6).join(", ") || "none"}. Pull "${model}" to use it.` });
  } catch (e) {
    return Response.json({ ok: false, detail: `Couldn't reach Ollama at ${s.ollamaBaseUrl}: ${(e as Error).message}` }, { status: 400 });
  }
}
