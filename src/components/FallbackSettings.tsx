"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Field, Spinner, Toggle, inputCls } from "./ui";
import { IconBolt, IconCheck, IconCloud, IconRefresh, IconShield, IconTerminal } from "./icons";
import { api, type AppSettingsView } from "@/lib/bu-client";

const FREEFALL_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "deepseek/deepseek-chat-v3-0324:free",
  "google/gemini-2.0-flash-exp:free",
  "qwen/qwen-2.5-72b-instruct:free",
  "mistralai/mistral-nemo:free",
];

const PROVIDERS = [
  { id: "mock", label: "Mock", desc: "Offline, zero-cost test runs", icon: IconTerminal },
  { id: "ollama", label: "Local Ollama", desc: "Your own machine — no API key", icon: IconCloud },
  { id: "openrouter", label: "OpenRouter", desc: "Free-tier models for planning", icon: IconBolt },
] as const;

/** Free / Fallback Agent Mode + DeepSeek model routing. */
export default function FallbackSettings() {
  const [settings, setSettings] = useState<AppSettingsView | null>(null);
  const [providers, setProviders] = useState<{ openrouter: boolean; deepseek: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [probe, setProbe] = useState<string | null>(null);
  const [ollamaUrl, setOllamaUrl] = useState("");
  const [ollamaModel, setOllamaModel] = useState("");
  const [orModel, setOrModel] = useState("");
  const [dsPlan, setDsPlan] = useState("deepseek-chat");
  const [dsExec, setDsExec] = useState("gpt-5.6-luna");

  const load = useCallback(async () => {
    const r = await api<{ settings: AppSettingsView; providers: { openrouter: boolean; deepseek: boolean } }>("/api/fallback");
    setSettings(r.settings);
    setProviders(r.providers);
    setOllamaUrl(r.settings.ollamaBaseUrl);
    setOllamaModel(r.settings.ollamaModel);
    setOrModel(r.settings.openrouterModel);
    setDsPlan(r.settings.deepseekPlanningModel);
    setDsExec(r.settings.deepseekExecutorModel);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const patch = async (body: Record<string, unknown>, label: string) => {
    setBusy(label);
    setMsg(null);
    try {
      const r = await api<{ settings: AppSettingsView }>("/api/fallback", { method: "PATCH", body });
      setSettings(r.settings);
      window.dispatchEvent(new Event("bu:keys"));
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const test = async (provider: "mock" | "ollama" | "openrouter") => {
    setBusy(`test-${provider}`);
    setProbe(null);
    try {
      await api<{ settings: AppSettingsView }>("/api/fallback", {
        method: "PATCH",
        body: { ollamaBaseUrl: ollamaUrl, ollamaModel, openrouterModel: orModel },
      });
      const r = await api<{ ok: boolean; detail: string }>("/api/fallback", { method: "POST", body: { provider } });
      setProbe(r.detail);
    } catch (e) {
      setProbe((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (!settings) {
    return (
      <section className="rounded-2xl border border-white/[0.07] p-4 sm:p-5">
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <Spinner className="h-3 w-3" /> Loading agent mode…
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300">
          <IconShield width={18} height={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-white">Free / Fallback Agent Mode</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-neutral-400">
            Keeps automations running without a Browser Use key. Tasks are planned by a free or local model and completed by the mock executor — no upstream credits.
          </p>
        </div>
        <div className="w-12 shrink-0">
          <Toggle checked={settings.fallbackMode} onChange={(v) => patch({ fallbackMode: v }, "mode")} label="" />
        </div>
      </div>

      {settings.fallbackMode && (
        <div className="mt-4 space-y-3 fade-up">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => patch({ fallbackProvider: p.id }, "provider")}
                disabled={busy === "provider"}
                className={`rounded-xl border p-3 text-left transition press ${settings.fallbackProvider === p.id ? "border-emerald-500/40 bg-emerald-500/[0.08]" : "border-white/8 hover:border-white/20"}`}
              >
                <p.icon width={15} height={15} className={settings.fallbackProvider === p.id ? "text-emerald-300" : "text-neutral-400"} />
                <p className="mt-2 text-[13px] font-medium text-white">{p.label}</p>
                <p className="text-[11px] leading-snug text-neutral-500">{p.desc}</p>
              </button>
            ))}
          </div>

          {settings.fallbackProvider === "openrouter" && (
            <div className="space-y-3 rounded-xl border border-white/[0.07] p-3">
              <Field label="OpenRouter model" hint={providers?.openrouter ? "An OpenRouter key is connected." : "Add an OpenRouter key in the vault above, or set OPENROUTER_API_KEY."}>
                <input value={orModel} onChange={(e) => setOrModel(e.target.value)} list="or-models" className={`${inputCls} font-mono text-[12px]`} />
                <datalist id="or-models">
                  {FREEFALL_MODELS.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </Field>
              <Button size="sm" variant="secondary" loading={busy === "test-openrouter"} onClick={() => test("openrouter")}>
                <IconRefresh width={13} height={13} /> Test connection
              </Button>
            </div>
          )}

          {settings.fallbackProvider === "ollama" && (
            <div className="space-y-3 rounded-xl border border-white/[0.07] p-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Ollama base URL">
                  <input value={ollamaUrl} onChange={(e) => setOllamaUrl(e.target.value)} placeholder="http://127.0.0.1:11434" className={`${inputCls} font-mono text-[12px]`} />
                </Field>
                <Field label="Model">
                  <input value={ollamaModel} onChange={(e) => setOllamaModel(e.target.value)} placeholder="llama3.1" className={`${inputCls} font-mono text-[12px]`} />
                </Field>
              </div>
              <Button size="sm" variant="secondary" loading={busy === "test-ollama"} onClick={() => test("ollama")}>
                <IconRefresh width={13} height={13} /> Test connection
              </Button>
            </div>
          )}

          {probe && (
            <p className={`rounded-lg border px-3 py-2 text-xs ${probe.toLowerCase().includes("not") || probe.toLowerCase().includes("couldn") || probe.toLowerCase().includes("responded") ? "border-amber-500/25 bg-amber-500/[0.07] text-amber-200" : "border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-200"}`}>
              {probe}
            </p>
          )}
        </div>
      )}

      <div className="mt-5 space-y-3 border-t border-white/5 pt-4">
        <div className="flex items-center gap-2">
          <IconBolt width={14} height={14} className="text-sky-400" />
          <h3 className="text-[13px] font-semibold text-white">DeepSeek model routing</h3>
          <span className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] ${providers?.deepseek ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-white/10 bg-white/5 text-neutral-500"}`}>
            {providers?.deepseek ? "Key connected" : "No key"}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Planning model" hint="drafts the step-by-step plan">
            <select value={dsPlan} onChange={(e) => setDsPlan(e.target.value)} onBlur={() => patch({ deepseekPlanningModel: dsPlan }, "ds")} className={inputCls}>
              <option value="deepseek-chat">deepseek-chat — DeepSeek-V3</option>
              <option value="deepseek-reasoner">deepseek-reasoner — DeepSeek-R1</option>
            </select>
          </Field>
          <Field label="Executor model" hint="Browser Use model that runs the plan">
            <select value={dsExec} onChange={(e) => setDsExec(e.target.value)} onBlur={() => patch({ deepseekExecutorModel: dsExec }, "ds")} className={inputCls}>
              {["gpt-5.6-luna", "claude-opus-5", "claude-sonnet-5", "gpt-5.6-sol", "gpt-6-astra", "grok-4.5", "gemini-3.1-pro", "gemini-3.6-flash", "minimax-m3", "kimi-k3", "glm-5.2"].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {msg && <p className={`mt-3 text-xs ${msg.ok ? "text-emerald-300" : "text-red-300"}`}>{msg.text}</p>}
      {busy === "mode" && <p className="mt-3 flex items-center gap-2 text-xs text-neutral-500"><Spinner className="h-3 w-3" /> Saving…</p>}
      {busy === null && !msg && settings.fallbackMode && (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-300">
          <IconCheck width={12} height={12} /> Fallback mode is active — automations will not stop when a key is missing.
        </p>
      )}
    </section>
  );
}
