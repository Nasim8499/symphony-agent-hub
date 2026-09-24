"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import { ExecutorSelect, ModelSelect } from "@/components/Composer";
import { refreshSessions } from "@/components/AppShell";
import { ExecutionFeed, ScheduleFields, scheduleToBody, type ScheduleState } from "@/components/automation-ui";
import { Button, Field, Toggle, inputCls } from "@/components/ui";
import { IconBriefcase, IconBuilding, IconExternal, IconGlobe, IconMail, IconMapPin, IconPhone, IconPlane, IconPlay, IconShield, IconTrash, IconUsers } from "@/components/icons";
import { api, dispatchAgent, isDeepseekModel, timeAgo } from "@/lib/bu-client";
import {
  INSUS, JOB_CATEGORIES, RESIDENCY_ENTITIES, VISITOR_DESTINATIONS, WORK_COUNTRIES,
  residencyPrompt, trackingPrompt, visitorPrompt, workPermitPrompt, type Candidate,
} from "@/lib/insus";

type WorkflowId = "work" | "visitor" | "residency" | "tracking";

const WORKFLOWS: { id: WorkflowId; title: string; short: string; desc: string; icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { id: "work", title: "Work Permit & Employment Visa Engine", short: "Work Permit", desc: "8 countries · intake · skill assessment", icon: IconBriefcase },
  { id: "visitor", title: "Visitor & Tourist Visa Automator", short: "Visitor Visa", desc: "Pre-fill · checklist · submission bot", icon: IconGlobe },
  { id: "residency", title: "Business Residency & Self-Sponsorship", short: "Business Residency", desc: "Serbia & Russia company registry", icon: IconBuilding },
  { id: "tracking", title: "End-to-End Onboarding & Tracking", short: "Onboarding", desc: "Flights · clearance · client emails", icon: IconPlane },
];

type RunRequest = { prompt: string; label: string; workflow: WorkflowId; agentmail?: boolean };
type Outcome = { ok: boolean; text: string; sessionId?: string; runId?: string } | null;

/* ---------- shared run controls ---------- */

