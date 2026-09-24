"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, bu, modelLabel, timeAgo, type Automation, type Execution, type RunEventsResponse, type Skill, type Paged, COUNTRIES, isDeepseekModel } from "@/lib/bu-client";
import { findLiveUrl } from "./EventItem";
import { Button, Field, Modal, Spinner, StatusBadge, Toggle, inputCls } from "./ui";
import { ExecutorSelect, ModelSelect } from "./Composer";
import { IconChevronRight, IconEye, IconPlus, IconTrash, IconX } from "./icons";

const TERMINAL = new Set(["completed", "failed", "cancelled"]);

/* ---------------- Live preview ---------------- */

export function LivePreview({ runId, className = "" }: { runId: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const cursor = useRef(0);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const page = await bu<RunEventsResponse>(`v4/runs/${runId}/events?after=${cursor.current}&limit=200&include_output=false`);
        if (page.nextAfter != null) cursor.current = page.nextAfter;
        const u = findLiveUrl(page.events ?? []);
        if (u) {
          setUrl(u);
          return;
        }
      } catch {}
      if (!stop) timer = setTimeout(tick, 4000);
    };
    tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [runId]);

  return (
    <div className={`relative overflow-hidden rounded-lg border border-white/10 bg-sunken ${className}`}>
      <div className="aspect-video w-full">
        {url ? (
          <div inert className="h-full w-full">
            <iframe src={url} title="Live preview" tabIndex={-1} className="pointer-events-none h-[200%] w-[200%] origin-top-left scale-50 border-0" allow="autoplay" />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center gap-2 text-[11px] text-neutral-500">
            <Spinner className="h-3 w-3" /> Starting browser…
          </div>
        )}
      </div>
      {url && (
        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-300 backdrop-blur">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Live
        </span>
      )}
    </div>
  );
}

/* ---------------- Execution feed ---------------- */

