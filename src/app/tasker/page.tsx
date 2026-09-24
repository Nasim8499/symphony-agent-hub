"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import SkillsBrowser from "@/components/SkillsBrowser";
import GoogleSkills from "@/components/GoogleSkills";
import { ExecutorSelect, ModelSelect } from "@/components/Composer";
import { AutomationEditor, BatchTable, ExecutionFeed, extractKeys, PARAM_SUGGESTIONS, ScheduleFields, scheduleToBody, type ScheduleState } from "@/components/automation-ui";
import { Button, Field, PageHeader, inputCls } from "@/components/ui";
import { IconBolt, IconGoogle, IconLayers, IconPlay, IconStore } from "@/components/icons";
import { api, isDeepseekModel, renderPreview, type Automation } from "@/lib/tasker-client";

const PRESETS = [
  {
    id: "visa-status",
    name: "Visa / passport status check",
    template:
      "Check the latest visa application status for passport number {{passport}} applying to {{country}} under the {{category}} category. Use the official government/embassy status portal for {{country}}. If a login or captcha blocks you, stop and report exactly what is required. Return: status, last update date, next steps.",
    rows: [
      { passport: "A01234567", country: "Serbia", category: "Construction Worker" },
      { passport: "B07654321", country: "Malaysia", category: "Factory Worker" },
    ],
  },
  {
    id: "requirements",
    name: "Work visa requirement lookup",
    template:
      "Research the current official work visa / work permit requirements for a Bangladeshi {{category}} going to {{country}}. Use official government sources only. Return a checklist: required documents, skill test / assessment, medical, police clearance, fees (local currency + USD), processing time and the official links.",
    rows: [
      { country: "Australia", category: "Welder" },
      { country: "Saudi Arabia", category: "Driver" },
      { country: "Singapore", category: "Construction Worker" },
    ],
  },
  {
    id: "jobs",
    name: "Job demand scan",
    template:
      "Search reputable job boards and official employment portals in {{country}} for current openings for {{category}} that sponsor foreign workers. List up to 8 openings with employer, city, salary (if shown), visa sponsorship note and the posting URL.",
    rows: [
      { country: "Romania", category: "Hospitality" },
      { country: "Turkey", category: "Electrician" },
    ],
  },
];

type Tab = "tasker" | "skills" | "marketplace" | "workspace";

