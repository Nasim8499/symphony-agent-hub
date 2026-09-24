"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Composer, { type ComposerPayload } from "@/components/Composer";
import EventItem, { findLiveUrl, isVisibleEvent } from "@/components/EventItem";
import { refreshSessions } from "@/components/AppShell";
import { ErrorBox, Spinner, StatusBadge } from "@/components/ui";
import { IconCheck, IconCopy, IconExternal, IconEye, IconFile, IconGlobe, IconMonitor, IconTrash, IconChat, IconSpark } from "@/components/icons";
import DocumentViewer from "@/components/DocumentViewer";
import { api, ApiError, bu, dispatchAgent, isDeepseekModel, modelLabel, TERMINAL, type Execution, type RunEvent, type RunEventsResponse, type RunStatus, type RunSummary } from "@/lib/bu-client";

async function fetchAllEvents(runId: string, after = 0) {
  const all: RunEvent[] = [];
  let cursor = after;
  for (let i = 0; i < 20; i++) {
    const page = await bu<RunEventsResponse>(`v4/runs/${runId}/events?after=${cursor}&limit=200`);
    all.push(...(page.events ?? []));
    if (page.nextAfter != null) cursor = page.nextAfter;
    else if (page.events?.length) cursor = page.events[page.events.length - 1].id;
    if (!page.hasMore) break;
  }
  return { events: all, cursor };
}

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [events, setEvents] = useState<Record<string, RunEvent[]>>({});
  const cursors = useRef<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string | undefined>();
  const [plans, setPlans] = useState<Record<string, Execution>>({});
  const [tab, setTab] = useState<"chat" | "browser">("chat");
  const [interactive, setInteractive] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadRunEvents = useCallback(async (runId: string) => {
    const { events: ev, cursor } = await fetchAllEvents(runId, cursors.current[runId] ?? 0);
    cursors.current[runId] = cursor;
    if (ev.length) {
      setEvents((prev) => {
        const existing = prev[runId] ?? [];
        const seen = new Set(existing.map((e) => e.id));
        return { ...prev, [runId]: [...existing, ...ev.filter((e) => !seen.has(e.id))] };
      });
    }
  }, []);

  const loadRuns = useCallback(async () => {
    const r = await bu<{ runs: RunSummary[] }>(`v4/runs?sessionId=${id}&limit=50`);
    let list = [...(r.runs ?? [])];
    const wanted = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("run") : null;
    if (wanted && !list.some((x) => x.id === wanted)) {
      try {
        list.push(await bu<RunSummary>(`v4/runs/${wanted}`));
      } catch {}
    }
    list = list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    setRuns(list);
    return list;
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    cursors.current = {};
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEvents({});
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const list = await loadRuns();
        await Promise.all(list.map((r) => loadRunEvents(r.id).catch(() => {})));
      } catch (e) {
        if (!cancelled) setError(e as ApiError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, loadRuns, loadRunEvents]);

  const activeRun = runs.find((r) => !TERMINAL.includes(r.status));

  useEffect(() => {
    api<{ executions: Execution[] }>(`/api/executions?sessionId=${id}&limit=100`)
      .then((r) => {
        const map: Record<string, Execution> = {};
        for (const e of r.executions) if (e.runId) map[e.runId] = e;
        setPlans(map);
      })
      .catch(() => {});
  }, [id, runs.length]);

  // Poll active run
  useEffect(() => {
    if (!activeRun) return;
    let stop = false;
    const tick = async () => {
      try {
        const s = await bu<{ status: RunStatus }>(`v4/runs/${activeRun.id}/status`);
        await loadRunEvents(activeRun.id);
        if (TERMINAL.includes(s.status)) {
          await loadRunEvents(activeRun.id);
          const full = await bu<RunSummary>(`v4/runs/${activeRun.id}`);
          setRuns((prev) => prev.map((r) => (r.id === full.id ? full : r)));
          refreshSessions();
          return;
        } else if (s.status !== activeRun.status) {
          setRuns((prev) => prev.map((r) => (r.id === activeRun.id ? { ...r, status: s.status } : r)));
        }
      } catch {}
      if (!stop) timer = setTimeout(tick, 2500);
    };
    let timer = setTimeout(tick, 1200);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [activeRun, loadRunEvents]);

  const totalEvents = Object.values(events).reduce((a, e) => a + e.length, 0);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [totalEvents, runs.length]);

  const latest = runs[runs.length - 1];
  const liveUrl = latest ? findLiveUrl(events[latest.id] ?? []) : null;
  const browserLive = Boolean(liveUrl && activeRun);

  const followUp = async (p: ComposerPayload) => {
    setBusy(true);
    setBusyLabel(isDeepseekModel(p.model) ? "DeepSeek is planning…" : undefined);
    setActionError(null);
    try {
      try {
        const r = await dispatchAgent({ task: p.task, model: p.model, executorModel: p.executorModel, sessionId: id, source: "manual" });
        window.history.replaceState(null, "", `/sessions/${id}?run=${r.runId}`);
      } catch (e) {
        if ((e as ApiError).status === 409) {
          await bu(`v4/sessions/${id}/queue`, { method: "POST", body: { text: p.task } });
        } else throw e;
      }
      await loadRuns();
      refreshSessions();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
      setBusyLabel(undefined);
    }
  };

  const cancel = async () => {
    if (!activeRun) return;
    try {
      await bu(`v4/runs/${activeRun.id}/cancel`, { method: "POST" });
      setRuns((prev) => prev.map((r) => (r.id === activeRun.id ? { ...r, status: "cancelled" } : r)));
      refreshSessions();
    } catch (e) {
      setActionError((e as Error).message);
    }
  };

  const share = async () => {
    try {
      const s = await bu<{ shareUrl: string }>(`v4/sessions/${id}/share`, { method: "POST" });
      await navigator.clipboard.writeText(s.shareUrl).catch(() => {});
      setCopied("share");
      setTimeout(() => setCopied(null), 2000);
    } catch (e) {
      setActionError((e as Error).message);
    }
  };

  const del = async () => {
    if (!confirm("Delete this session? It can no longer be opened or continued.")) return;
    try {
      await bu(`v4/sessions/${id}`, { method: "DELETE" });
      refreshSessions();
      router.push("/");
    } catch (e) {
      setActionError((e as Error).message);
    }
  };

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const totalCost = runs.reduce((a, r) => a + (parseFloat(r.totalCostUsd) || 0), 0);
  const title = runs[0]?.title || runs[0]?.task || "Session";

  if (error) {
    return (
      <div className="mx-auto max-w-2xl p-4 sm:p-8">
        <ErrorBox error={error} />
      </div>
    );
  }

  const browserPanel = (
    <div className="flex h-full flex-col p-3 sm:p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-1.5">
          <span className={`h-2 w-2 shrink-0 rounded-full ${browserLive ? "animate-pulse bg-emerald-400" : "bg-neutral-600"}`} />
          <span className="truncate font-mono text-[11px] text-neutral-500">{browserLive ? "live.browser-use.com" : "Browser idle"}</span>
        </div>
        {browserLive && (
          <>
            <button
              onClick={() => setInteractive((v) => !v)}
              className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs ${interactive ? "border-orange-500/40 bg-orange-500/15 text-orange-200" : "border-white/10 text-neutral-300 hover:bg-white/5"}`}
              title="Take control of the browser"
            >
              <IconEye width={13} height={13} /> {interactive ? "Controlling" : "Take over"}
            </button>
            <a href={liveUrl!} target="_blank" rel="noreferrer" className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-neutral-300 hover:bg-white/5" title="Open in new tab">
              <IconExternal width={13} height={13} />
            </a>
          </>
        )}
      </div>
      <div className="relative min-h-[260px] flex-1 overflow-hidden rounded-xl border border-white/10 bg-sunken">
        {browserLive ? (
          <div className="absolute inset-0" {...(interactive ? {} : { inert: true })}>
            <iframe
              src={liveUrl!}
              title="Live browser"
              allow="autoplay; clipboard-read; clipboard-write"
              className="h-full w-full border-0"
              style={{ pointerEvents: interactive ? "auto" : "none" }}
            />
          </div>
        ) : (
          <div className="grid-bg absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/5 text-neutral-400">
              {activeRun ? <Spinner className="h-5 w-5" /> : <IconMonitor />}
            </div>
            <p className="text-sm font-medium text-neutral-300">{activeRun ? "Starting cloud browser…" : "Browser session ended"}</p>
            <p className="mt-1 max-w-xs text-xs text-neutral-500">
              {activeRun ? "The live view appears once the browser is ready." : "Send a follow-up to spin up the browser again with full conversation context."}
            </p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-white/5 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-white">{title}</h1>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-neutral-500">
            {latest && <StatusBadge status={latest.status} />}
            <span className="hidden sm:inline">{runs.length} run{runs.length === 1 ? "" : "s"}</span>
            <span>${totalCost.toFixed(4)}</span>
          </div>
        </div>
        <button onClick={() => setViewerOpen(true)} className="flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 text-xs text-neutral-300 transition press hover:bg-white/5" title="Inspect outputs and documents" aria-label="Open document viewer">
          <IconFile width={13} height={13} />
          <span className="hidden sm:inline">Docs</span>
        </button>
        <button onClick={share} className="flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 text-xs text-neutral-300 hover:bg-white/5">
          {copied === "share" ? <IconCheck width={13} height={13} /> : <IconExternal width={13} height={13} />}
          <span className="hidden sm:inline">{copied === "share" ? "Link copied" : "Share"}</span>
        </button>
        <button onClick={del} className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-neutral-400 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300" title="Delete session">
          <IconTrash width={13} height={13} />
        </button>
      </div>

      {/* Mobile tabs */}
      <div className="flex shrink-0 gap-1 border-b border-white/5 p-1.5 lg:hidden">
        {(["chat", "browser"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-medium capitalize ${tab === t ? "bg-white/10 text-white" : "text-neutral-500"}`}
          >
            {t === "chat" ? <IconChat width={13} height={13} /> : <IconGlobe width={13} height={13} />} {t}
            {t === "browser" && browserLive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Chat */}
        <div className={`min-h-0 flex-col border-white/5 lg:flex lg:w-[46%] lg:max-w-[620px] lg:border-r ${tab === "chat" ? "flex w-full" : "hidden"}`}>
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {loading && (
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <Spinner /> Loading session…
              </div>
            )}
            {runs.map((run) => {
              const ev = (events[run.id] ?? []).filter(isVisibleEvent);
              return (
                <div key={run.id} className="mb-6">
                  <div className="mb-4 flex justify-end">
                    <div className="max-w-[88%] rounded-2xl rounded-tr-md bg-white/[0.07] px-4 py-2.5 text-[14px] text-white">
                      <p className="prose-result">{run.task}</p>
                    </div>
                  </div>
                  <div className="mb-2 flex items-center gap-2 text-[11px] text-neutral-500">
                    <IconSpark width={12} height={12} className="text-orange-400" />
                    <span>{modelLabel(run.model)}</span>
                    <span>·</span>
                    <StatusBadge status={run.status} />
                  </div>
                  {plans[run.id]?.plan && (
                    <details className="mb-3 rounded-xl border border-sky-500/20 bg-sky-500/[0.05] p-3" open={!TERMINAL.includes(run.status)}>
                      <summary className="flex cursor-pointer list-none items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-sky-300">
                        <IconSpark width={12} height={12} /> Plan by {modelLabel(plans[run.id].plannerModel ?? "")}
                        <span className="ml-auto font-normal normal-case tracking-normal text-neutral-500">executor: {modelLabel(plans[run.id].executorModel ?? run.model)}</span>
                      </summary>
                      <p className="prose-result mt-2 text-[13px] leading-relaxed text-neutral-300">{plans[run.id].plan}</p>
                    </details>
                  )}
                  <div className="pl-0.5">
                    {ev.map((e) => (
                      <EventItem key={`${run.id}-${e.id}`} event={e} />
                    ))}
                    {!TERMINAL.includes(run.status) && (
                      <div className="flex items-center gap-2 py-2 text-xs text-neutral-500">
                        <Spinner className="h-3 w-3" /> Agent is working…
                      </div>
                    )}
                  </div>
                  {run.result && (
                    <div className="mt-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[11px] font-medium uppercase tracking-wider text-emerald-400">Result</span>
                        <button onClick={() => copy(run.result!, run.id)} className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white">
                          {copied === run.id ? <IconCheck width={12} height={12} /> : <IconCopy width={12} height={12} />} Copy
                        </button>
                      </div>
                      <p className="prose-result text-[14px] leading-relaxed text-neutral-100">{run.result}</p>
                    </div>
                  )}
                  {run.error && <div className="mt-2 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3 text-sm text-red-300">{run.error}</div>}
                  {TERMINAL.includes(run.status) && (
                    <p className="mt-2 font-mono text-[10px] text-neutral-600">
                      {run.totalInputTokens.toLocaleString()} in · {run.totalOutputTokens.toLocaleString()} out · ${parseFloat(run.totalCostUsd || "0").toFixed(4)}
                    </p>
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
          <div className="shrink-0 border-t border-white/5 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {actionError && <p className="mb-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">{actionError}</p>}
            <Composer
              followUp
              onSubmit={followUp}
              busy={busy}
              busyLabel={busyLabel}
              running={Boolean(activeRun)}
              onStop={cancel}
              placeholder={activeRun ? "Agent is running — press stop to cancel" : "Send a follow-up…"}
            />
          </div>
        </div>

        {/* Browser */}
        <div className={`min-h-0 flex-1 lg:block ${tab === "browser" ? "block" : "hidden"}`}>{browserPanel}</div>
      </div>

      <DocumentViewer open={viewerOpen} onClose={() => setViewerOpen(false)} sessionId={id} refreshKey={runs.length} />
    </div>
  );
}