export function ExecutionFeed({ query = "", limit = 30, refreshKey = 0, emptyText = "No executions yet.", showPreviews = true }: { query?: string; limit?: number; refreshKey?: number; emptyText?: string; showPreviews?: boolean }) {
  const [items, setItems] = useState<Execution[] | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ executions: Execution[] }>(`/api/executions?limit=${limit}${query ? `&${query}` : ""}`);
      setItems(r.executions);
      return r.executions;
    } catch {
      setItems((p) => p ?? []);
      return [];
    }
  }, [query, limit]);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const loop = async () => {
      const list = await load();
      if (stop) return;
      const active = list.some((e) => !TERMINAL.has(e.status));
      timer = setTimeout(loop, active ? 4000 : 20000);
    };
    loop();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [load, refreshKey]);

  const del = async (id: number) => {
    await api(`/api/executions?id=${id}`, { method: "DELETE" }).catch(() => {});
    load();
  };

  if (!items)
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-neutral-500">
        <Spinner /> Loading executions…
      </div>
    );
  if (items.length === 0) return <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-neutral-500">{emptyText}</p>;

  const running = items.filter((e) => e.kind === "agent" && e.runId && !TERMINAL.has(e.status));

  return (
    <div className="space-y-3">
      {showPreviews && running.length > 0 && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {running.slice(0, 6).map((e) => (
            <Link key={e.id} href={`/sessions/${e.sessionId}?run=${e.runId}`} className="group block rounded-xl border border-white/[0.07] p-2 transition hover:border-white/20">
              <LivePreview runId={e.runId!} />
              <div className="mt-2 flex items-center gap-2 px-0.5">
                <StatusBadge status={e.status} />
                <span className="min-w-0 flex-1 truncate text-xs text-neutral-300">{e.label}</span>
                <IconEye width={13} height={13} className="text-neutral-500 group-hover:text-white" />
              </div>
            </Link>
          ))}
        </div>
      )}
      <div className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/[0.07]">
        {items.map((e) => {
          const open = expanded === e.id;
          return (
            <div key={e.id}>
              <div className="flex items-center gap-2.5 px-3 py-2.5 sm:px-4">
                <button onClick={() => setExpanded(open ? null : e.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left" aria-expanded={open}>
                  <IconChevronRight width={13} height={13} className={`shrink-0 text-neutral-500 transition ${open ? "rotate-90" : ""}`} />
                  <StatusBadge status={e.status} />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-200">{e.label || e.task}</span>
                </button>
                <span className="hidden rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase text-neutral-500 md:inline">{e.kind === "skill" ? "skill" : e.plannerModel ? "deepseek+agent" : "agent"}</span>
                <span className="hidden shrink-0 text-[11px] text-neutral-500 sm:inline">{timeAgo(e.createdAt)}</span>
                {e.sessionId && (
                  <Link href={`/sessions/${e.sessionId}${e.runId ? `?run=${e.runId}` : ""}`} className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-[11px] text-neutral-300 hover:bg-white/5">
                    Open
                  </Link>
                )}
              </div>
              {open && (
                <div className="space-y-2 border-t border-white/5 bg-white/[0.015] px-4 py-3 text-xs">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-neutral-500">
                    <span>Source: {e.source}</span>
                    {e.executorModel && <span>Executor: {modelLabel(e.executorModel)}</span>}
                    {e.plannerModel && <span className="text-sky-400">Planner: {modelLabel(e.plannerModel)}</span>}
                    {e.costUsd != null && <span>Cost: ${e.costUsd.toFixed(4)}</span>}
                    <span>{new Date(e.createdAt).toLocaleString()}</span>
                  </div>
                  {e.params && Object.keys(e.params).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(e.params).map(([k, v]) => (
                        <span key={k} className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">
                          {k}={String(v)}
                        </span>
                      ))}
                    </div>
                  )}
                  {e.plan && (
                    <details>
                      <summary className="cursor-pointer text-sky-400">DeepSeek plan</summary>
                      <p className="prose-result mt-1 text-neutral-400">{e.plan}</p>
                    </details>
                  )}
                  {e.result && <pre className="scroll-thin max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-sunken p-3 font-mono text-[11px] text-neutral-200">{e.result}</pre>}
                  {e.error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-red-300">{e.error}</p>}
                  {!e.result && !e.error && !TERMINAL.has(e.status) && <p className="text-neutral-500">Running… results appear here when complete.</p>}
                  <button onClick={() => del(e.id)} className="flex items-center gap-1 text-neutral-500 hover:text-red-300">
                    <IconTrash width={11} height={11} /> Remove from log
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Batch parameter table ---------------- */

export function BatchTable({ keys, rows, onChange, suggestions = {} }: { keys: string[]; rows: Record<string, string>[]; onChange: (r: Record<string, string>[]) => void; suggestions?: Record<string, string[]> }) {
  const [paste, setPaste] = useState(false);
  const [csv, setCsv] = useState("");

  const set = (i: number, k: string, v: string) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const add = () => onChange([...rows, Object.fromEntries(keys.map((k) => [k, ""]))]);
  const remove = (i: number) => onChange(rows.filter((_, j) => j !== i));

  const importCsv = () => {
    const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    const split = (l: string) => l.split(/,|\t/).map((c) => c.trim().replace(/^"|"$/g, ""));
    const first = split(lines[0]);
    const hasHeader = first.every((h) => keys.includes(h));
    const header = hasHeader ? first : keys;
    const data = (hasHeader ? lines.slice(1) : lines).map((l) => {
      const cells = split(l);
      return Object.fromEntries(keys.map((k) => [k, cells[header.indexOf(k)] ?? ""]));
    });
    onChange([...rows.filter((r) => Object.values(r).some(Boolean)), ...data].slice(0, 50));
    setCsv("");
    setPaste(false);
  };

  if (keys.length === 0) return <p className="text-xs text-neutral-500">Add <code className="font-mono text-orange-300">{"{{placeholders}}"}</code> to the template to enable batch parameters.</p>;

  return (
    <div>
      {Object.keys(suggestions).map((k) => (
        <datalist key={k} id={`dl-${k}`}>
          {suggestions[k].map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      ))}
      <div className="scroll-thin overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[420px] text-left text-xs">
          <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="w-8 px-2 py-2">#</th>
              {keys.map((k) => (
                <th key={k} className="px-2 py-2 font-mono normal-case">
                  {k}
                </th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-white/5">
                <td className="px-2 text-neutral-500">{i + 1}</td>
                {keys.map((k) => (
                  <td key={k} className="p-1">
                    <input
                      value={r[k] ?? ""}
                      onChange={(e) => set(i, k, e.target.value)}
                      list={suggestions[k] ? `dl-${k}` : undefined}
                      className="w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-white outline-none focus:border-white/20 focus:bg-black/20"
                      placeholder={k}
                    />
                  </td>
                ))}
                <td className="pr-1">
                  <button onClick={() => remove(i)} className="rounded p-1 text-neutral-500 hover:text-red-300" aria-label="Remove row">
                    <IconX width={12} height={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={add} disabled={rows.length >= 50}>
          <IconPlus width={12} height={12} /> Add row
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setPaste((v) => !v)}>
          Paste CSV
        </Button>
        <span className="ml-auto text-[11px] text-neutral-500">{rows.length}/50 rows</span>
      </div>
      {paste && (
        <div className="mt-2 space-y-2">
          <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={4} placeholder={`${keys.join(",")}\n...`} className={`${inputCls} font-mono text-xs`} />
          <Button size="sm" onClick={importCsv}>
            Import rows
          </Button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Schedule fields ---------------- */

export type ScheduleState = { scheduleType: Automation["scheduleType"]; intervalMinutes: string; runAt: string; dailyTime: string };

export function ScheduleFields({ value, onChange }: { value: ScheduleState; onChange: (v: ScheduleState) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-1 rounded-lg border border-white/10 p-1">
        {(["manual", "once", "interval", "daily"] as const).map((t) => (
          <button key={t} type="button" onClick={() => onChange({ ...value, scheduleType: t })} className={`h-8 rounded-md text-xs capitalize ${value.scheduleType === t ? "bg-white/10 font-medium text-white" : "text-neutral-500"}`}>
            {t}
          </button>
        ))}
      </div>
      {value.scheduleType === "interval" && (
        <Field label="Repeat every" hint="Minimum 5 minutes">
          <select value={value.intervalMinutes} onChange={(e) => onChange({ ...value, intervalMinutes: e.target.value })} className={inputCls}>
            {[
              ["15", "15 minutes"],
              ["30", "30 minutes"],
              ["60", "1 hour"],
              ["180", "3 hours"],
              ["360", "6 hours"],
              ["720", "12 hours"],
              ["1440", "24 hours"],
              ["10080", "7 days"],
            ].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
      )}
      {value.scheduleType === "once" && (
        <Field label="Run at (your local time)">
          <input type="datetime-local" value={value.runAt} onChange={(e) => onChange({ ...value, runAt: e.target.value })} className={inputCls} />
        </Field>
      )}
      {value.scheduleType === "daily" && (
        <Field label="Time of day (UTC)" hint="Bangladesh time = UTC + 6">
          <input type="time" value={value.dailyTime} onChange={(e) => onChange({ ...value, dailyTime: e.target.value })} className={inputCls} />
        </Field>
      )}
    </div>
  );
}

export function scheduleToBody(s: ScheduleState) {
  return {
    scheduleType: s.scheduleType,
    intervalMinutes: s.scheduleType === "interval" ? Number(s.intervalMinutes) : null,
    runAt: s.scheduleType === "once" && s.runAt ? new Date(s.runAt).toISOString() : null,
    dailyTime: s.scheduleType === "daily" ? s.dailyTime : null,
  };
}

/* ---------------- Automation editor ---------------- */

export const PARAM_SUGGESTIONS: Record<string, string[]> = {
  country: ["Australia", "Serbia", "Russia", "Turkey", "Singapore", "Malaysia", "Saudi Arabia", "Bahrain", "UAE", "Qatar", "Japan", "Romania", "Poland"],
  category: ["Construction Worker", "Welder", "Electrician", "Plumber", "Driver", "Caregiver", "Hospitality", "Chef / Cook", "Farm Worker", "Factory Worker", "Cleaner", "Security Guard", "IT Professional", "Nurse"],
};

export type AutomationDraft = Partial<Automation> & { name?: string };

export function extractKeys(tpl: string) {
  return Array.from(new Set(Array.from(tpl.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)).map((m) => m[1])));
}

export function AutomationEditor({ initial, onClose, onSaved }: { initial?: AutomationDraft | null; onClose: () => void; onSaved: (a: Automation, runNow: boolean) => void }) {
  const editing = Boolean(initial?.id);
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [kind, setKind] = useState<"agent" | "skill">(initial?.kind ?? "agent");
  const [template, setTemplate] = useState(initial?.template ?? "");
  const [model, setModel] = useState(initial?.model ?? "gpt-5.6-luna");
  const [executor, setExecutor] = useState(initial?.executorModel ?? "gpt-5.6-luna");
  const [proxy, setProxy] = useState(initial?.browserSettings?.proxyCountryCode ?? "us");
  const [agentmail, setAgentmail] = useState(initial?.agentmail ?? false);
  const [skillId, setSkillId] = useState(initial?.skillId ?? "");
  const [skillSource, setSkillSource] = useState<string>(initial?.skillSource ?? "mine");
  const [skills, setSkills] = useState<(Skill & { _src: string })[] | null>(null);
  const [batch, setBatch] = useState<Record<string, string>[]>(initial?.batch?.length ? initial.batch : [{}]);
  const [schedule, setSchedule] = useState<ScheduleState>({
    scheduleType: initial?.scheduleType ?? "manual",
    intervalMinutes: String(initial?.intervalMinutes ?? 60),
    runAt: initial?.runAt ? new Date(new Date(initial.runAt).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "",
    dailyTime: initial?.dailyTime ?? "03:00",
  });
  const [busy, setBusy] = useState<"save" | "run" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (kind !== "skill" || skills) return;
    Promise.all([
      bu<Paged<Skill>>("v2/skills?pageSize=50").then((r) => r.items.map((s) => ({ ...s, _src: "mine" }))).catch(() => []),
      bu<Paged<Skill>>("v2/marketplace/skills?pageSize=50").then((r) => r.items.map((s) => ({ ...s, _src: "marketplace" }))).catch(() => []),
    ]).then(([a, b]) => setSkills([...a, ...b]));
  }, [kind, skills]);

  const selectedSkill = skills?.find((s) => s.id === skillId);
  const keys = useMemo(() => (kind === "agent" ? extractKeys(template) : (selectedSkill?.parameters.map((p) => p.name) ?? initial?.paramKeys ?? [])), [kind, template, selectedSkill, initial?.paramKeys]);

  const save = async (runNow: boolean) => {
    setBusy(runNow ? "run" : "save");
    setErr(null);
    try {
      const body = {
        name,
        description,
        kind,
        source: initial?.source ?? "tasker",
        workflow: initial?.workflow ?? null,
        template: kind === "agent" ? template : null,
        skillId: kind === "skill" ? skillId : null,
        skillSource: kind === "skill" ? skillSource : null,
        paramKeys: keys,
        batch: batch.map((r) => Object.fromEntries(keys.map((k) => [k, r[k] ?? ""]))),
        model,
        executorModel: isDeepseekModel(model) ? executor : null,
        browserSettings: { proxyCountryCode: proxy === "none" ? null : proxy },
        agentmail,
        enabled: true,
        ...scheduleToBody(schedule),
      };
      const r = editing
        ? await api<{ automation: Automation }>(`/api/automations/${initial!.id}`, { method: "PATCH", body })
        : await api<{ automation: Automation }>("/api/automations", { method: "POST", body });
      onSaved(r.automation, runNow);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal open onClose={onClose} title={editing ? "Edit automation" : "New automation"} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Passport status check" className={inputCls} />
          </Field>
          <Field label="Type">
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-white/10 p-1">
              {(["agent", "skill"] as const).map((k) => (
                <button key={k} type="button" onClick={() => setKind(k)} className={`h-8 rounded-md text-xs ${kind === k ? "bg-white/10 font-medium text-white" : "text-neutral-500"}`}>
                  {k === "agent" ? "AI agent task" : "Deterministic skill"}
                </button>
              ))}
            </div>
          </Field>
        </div>
        <Field label="Description (optional)">
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
        </Field>

        {kind === "agent" ? (
          <>
            <Field label="Task template" hint="Use {{passport}}, {{country}}, {{category}} … placeholders — each batch row fills them in.">
              <textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                rows={5}
                placeholder="Check the visa application status for passport {{passport}} applying to {{country}} under category {{category}}. Return the current status and next steps."
                className={`${inputCls} font-mono text-[13px]`}
              />
            </Field>
            <div className="flex flex-wrap gap-1.5">
              {["passport", "country", "category", "name", "email", "flight"].map((k) => (
                <button key={k} type="button" onClick={() => setTemplate((t) => `${t}${t && !t.endsWith(" ") ? " " : ""}{{${k}}}`)} className="rounded-full border border-white/10 px-2.5 py-1 font-mono text-[11px] text-neutral-400 hover:text-white">
                  + {`{{${k}}}`}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Model">
                <ModelSelect value={model} onChange={setModel} />
              </Field>
              {isDeepseekModel(model) ? (
                <Field label="Executor model">
                  <ExecutorSelect value={executor} onChange={setExecutor} />
                </Field>
              ) : (
                <Field label="Proxy country">
                  <select value={proxy ?? "none"} onChange={(e) => setProxy(e.target.value)} className={inputCls}>
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.label}
                      </option>
                    ))}
                    <option value="none">No proxy</option>
                  </select>
                </Field>
              )}
            </div>
            <div className="rounded-lg border border-white/5 px-3">
              <Toggle checked={agentmail} onChange={setAgentmail} label="AgentMail inbox (agent can send status emails)" />
            </div>
          </>
        ) : (
          <Field label="Skill">
            {!skills ? (
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <Spinner className="h-3 w-3" /> Loading skills…
              </div>
            ) : (
              <select
                value={skillId}
                onChange={(e) => {
                  setSkillId(e.target.value);
                  setSkillSource(skills.find((s) => s.id === e.target.value)?._src ?? "mine");
                  setBatch([{}]);
                }}
                className={inputCls}
              >
                <option value="">Select a skill…</option>
                <optgroup label="My skills">
                  {skills.filter((s) => s._src === "mine").map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Marketplace">
                  {skills.filter((s) => s._src === "marketplace").map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </optgroup>
              </select>
            )}
          </Field>
        )}

        <div>
          <p className="mb-1.5 text-xs font-medium text-neutral-300">Batch parameters</p>
          <BatchTable keys={keys} rows={batch} onChange={setBatch} suggestions={PARAM_SUGGESTIONS} />
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-neutral-300">Schedule</p>
          <ScheduleFields value={schedule} onChange={setSchedule} />
        </div>

        {err && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">{err}</p>}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="secondary" className="flex-1" loading={busy === "save"} disabled={Boolean(busy)} onClick={() => save(false)}>
            {editing ? "Save changes" : "Save automation"}
          </Button>
          <Button className="flex-1" loading={busy === "run"} disabled={Boolean(busy)} onClick={() => save(true)}>
            Save & run batch now
          </Button>
        </div>
      </div>
    </Modal>
  );
}