function useRunner() {
  const [model, setModel] = useState("gpt-5.6-luna");
  const [executor, setExecutor] = useState("gpt-5.6-luna");
  const [busy, setBusy] = useState<"run" | "save" | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [feedKey, setFeedKey] = useState(0);

  const run = async (r: RunRequest) => {
    setBusy("run");
    setOutcome(null);
    try {
      const d = await dispatchAgent({
        task: r.prompt,
        model,
        executorModel: isDeepseekModel(model) ? executor : undefined,
        source: "insus",
        label: r.label,
        agentmail: r.agentmail,
        browserSettings: { proxyCountryCode: "us" },
      });
      setOutcome({ ok: true, text: `Dispatched${d.plannerModel ? " with a DeepSeek plan" : ""}. The agent is working in a live cloud browser.`, sessionId: d.sessionId, runId: d.runId });
      refreshSessions();
    } catch (e) {
      setOutcome({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
      setFeedKey((k) => k + 1);
    }
  };

  const save = async (r: RunRequest, schedule: ScheduleState) => {
    setBusy("save");
    setOutcome(null);
    try {
      await api("/api/automations", {
        method: "POST",
        body: {
          name: r.label,
          description: WORKFLOWS.find((w) => w.id === r.workflow)?.title,
          kind: "agent",
          source: "insus",
          workflow: r.workflow,
          template: r.prompt,
          model,
          executorModel: isDeepseekModel(model) ? executor : null,
          agentmail: Boolean(r.agentmail),
          browserSettings: { proxyCountryCode: "us" },
          ...scheduleToBody(schedule),
        },
      });
      setOutcome({ ok: true, text: `Saved to All Automations${schedule.scheduleType !== "manual" ? " — the scheduler will run it automatically" : ""}.` });
    } catch (e) {
      setOutcome({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return { model, setModel, executor, setExecutor, busy, outcome, run, save, feedKey };
}

type Runner = ReturnType<typeof useRunner>;

function RunControls({ runner, build, disabled, defaultSchedule }: { runner: Runner; build: () => RunRequest; disabled?: boolean; defaultSchedule?: ScheduleState }) {
  const [showSchedule, setShowSchedule] = useState(Boolean(defaultSchedule && defaultSchedule.scheduleType !== "manual"));
  const [schedule, setSchedule] = useState<ScheduleState>(defaultSchedule ?? { scheduleType: "manual", intervalMinutes: "180", runAt: "", dailyTime: "03:00" });
  const [preview, setPreview] = useState(false);

  return (
    <div className="space-y-3 border-t border-white/[0.07] pt-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Agent model">
          <ModelSelect value={runner.model} onChange={runner.setModel} />
        </Field>
        {isDeepseekModel(runner.model) && (
          <Field label="Executor model">
            <ExecutorSelect value={runner.executor} onChange={runner.setExecutor} />
          </Field>
        )}
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        <button type="button" onClick={() => setPreview((v) => !v)} className="text-neutral-400 underline-offset-2 hover:text-white hover:underline">
          {preview ? "Hide" : "Preview"} agent prompt
        </button>
        <button type="button" onClick={() => setShowSchedule((v) => !v)} className="text-neutral-400 underline-offset-2 hover:text-white hover:underline">
          {showSchedule ? "Hide schedule" : "Schedule / save as automation"}
        </button>
      </div>
      {preview && <pre className="scroll-thin max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-white/5 bg-sunken p-3 font-mono text-[11px] leading-relaxed text-neutral-400">{build().prompt}</pre>}
      {showSchedule && <ScheduleFields value={schedule} onChange={setSchedule} />}

      {runner.outcome && (
        <div className={`flex flex-col gap-2 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center ${runner.outcome.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>
          <span className="flex-1">{runner.outcome.text}</span>
          {runner.outcome.sessionId && (
            <Link href={`/sessions/${runner.outcome.sessionId}?run=${runner.outcome.runId}`} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-white px-3 text-xs font-medium text-black">
              Watch live <IconExternal width={12} height={12} />
            </Link>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button className="flex-1" loading={runner.busy === "run"} disabled={disabled || Boolean(runner.busy)} onClick={() => runner.run(build())}>
          {runner.busy !== "run" && <IconPlay width={12} height={12} />} {runner.busy === "run" && isDeepseekModel(runner.model) ? "DeepSeek planning…" : "Run workflow now"}
        </Button>
        {showSchedule && (
          <Button variant="secondary" loading={runner.busy === "save"} disabled={disabled || Boolean(runner.busy)} onClick={() => runner.save(build(), schedule)}>
            {schedule.scheduleType === "manual" ? "Save as automation" : "Save & schedule"}
          </Button>
        )}
      </div>
    </div>
  );
}

function Checks<T extends string>({ items, value, onChange }: { items: { id: T; label: string }[]; value: Record<T, boolean>; onChange: (v: Record<T, boolean>) => void }) {
  return (
    <div className="grid grid-cols-1 gap-x-4 rounded-lg border border-white/[0.07] px-3 sm:grid-cols-2">
      {items.map((i) => (
        <Toggle key={i.id} checked={value[i.id]} onChange={(v) => onChange({ ...value, [i.id]: v })} label={i.label} />
      ))}
    </div>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}

/* ---------- 1. Work permit ---------- */

const emptyCandidate: Candidate = { fullName: "", passportNumber: "", dob: "", phone: "", email: "", category: "Construction Worker", experienceYears: "", education: "", englishLevel: "", notes: "" };

function WorkPermitForm({ runner, onCandidateSaved }: { runner: Runner; onCandidateSaved: () => void }) {
  const [country, setCountry] = useState("australia");
  const [c, setC] = useState<Candidate>(emptyCandidate);
  const [actions, setActions] = useState({ requirements: true, checklist: true, assessment: true, jobs: false });
  const [saveCandidate, setSaveCandidate] = useState(true);
  const set = (k: keyof Candidate) => (e: { target: { value: string } }) => setC((s) => ({ ...s, [k]: e.target.value }));
  const sel = WORK_COUNTRIES.find((x) => x.id === country)!;

  const build = (): RunRequest => ({ prompt: workPermitPrompt(country, c, actions), label: `Work permit · ${sel.name} · ${c.fullName || c.category}`, workflow: "work" });

  const wrapped: Runner = {
    ...runner,
    run: async (r) => {
      if (saveCandidate && c.fullName.trim()) {
        await api("/api/candidates", { method: "POST", body: { ...c, targetCountry: sel.name, status: "assessment" } }).catch(() => {});
        onCandidateSaved();
      }
      await runner.run(r);
    },
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-medium text-neutral-300">Destination country</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {WORK_COUNTRIES.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => setCountry(w.id)}
              aria-pressed={country === w.id}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-[13px] transition ${country === w.id ? "border-orange-500/50 bg-orange-500/10 font-medium text-white" : "border-white/10 text-neutral-400 hover:border-white/20 hover:text-white"}`}
            >
              <span className="text-lg leading-none">{w.flag}</span>
              <span className="min-w-0">
                <span className="block truncate">{w.name}</span>
                <span className="block text-[10px] font-normal text-neutral-500">{w.region}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">
          <span className="font-medium text-neutral-400">Official sources:</span> {sel.sources}
        </p>
      </div>

      <p className="flex items-center gap-2 pt-1 text-xs font-medium text-neutral-300">
        <IconUsers width={14} height={14} /> Candidate profile intake
      </p>
      <Grid>
        <Field label="Full name *">
          <input value={c.fullName} onChange={set("fullName")} placeholder="Md. Rahim Uddin" className={inputCls} />
        </Field>
        <Field label="Passport number">
          <input value={c.passportNumber} onChange={set("passportNumber")} placeholder="A01234567" className={`${inputCls} uppercase`} />
        </Field>
        <Field label="Trade / category">
          <select value={c.category} onChange={set("category")} className={inputCls}>
            {JOB_CATEGORIES.map((j) => (
              <option key={j}>{j}</option>
            ))}
          </select>
        </Field>
        <Field label="Experience (years)">
          <input value={c.experienceYears} onChange={set("experienceYears")} type="number" min="0" placeholder="3" className={inputCls} />
        </Field>
        <Field label="Date of birth">
          <input value={c.dob} onChange={set("dob")} type="date" className={inputCls} />
        </Field>
        <Field label="Education">
          <input value={c.education} onChange={set("education")} placeholder="SSC / HSC / Diploma" className={inputCls} />
        </Field>
        <Field label="English level">
          <select value={c.englishLevel} onChange={set("englishLevel")} className={inputCls}>
            <option value="">Not tested</option>
            <option>Basic</option>
            <option>Intermediate</option>
            <option>IELTS 5.0–5.5</option>
            <option>IELTS 6.0+</option>
            <option>PTE 50+</option>
          </select>
        </Field>
        <Field label="Phone">
          <input value={c.phone} onChange={set("phone")} type="tel" placeholder="01XXXXXXXXX" className={inputCls} />
        </Field>
      </Grid>
      <Field label="Notes">
        <textarea value={c.notes} onChange={set("notes")} rows={2} placeholder="Previous overseas experience, certificates, preferences…" className={inputCls} />
      </Field>

      <p className="text-xs font-medium text-neutral-300">Automated dispatch</p>
      <Checks
        items={[
          { id: "requirements", label: "Official visa pathway & fees" },
          { id: "checklist", label: "Document checklist" },
          { id: "assessment", label: "Skill assessment dispatch" },
          { id: "jobs", label: "Matching job openings" },
        ]}
        value={actions}
        onChange={setActions}
      />
      <label className="flex items-center gap-2 text-xs text-neutral-400">
        <input type="checkbox" checked={saveCandidate} onChange={(e) => setSaveCandidate(e.target.checked)} className="accent-orange-500" />
        Save candidate to the intake register
      </label>

      <RunControls runner={wrapped} build={build} disabled={!c.fullName.trim() || !Object.values(actions).some(Boolean)} />
    </div>
  );
}

/* ---------- 2. Visitor ---------- */

function VisitorForm({ runner }: { runner: Runner }) {
  const [dest, setDest] = useState("schengen");
  const [a, setA] = useState({ fullName: "", passportNumber: "", travelFrom: "", travelTo: "", purpose: "Tourism", employment: "", notes: "" });
  const [modes, setModes] = useState({ checklist: true, prefill: false, slots: false, submit: false });
  const set = (k: keyof typeof a) => (e: { target: { value: string } }) => setA((s) => ({ ...s, [k]: e.target.value }));
  const d = VISITOR_DESTINATIONS.find((x) => x.id === dest)!;

  return (
    <div className="space-y-4">
      <Grid>
        <Field label="Destination">
          <select value={dest} onChange={(e) => setDest(e.target.value)} className={inputCls}>
            {VISITOR_DESTINATIONS.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Purpose">
          <select value={a.purpose} onChange={set("purpose")} className={inputCls}>
            {["Tourism", "Family visit", "Business visit", "Conference / event", "Medical treatment"].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="Applicant full name">
          <input value={a.fullName} onChange={set("fullName")} className={inputCls} />
        </Field>
        <Field label="Passport number">
          <input value={a.passportNumber} onChange={set("passportNumber")} className={`${inputCls} uppercase`} />
        </Field>
        <Field label="Travel from">
          <input type="date" value={a.travelFrom} onChange={set("travelFrom")} className={inputCls} />
        </Field>
        <Field label="Travel to">
          <input type="date" value={a.travelTo} onChange={set("travelTo")} className={inputCls} />
        </Field>
      </Grid>
      <Field label="Occupation / employer">
        <input value={a.employment} onChange={set("employment")} placeholder="Business owner, ABC Traders" className={inputCls} />
      </Field>
      <p className="text-[11px] text-neutral-500">
        <span className="font-medium text-neutral-400">Portal:</span> {d.portal}
      </p>
      <Checks
        items={[
          { id: "checklist", label: "Checklist generation" },
          { id: "prefill", label: "Pre-fill visa form (no submit)" },
          { id: "slots", label: "Find appointment slots" },
          { id: "submit", label: "Embassy submission bot" },
        ]}
        value={modes}
        onChange={setModes}
      />
      {modes.submit && (
        <p className="flex items-start gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs text-orange-300">
          <IconShield width={14} height={14} className="mt-0.5 shrink-0" /> The bot stops before any payment, OTP or signature and hands control to you via live takeover in the session view.
        </p>
      )}
      <RunControls runner={runner} build={() => ({ prompt: visitorPrompt(dest, a, modes), label: `Visitor visa · ${d.name} · ${a.fullName || "applicant"}`, workflow: "visitor" })} disabled={!Object.values(modes).some(Boolean)} />
    </div>
  );
}

/* ---------- 3. Residency ---------- */

function ResidencyForm({ runner }: { runner: Runner }) {
  const [country, setCountry] = useState<"serbia" | "russia">("serbia");
  const [f, setF] = useState({ founderName: "", passportNumber: "", entity: "doo", activity: "", capital: "", city: "", employees: "", notes: "" });
  const [tasks, setTasks] = useState({ registry: true, residence: true, banking: false, costPlan: true });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["serbia", "🇷🇸", "Serbia", "APR registry · MUP residence"],
            ["russia", "🇷🇺", "Russia", "FNS registry · MVD residence"],
          ] as const
        ).map(([id, flag, name, sub]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setCountry(id);
              setF((s) => ({ ...s, entity: RESIDENCY_ENTITIES[id][0].id }));
            }}
            className={`rounded-xl border p-3 text-left ${country === id ? "border-orange-500/50 bg-orange-500/10" : "border-white/10 hover:border-white/20"}`}
          >
            <span className="text-xl">{flag}</span>
            <p className="mt-1 text-sm font-medium text-white">{name}</p>
            <p className="text-[11px] text-neutral-500">{sub}</p>
          </button>
        ))}
      </div>
      <Grid>
        <Field label="Entity type">
          <select value={f.entity} onChange={set("entity")} className={inputCls}>
            {RESIDENCY_ENTITIES[country].map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Preferred city">
          <input value={f.city} onChange={set("city")} placeholder={country === "serbia" ? "Belgrade / Novi Sad" : "Moscow / St Petersburg"} className={inputCls} />
        </Field>
        <Field label="Founder full name">
          <input value={f.founderName} onChange={set("founderName")} className={inputCls} />
        </Field>
        <Field label="Passport number">
          <input value={f.passportNumber} onChange={set("passportNumber")} className={`${inputCls} uppercase`} />
        </Field>
        <Field label="Business activity *">
          <input value={f.activity} onChange={set("activity")} placeholder="IT consulting, import/export, restaurant…" className={inputCls} />
        </Field>
        <Field label="Planned capital">
          <input value={f.capital} onChange={set("capital")} placeholder="€5,000 / ₽100,000" className={inputCls} />
        </Field>
      </Grid>
      <Checks
        items={[
          { id: "registry", label: "Company registry requirements" },
          { id: "residence", label: "Business residency pathway" },
          { id: "banking", label: "Corporate bank account" },
          { id: "costPlan", label: "Cost & timeline plan" },
        ]}
        value={tasks}
        onChange={setTasks}
      />
      <RunControls
        runner={runner}
        build={() => ({ prompt: residencyPrompt(country, f, tasks), label: `Business residency · ${country === "serbia" ? "Serbia" : "Russia"} · ${f.founderName || f.activity}`, workflow: "residency" })}
        disabled={!f.activity.trim() || !Object.values(tasks).some(Boolean)}
      />
    </div>
  );
}

/* ---------- 4. Tracking ---------- */

function TrackingForm({ runner }: { runner: Runner }) {
  const [t, setT] = useState({ clientName: "", clientEmail: "", flightNumber: "", flightDate: "", from: "DAC", to: "", destinationCountry: "", notes: "" });
  const [opts, setOpts] = useState({ flight: true, clearance: true, email: true });
  const set = (k: keyof typeof t) => (e: { target: { value: string } }) => setT((s) => ({ ...s, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      <Grid>
        <Field label="Client / traveller name">
          <input value={t.clientName} onChange={set("clientName")} className={inputCls} />
        </Field>
        <Field label="Client email (for notifications)">
          <input value={t.clientEmail} onChange={set("clientEmail")} type="email" placeholder="client@example.com" className={inputCls} />
        </Field>
        <Field label="Flight number *">
          <input value={t.flightNumber} onChange={set("flightNumber")} placeholder="BG 083 / EK 585" className={`${inputCls} uppercase`} />
        </Field>
        <Field label="Flight date">
          <input value={t.flightDate} onChange={set("flightDate")} type="date" className={inputCls} />
        </Field>
        <Field label="From (IATA)">
          <input value={t.from} onChange={set("from")} className={`${inputCls} uppercase`} />
        </Field>
        <Field label="To (IATA)">
          <input value={t.to} onChange={set("to")} placeholder="KUL / RUH / SYD" className={`${inputCls} uppercase`} />
        </Field>
      </Grid>
      <Field label="Destination country">
        <input value={t.destinationCountry} onChange={set("destinationCountry")} placeholder="Malaysia" className={inputCls} />
      </Field>
      <Checks
        items={[
          { id: "flight", label: "Flight status tracker" },
          { id: "clearance", label: "Airport clearance monitor" },
          { id: "email", label: "Email client status (AgentMail)" },
        ]}
        value={opts}
        onChange={setOpts}
      />
      <RunControls
        runner={runner}
        build={() => ({ prompt: trackingPrompt(t, opts), label: `Tracking · ${t.flightNumber || "flight"} · ${t.clientName || "client"}`, workflow: "tracking", agentmail: opts.email })}
        disabled={!t.flightNumber.trim() || !Object.values(opts).some(Boolean)}
        defaultSchedule={{ scheduleType: "interval", intervalMinutes: "180", runAt: "", dailyTime: "03:00" }}
      />
    </div>
  );
}

/* ---------- candidates ---------- */

type CandidateRow = { id: number; fullName: string; passportNumber: string | null; targetCountry: string | null; category: string | null; status: string; createdAt: string };

function CandidatesRegister({ refreshKey }: { refreshKey: number }) {
  const [rows, setRows] = useState<CandidateRow[] | null>(null);
  const load = useCallback(() => {
    api<{ candidates: CandidateRow[] }>("/api/candidates")
      .then((r) => setRows(r.candidates))
      .catch(() => setRows([]));
  }, []);
  useEffect(load, [load, refreshKey]);

  const del = async (id: number) => {
    if (!confirm("Remove this candidate from the register?")) return;
    await api(`/api/candidates?id=${id}`, { method: "DELETE" }).catch(() => {});
    load();
  };

  if (!rows) return null;
  if (rows.length === 0) return <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-xs text-neutral-500">No candidates yet — run the Work Permit engine to add intake records.</p>;
  return (
    <div className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/[0.07]">
      {rows.slice(0, 12).map((c) => (
        <div key={c.id} className="flex items-center gap-3 px-3.5 py-2.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-orange-500/15 text-xs font-semibold text-orange-300">{c.fullName.charAt(0).toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] text-white">{c.fullName}</p>
            <p className="truncate text-[11px] text-neutral-500">
              {[c.passportNumber, c.category, c.targetCountry].filter(Boolean).join(" · ")}
            </p>
          </div>
          <span className="hidden rounded bg-white/5 px-1.5 py-0.5 text-[10px] capitalize text-neutral-400 sm:inline">{c.status}</span>
          <span className="shrink-0 text-[10px] text-neutral-500">{timeAgo(c.createdAt)}</span>
          <button onClick={() => del(c.id)} className="p-1 text-neutral-500 hover:text-red-300" aria-label="Remove candidate">
            <IconTrash width={12} height={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ---------- page ---------- */

export default function CustomAgentPage() {
  const [active, setActive] = useState<WorkflowId>("work");
  const [candKey, setCandKey] = useState(0);
  const runner = useRunner();
  const wf = WORKFLOWS.find((w) => w.id === active)!;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
      {/* Header */}
      <section className="relative overflow-hidden rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/[0.12] via-orange-500/[0.03] to-transparent p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-orange-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 text-lg font-black tracking-tight text-[#fff] shadow-lg shadow-orange-500/20">IN</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{INSUS.name}</h1>
              <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-orange-300">Custom Agent</span>
            </div>
            <p className="mt-0.5 text-sm font-medium italic text-orange-300">{INSUS.slogan}</p>
            <p lang="bn" className="mt-3 max-w-3xl text-[14px] leading-7 text-neutral-300">
              {INSUS.description}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["🇦🇺 Australia", "🇪🇺 Europe", "🕌 Middle East", "🌏 Asia"].map((t) => (
                <span key={t} className="rounded-full border border-white/10 bg-canvas/60 px-2.5 py-1 text-[11px] text-neutral-300">
                  {t}
                </span>
              ))}
              <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300">
                <IconShield width={11} height={11} /> Compliance-first
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Contact bar */}
      <section className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: IconMapPin, label: "Address", value: INSUS.address, href: INSUS.mapUrl, bn: true },
          { icon: IconPhone, label: "Phone", value: INSUS.phone, href: `tel:${INSUS.phoneIntl}` },
          { icon: IconMail, label: "Email", value: INSUS.email, href: `mailto:${INSUS.email}` },
          { icon: IconGlobe, label: "Web", value: INSUS.web, href: INSUS.webUrl },
        ].map((c) => (
          <a key={c.label} href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="flex items-start gap-3 rounded-xl border border-white/[0.07] p-3 transition hover:border-white/20 hover:bg-white/[0.02]">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-orange-500/10 text-orange-300">
              <c.icon width={15} height={15} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{c.label}</p>
              <p lang={c.bn ? "bn" : undefined} className={`text-[12.5px] leading-snug text-neutral-200 ${c.bn ? "" : "truncate"}`}>
                {c.value}
              </p>
            </div>
          </a>
        ))}
      </section>

      {/* Workflows */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-white">Automation workflows</h2>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" role="tablist">
          {WORKFLOWS.map((w, i) => (
            <button
              key={w.id}
              role="tab"
              aria-selected={active === w.id}
              onClick={() => setActive(w.id)}
              className={`rounded-xl border p-3 text-left transition sm:p-4 ${active === w.id ? "border-orange-500/50 bg-orange-500/[0.07] shadow-sm" : "border-white/[0.07] hover:border-white/20"}`}
            >
              <div className="flex items-center gap-2">
                <div className={`grid h-8 w-8 place-items-center rounded-lg ${active === w.id ? "bg-orange-500 text-[#fff]" : "bg-white/5 text-neutral-400"}`}>
                  <w.icon width={15} height={15} />
                </div>
                <span className="font-mono text-[10px] text-neutral-500">0{i + 1}</span>
              </div>
              <p className="mt-2.5 text-[13px] font-medium leading-snug text-white">
                <span className="sm:hidden">{w.short}</span>
                <span className="hidden sm:inline">{w.title}</span>
              </p>
              <p className="mt-0.5 hidden text-[11px] text-neutral-500 sm:block">{w.desc}</p>
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
          <div className="rounded-2xl border border-white/[0.07] p-4 sm:p-6">
            <div className="mb-5">
              <h3 className="text-base font-semibold text-white">{wf.title}</h3>
              <p className="mt-0.5 text-xs text-neutral-500">{wf.desc}</p>
            </div>
            {active === "work" && <WorkPermitForm runner={runner} onCandidateSaved={() => setCandKey((k) => k + 1)} />}
            {active === "visitor" && <VisitorForm runner={runner} />}
            {active === "residency" && <ResidencyForm runner={runner} />}
            {active === "tracking" && <TrackingForm runner={runner} />}
          </div>

          <aside className="space-y-6 lg:sticky lg:top-4 lg:self-start">
            <div>
              <p className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                INSUS runs <Link href="/automations" className="font-normal normal-case tracking-normal hover:text-white">All automations →</Link>
              </p>
              <ExecutionFeed query="source=insus" limit={10} refreshKey={runner.feedKey} emptyText="No INSUS workflows have run yet." />
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Candidate intake register</p>
              <CandidatesRegister refreshKey={candKey} />
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
