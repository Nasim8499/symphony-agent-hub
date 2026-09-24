"use client";

import { useCallback, useEffect, useState } from "react";
import { AutomationEditor, ExecutionFeed } from "@/components/automation-ui";
import { Button, EmptyState, ErrorBox, PageHeader, Spinner, Toggle } from "@/components/ui";
import { IconBolt, IconBriefcase, IconCalendar, IconClock, IconLayers, IconPlay, IconPlus, IconRefresh, IconTrash } from "@/components/icons";
import { api, modelLabel, scheduleLabel, timeAgo, timeUntil, type Automation, type Execution } from "@/lib/bu-client";

const SOURCES = [
  { id: "all", label: "All" },
  { id: "insus", label: "INSUS" },
  { id: "tasker", label: "Tasker" },
  { id: "manual", label: "Manual" },
];

export default function AutomationsPage() {
  const [list, setList] = useState<Automation[] | null>(null);
  const [stats, setStats] = useState<{ running: number; completed: number; failed: number } | null>(null);
  const [source, setSource] = useState("all");
  const [editing, setEditing] = useState<Automation | "new" | null>(null);
  const [runningId, setRunningId] = useState<number | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [feedKey, setFeedKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [a, e] = await Promise.all([api<{ automations: Automation[] }>("/api/automations"), api<{ executions: Execution[] }>("/api/executions?limit=100")]);
      setList(a.automations);
      const since = Date.now() - 86400000;
      const recent = e.executions.filter((x) => new Date(x.createdAt).getTime() > since);
      setStats({
        running: e.executions.filter((x) => !["completed", "failed", "cancelled"].includes(x.status)).length,
        completed: recent.filter((x) => x.status === "completed").length,
        failed: recent.filter((x) => x.status === "failed").length,
      });
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const runNow = async (a: Automation) => {
    setRunningId(a.id);
    setFlash(null);
    try {
      const r = await api<{ dispatched: number; failed: number; error?: string }>(`/api/automations/${a.id}/run`, { method: "POST" });
      setFlash(r.dispatched ? { ok: true, text: `“${a.name}” dispatched ${r.dispatched} run${r.dispatched === 1 ? "" : "s"}${r.failed ? ` · ${r.failed} failed` : ""}.` } : { ok: false, text: r.error ?? "Dispatch failed" });
      setFeedKey((k) => k + 1);
      load();
    } catch (e) {
      setFlash({ ok: false, text: (e as Error).message });
    } finally {
      setRunningId(null);
    }
  };

  const toggle = async (a: Automation, enabled: boolean) => {
    setList((l) => l?.map((x) => (x.id === a.id ? { ...x, enabled } : x)) ?? null);
    await api(`/api/automations/${a.id}`, { method: "PATCH", body: { enabled } }).catch(() => {});
    load();
  };

  const del = async (a: Automation) => {
    if (!confirm(`Delete automation “${a.name}”?`)) return;
    await api(`/api/automations/${a.id}`, { method: "DELETE" });
    load();
  };

  const filtered = (list ?? []).filter((a) => source === "all" || a.source === source);
  const scheduled = (list ?? []).filter((a) => a.enabled && a.scheduleType !== "manual");

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
      <PageHeader
        title="All Automations & Tasks"
        description="One runner for every scheduled and manual routine — INSUS workflows, Tasker batches and saved agent tasks."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => { load(); setFeedKey((k) => k + 1); }}>
              <IconRefresh width={14} height={14} /> Refresh
            </Button>
            <Button size="sm" onClick={() => setEditing("new")}>
              <IconPlus width={14} height={14} /> New automation
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: "Automations", value: list?.length ?? "—", icon: IconLayers },
          { label: "Active schedules", value: scheduled.length, icon: IconCalendar },
          { label: "Running now", value: stats?.running ?? "—", icon: IconClock, live: (stats?.running ?? 0) > 0 },
          { label: "Completed · 24h", value: stats ? `${stats.completed}${stats.failed ? ` / ${stats.failed} failed` : ""}` : "—", icon: IconBolt },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/[0.07] p-3.5">
            <div className="flex items-center gap-2 text-[11px] text-neutral-500">
              <s.icon width={13} height={13} /> {s.label}
              {s.live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-400" />}
            </div>
            <p className="mt-1.5 text-lg font-semibold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {flash && <div className={`mb-4 rounded-xl border px-4 py-2.5 text-sm ${flash.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>{flash.text}</div>}
      {error && <ErrorBox error={error} />}

      <div className="mb-3 flex items-center gap-1 overflow-x-auto">
        {SOURCES.map((s) => (
          <button key={s.id} onClick={() => setSource(s.id)} className={`h-7 shrink-0 rounded-full border px-3 text-xs ${source === s.id ? "border-orange-500/40 bg-orange-500/15 text-orange-300" : "border-white/10 text-neutral-400 hover:text-white"}`}>
            {s.label}
          </button>
        ))}
      </div>

      {!list ? (
        <div className="flex items-center gap-2 py-8 text-sm text-neutral-500">
          <Spinner /> Loading automations…
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<IconLayers />}
          title="No automations here yet"
          description="Create one here, build a batch in the Tasker Engine, or save an INSUS workflow as a scheduled routine."
          action={<Button size="sm" onClick={() => setEditing("new")}>New automation</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {filtered.map((a) => (
            <div key={a.id} className={`rounded-xl border p-4 transition ${a.enabled ? "border-white/[0.08]" : "border-white/[0.05] opacity-70"}`}>
              <div className="flex items-start gap-3">
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${a.source === "insus" ? "bg-orange-500/15 text-orange-300" : "bg-white/5 text-neutral-300"}`}>
                  {a.source === "insus" ? <IconBriefcase width={16} height={16} /> : a.kind === "skill" ? <IconBolt width={16} height={16} /> : <IconLayers width={16} height={16} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-medium text-white">{a.name}</p>
                    <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-neutral-400">{a.source}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-neutral-500">{a.description || (a.kind === "skill" ? `Skill ${a.skillId?.slice(0, 8)}` : a.template)}</p>
                </div>
                <div className="w-11 shrink-0">
                  <Toggle checked={a.enabled} onChange={(v) => toggle(a, v)} label="" />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-neutral-500">
                <span className="flex items-center gap-1">
                  <IconCalendar width={11} height={11} /> {scheduleLabel(a)}
                </span>
                {a.enabled && a.nextRunAt && <span className="text-orange-300">Next {timeUntil(a.nextRunAt)}</span>}
                <span>{a.batch.length || 1} row{(a.batch.length || 1) === 1 ? "" : "s"}</span>
                <span>{a.kind === "skill" ? "skill" : modelLabel(a.model)}</span>
                <span>{a.runCount} runs</span>
                {a.lastRunAt && <span>Last {timeAgo(a.lastRunAt)}</span>}
              </div>
              <div className="mt-3 flex gap-2 border-t border-white/5 pt-3">
                <Button size="sm" onClick={() => runNow(a)} loading={runningId === a.id} className="flex-1 sm:flex-none">
                  {runningId !== a.id && <IconPlay width={11} height={11} />} Run now
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setEditing(a)}>
                  Edit
                </Button>
                <button onClick={() => del(a)} className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-red-500/10 hover:text-red-300" aria-label="Delete">
                  <IconTrash width={13} height={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-10">
        <h2 className="mb-3 text-sm font-semibold text-white">Execution log & live previews</h2>
        <ExecutionFeed query={source === "all" ? "" : `source=${source}`} refreshKey={feedKey} limit={40} emptyText="Nothing has run yet. Hit “Run now” on an automation." />
      </div>

      {editing && (
        <AutomationEditor
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async (a, runNowFlag) => {
            setEditing(null);
            await load();
            if (runNowFlag) runNow(a);
          }}
        />
      )}
    </div>
  );
}
