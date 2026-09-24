"use client";

import { useEffect, useRef, useState } from "react";
import { ALL_MODELS, bu, COUNTRIES, DEEPSEEK_MODELS, isDeepseekModel, MODELS, type Profile } from "@/lib/bu-client";
import { IconArrowUp, IconCheck, IconChevron, IconSettings, IconSpark, IconStop } from "./icons";
import { Spinner, Toggle, inputCls } from "./ui";

export type ComposerPayload = {
  task: string;
  model: string;
  executorModel?: string;
  browserSettings?: { proxyCountryCode?: string | null; profileId?: string | null; record?: boolean };
  agentmail?: boolean;
  maxCostUsd?: number;
};

/** Native select with executor / planner groups — used in forms. */
export function ModelSelect({ value, onChange, className = "" }: { value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} ${className}`}>
      <optgroup label="Browser Use executors">
        {MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
            {m.note ? ` — ${m.note}` : ""}
          </option>
        ))}
      </optgroup>
      <optgroup label="DeepSeek planners (plan → execute)">
        {DEEPSEEK_MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label} ({m.id})
          </option>
        ))}
      </optgroup>
    </select>
  );
}

export function ExecutorSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      {MODELS.map((m) => (
        <option key={m.id} value={m.id}>
          {m.label}
        </option>
      ))}
    </select>
  );
}

export default function Composer({
  onSubmit,
  busy,
  busyLabel,
  running,
  onStop,
  placeholder = "What should the agent do?",
  followUp,
  autoFocus,
  initialValue,
  compact,
}: {
  onSubmit: (p: ComposerPayload) => Promise<void> | void;
  busy?: boolean;
  busyLabel?: string;
  running?: boolean;
  onStop?: () => void;
  placeholder?: string;
  followUp?: boolean;
  autoFocus?: boolean;
  initialValue?: { text: string; nonce: number };
  compact?: boolean;
}) {
  const [task, setTask] = useState("");
  const [model, setModel] = useState(MODELS[0].id);
  const [executor, setExecutor] = useState(MODELS[0].id);
  const [modelOpen, setModelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [proxy, setProxy] = useState<string>("us");
  const [profileId, setProfileId] = useState<string>("");
  const [record, setRecord] = useState(false);
  const [agentmail, setAgentmail] = useState(false);
  const [maxCost, setMaxCost] = useState<string>("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const ta = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (initialValue) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTask(initialValue.text);
      ta.current?.focus();
    }
  }, [initialValue]);

  useEffect(() => {
    const saved = localStorage.getItem("bu:model");
    const savedExec = localStorage.getItem("bu:executor");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved && ALL_MODELS.some((m) => m.id === saved)) setModel(saved);
    if (savedExec && MODELS.some((m) => m.id === savedExec)) setExecutor(savedExec);
  }, []);

  useEffect(() => {
    if (!settingsOpen || followUp) return;
    bu<{ items: Profile[] }>("v4/profiles?pageSize=50")
      .then((r) => setProfiles(r.items ?? []))
      .catch(() => {});
  }, [settingsOpen, followUp]);

  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [task]);

  const submit = async () => {
    const t = task.trim();
    if (!t || busy) return;
    const payload: ComposerPayload = { task: t, model };
    if (isDeepseekModel(model)) payload.executorModel = executor;
    if (!followUp) {
      payload.browserSettings = {
        proxyCountryCode: proxy === "none" ? null : proxy,
        ...(profileId ? { profileId } : {}),
        ...(record ? { record: true } : {}),
      };
      if (agentmail) payload.agentmail = true;
      const mc = parseFloat(maxCost);
      if (mc > 0) payload.maxCostUsd = mc;
    }
    await onSubmit(payload);
    setTask("");
  };

  const current = ALL_MODELS.find((m) => m.id === model) ?? MODELS[0];
  const country = COUNTRIES.find((c) => c.code === proxy);
  const planner = isDeepseekModel(model);

  const pick = (id: string) => {
    setModel(id);
    localStorage.setItem("bu:model", id);
    setModelOpen(false);
  };

  return (
    <div className="relative">
      <div className="rounded-2xl border border-white/10 bg-elevated shadow-[0_8px_40px_-12px_rgba(0,0,0,0.25)] transition focus-within:border-white/25">
        <textarea
          ref={ta}
          autoFocus={autoFocus}
          value={task}
          onChange={(e) => setTask(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          rows={followUp || compact ? 1 : 2}
          placeholder={placeholder}
          className="block w-full resize-none bg-transparent px-4 pb-1.5 pt-3.5 text-[15px] text-white placeholder:text-neutral-500 outline-none"
        />
        <div className="flex items-center gap-1 px-2 pb-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setModelOpen((v) => !v);
                setSettingsOpen(false);
              }}
              className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-neutral-300 hover:bg-white/[0.06]"
            >
              {planner ? <IconSpark width={13} height={13} className="text-sky-400" /> : <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />}
              <span className="max-w-[92px] truncate sm:max-w-none">{current.label}</span>
              {planner && <span className="hidden text-neutral-500 sm:inline">→ {ALL_MODELS.find((m) => m.id === executor)?.label}</span>}
              <IconChevron width={14} height={14} />
            </button>
            {modelOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setModelOpen(false)} />
                <div className="absolute bottom-10 left-0 z-40 w-[min(290px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-white/10 bg-elevated p-1 shadow-2xl fade-up">
                  <div className="scroll-thin max-h-[60vh] overflow-y-auto">
                    <p className="px-2.5 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-neutral-500">Browser Use executors</p>
                    {MODELS.map((m) => (
                      <button key={m.id} onClick={() => pick(m.id)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-white/[0.06]">
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] text-white">{m.label}</p>
                          <p className="text-[11px] text-neutral-500">
                            {m.provider}
                            {m.note ? ` · ${m.note}` : ""}
                          </p>
                        </div>
                        {m.id === model && <IconCheck width={14} height={14} className="text-orange-400" />}
                      </button>
                    ))}
                    <p className="mt-1 border-t border-white/5 px-2.5 pb-1 pt-2.5 text-[10px] font-medium uppercase tracking-wider text-sky-400">DeepSeek planners</p>
                    {DEEPSEEK_MODELS.map((m) => (
                      <button key={m.id} onClick={() => pick(m.id)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-white/[0.06]">
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] text-white">{m.label}</p>
                          <p className="font-mono text-[10px] text-neutral-500">{m.note}</p>
                        </div>
                        {m.id === model && <IconCheck width={14} height={14} className="text-sky-400" />}
                      </button>
                    ))}
                    <p className="px-2.5 pb-2 pt-1 text-[10px] leading-snug text-neutral-500">DeepSeek drafts a step-by-step plan; a Browser Use executor runs it in the cloud browser.</p>
                  </div>
                </div>
              </>
            )}
          </div>

          {(!followUp || planner) && (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen((v) => !v);
                  setModelOpen(false);
                }}
                className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs text-neutral-400 hover:bg-white/[0.06] hover:text-neutral-200"
                aria-label="Run settings"
              >
                <IconSettings width={14} height={14} />
                {!followUp && <span className="hidden sm:inline">{country ? `${country.flag} ${country.code.toUpperCase()}` : "No proxy"}</span>}
              </button>
              {settingsOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setSettingsOpen(false)} />
                  <div className="absolute bottom-10 left-[-60px] z-40 w-[min(300px,calc(100vw-2rem))] space-y-3 rounded-xl border border-white/10 bg-elevated p-3.5 shadow-2xl fade-up sm:left-0">
                    {planner && (
                      <div>
                        <span className="mb-1 block text-xs text-neutral-400">Executor model (runs the plan)</span>
                        <ExecutorSelect
                          value={executor}
                          onChange={(v) => {
                            setExecutor(v);
                            localStorage.setItem("bu:executor", v);
                          }}
                        />
                      </div>
                    )}
                    {!followUp && (
                      <>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">Browser settings</p>
                        <div>
                          <span className="mb-1 block text-xs text-neutral-400">Proxy country</span>
                          <select value={proxy} onChange={(e) => setProxy(e.target.value)} className={inputCls}>
                            {COUNTRIES.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.flag} {c.label}
                              </option>
                            ))}
                            <option value="none">No proxy</option>
                          </select>
                        </div>
                        <div>
                          <span className="mb-1 block text-xs text-neutral-400">Browser profile</span>
                          <select value={profileId} onChange={(e) => setProfileId(e.target.value)} className={inputCls}>
                            <option value="">None (fresh browser)</option>
                            {profiles.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name || p.id.slice(0, 8)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <span className="mb-1 block text-xs text-neutral-400">Max cost (USD)</span>
                          <input value={maxCost} onChange={(e) => setMaxCost(e.target.value)} type="number" min="0" step="0.1" placeholder="No limit" className={inputCls} />
                        </div>
                        <div className="border-t border-white/5 pt-2">
                          <Toggle checked={record} onChange={setRecord} label="Record browser" />
                          <Toggle checked={agentmail} onChange={setAgentmail} label="AgentMail inbox" />
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            {busy && busyLabel ? (
              <span className="text-[11px] text-sky-400">{busyLabel}</span>
            ) : (
              <span className="hidden text-[11px] text-neutral-500 sm:inline">{followUp ? "Follow up" : "Enter ↵ to run"}</span>
            )}
            {running && onStop ? (
              <button onClick={onStop} className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-white hover:bg-white/20" title="Stop run" aria-label="Stop run">
                <IconStop width={14} height={14} />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!task.trim() || busy}
                className="grid h-8 w-8 place-items-center rounded-lg bg-white text-black transition hover:opacity-85 disabled:bg-white/10 disabled:text-neutral-500"
                title="Run"
                aria-label="Run task"
              >
                {busy ? <Spinner className="h-3.5 w-3.5" /> : <IconArrowUp width={16} height={16} />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