export default function TaskerPage() {
  const [tab, setTab] = useState<Tab>("tasker");

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (t === "skills" || t === "marketplace" || t === "tasker" || t === "workspace") setTab(t);
  }, []);

  const go = (t: Tab) => {
    setTab(t);
    window.history.replaceState(null, "", t === "tasker" ? "/tasker" : `/tasker?tab=${t}`);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
      <PageHeader
        title="Skills & Tasker Engine"
        description="Batch-dispatch parameterised agent tasks, schedule them, and run deterministic skills — with live execution previews."
        actions={
          <Link href="/automations" className="inline-flex h-8 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-medium text-neutral-200 hover:bg-white/5">
            <IconLayers width={14} height={14} /> All automations
          </Link>
        }
      />

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-white/[0.07]">
        {(
          [
            ["tasker", "Batch Tasker", IconLayers],
            ["skills", "My Skills", IconBolt],
            ["marketplace", "Marketplace", IconStore],
            ["workspace", "Google Workspace", IconGoogle],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => go(id)}
            className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm ${tab === id ? "border-orange-400 font-medium text-white" : "border-transparent text-neutral-500 hover:text-neutral-300"}`}
          >
            <Icon width={14} height={14} /> {label}
          </button>
        ))}
      </div>

      {tab === "tasker" && <BatchTasker />}
      {tab === "skills" && <SkillsBrowser mode="mine" />}
      {tab === "marketplace" && <SkillsBrowser mode="marketplace" />}
      {tab === "workspace" && <GoogleSkills />}
    </div>
  );
}

function BatchTasker() {
  const [preset, setPreset] = useState(PRESETS[0].id);
  const [name, setName] = useState(PRESETS[0].name);
  const [template, setTemplate] = useState(PRESETS[0].template);
  const [rows, setRows] = useState<Record<string, string>[]>(PRESETS[0].rows);
  const [model, setModel] = useState("gpt-5.6-luna");
  const [executor, setExecutor] = useState("gpt-5.6-luna");
  const [schedule, setSchedule] = useState<ScheduleState>({ scheduleType: "manual", intervalMinutes: "360", runAt: "", dailyTime: "03:00" });
  const [busy, setBusy] = useState<"run" | "save" | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [feedKey, setFeedKey] = useState(0);
  const [advanced, setAdvanced] = useState(false);

  const keys = useMemo(() => extractKeys(template), [template]);
  const validRows = rows.filter((r) => Object.values(r).some((v) => v?.trim()));

  const applyPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id)!;
    setPreset(id);
    setName(p.name);
    setTemplate(p.template);
    setRows(p.rows);
  };

  const submit = async (runNow: boolean) => {
    setBusy(runNow ? "run" : "save");
    setFlash(null);
    try {
      const body = {
        name,
        kind: "agent",
        source: "tasker",
        template,
        paramKeys: keys,
        batch: validRows.map((r) => Object.fromEntries(keys.map((k) => [k, r[k] ?? ""]))),
        model,
        executorModel: isDeepseekModel(model) ? executor : null,
        browserSettings: { proxyCountryCode: "us" },
        ...scheduleToBody(schedule),
      };
      const { automation } = await api<{ automation: Automation }>("/api/automations", { method: "POST", body });
      if (runNow) {
        const r = await api<{ dispatched: number; failed: number; error?: string }>(`/api/automations/${automation.id}/run`, { method: "POST" });
        setFlash(r.dispatched ? { ok: true, text: `Dispatched ${r.dispatched} run${r.dispatched === 1 ? "" : "s"}${r.failed ? ` · ${r.failed} failed` : ""}. Live previews below.` } : { ok: false, text: r.error ?? "All runs failed to dispatch" });
      } else {
        setFlash({ ok: true, text: `Saved “${automation.name}” to All Automations${schedule.scheduleType !== "manual" ? " with its schedule" : ""}.` });
      }
      setFeedKey((k) => k + 1);
    } catch (e) {
      setFlash({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const first = validRows[0];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
      <div className="space-y-5">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {PRESETS.map((p) => (
            <button key={p.id} onClick={() => applyPreset(p.id)} className={`shrink-0 rounded-lg border px-3 py-2 text-left text-xs ${preset === p.id ? "border-orange-500/40 bg-orange-500/10 text-white" : "border-white/10 text-neutral-400 hover:text-white"}`}>
              {p.name}
            </button>
          ))}
        </div>

        <Field label="Task name">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Task template" hint="Placeholders like {{passport}}, {{country}}, {{category}} become batch columns automatically.">
          <textarea value={template} onChange={(e) => setTemplate(e.target.value)} rows={5} className={`${inputCls} font-mono text-[13px]`} />
        </Field>

        <div>
          <p className="mb-1.5 text-xs font-medium text-neutral-300">Batch inputs · {validRows.length} task{validRows.length === 1 ? "" : "s"}</p>
          <BatchTable keys={keys} rows={rows} onChange={setRows} suggestions={PARAM_SUGGESTIONS} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Model">
            <ModelSelect value={model} onChange={setModel} />
          </Field>
          {isDeepseekModel(model) && (
            <Field label="Executor model">
              <ExecutorSelect value={executor} onChange={setExecutor} />
            </Field>
          )}
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-neutral-300">Schedule</p>
          <ScheduleFields value={schedule} onChange={setSchedule} />
        </div>

        {flash && <div className={`rounded-xl border px-4 py-2.5 text-sm ${flash.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>{flash.text}</div>}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={() => submit(true)} loading={busy === "run"} disabled={Boolean(busy) || !name.trim() || !template.trim()} className="flex-1">
            {busy !== "run" && <IconPlay width={12} height={12} />} Run batch now ({Math.max(1, validRows.length)})
          </Button>
          <Button variant="secondary" onClick={() => submit(false)} loading={busy === "save"} disabled={Boolean(busy) || !name.trim() || !template.trim()}>
            {schedule.scheduleType === "manual" ? "Save as automation" : "Save & schedule"}
          </Button>
          <Button variant="ghost" onClick={() => setAdvanced(true)}>
            Skill batch…
          </Button>
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <div className="rounded-xl border border-white/[0.07] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Prompt preview · row 1</p>
          <p className="prose-result mt-2 max-h-64 overflow-y-auto text-[12.5px] leading-relaxed text-neutral-300">{renderPreview(template, first ?? {})}</p>
        </div>
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Live execution preview</p>
          <ExecutionFeed query="source=tasker" limit={12} refreshKey={feedKey} emptyText="Run a batch to see live browser previews here." />
        </div>
      </aside>

      {advanced && (
        <AutomationEditor
          initial={{ kind: "skill", source: "tasker", name: "Skill batch" }}
          onClose={() => setAdvanced(false)}
          onSaved={async (a, runNow) => {
            setAdvanced(false);
            if (runNow) await api(`/api/automations/${a.id}/run`, { method: "POST" }).catch(() => {});
            setFeedKey((k) => k + 1);
            setFlash({ ok: true, text: `Skill automation “${a.name}” ${runNow ? "dispatched" : "saved"}.` });
          }}
        />
      )}
    </div>
  );
}
