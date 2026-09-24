"use client";

import { useCallback, useEffect, useState } from "react";
import { IconChevron, IconExternal, IconFile, IconRefresh, IconSearch, IconX } from "./icons";
import { Spinner, inputCls } from "./ui";
import { api, prettySize, timeAgo, type GoogleFile, type GoogleStatus, type WorkspaceArtifact } from "@/lib/bu-client";

type Tab = "files" | "artifacts";

/** In-dashboard real-time PDF / document viewer — inspects files and run outputs beside running tasks. */
export default function DocumentViewer({
  open,
  onClose,
  sessionId,
  refreshKey = 0,
}: {
  open: boolean;
  onClose: () => void;
  sessionId?: string;
  refreshKey?: number;
}) {
  const [tab, setTab] = useState<Tab>("artifacts");
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [files, setFiles] = useState<GoogleFile[] | null>(null);
  const [artifacts, setArtifacts] = useState<WorkspaceArtifact[] | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<WorkspaceArtifact | null>(null);
  const [docText, setDocText] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [loadingDoc, setLoadingDoc] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await api<GoogleStatus>("/api/workspace?action=status"));
    } catch {
      setStatus(null);
    }
  }, []);

  const loadArtifacts = useCallback(async () => {
    try {
      if (sessionId) {
        const r = await api<{ files: WorkspaceArtifact[] }>(`/api/workspace?action=session-files&sessionId=${encodeURIComponent(sessionId)}`);
        setArtifacts(r.files.map((f) => ({ ...f, source: "task" as const })));
      } else {
        const r = await api<{ recentArtifacts: { id: number; label: string | null; task: string | null; status: string; sessionId: string | null; runId: string | null; result: string | null; createdAt: string }[] }>(
          "/api/workspace?action=status",
        );
        setArtifacts(
          r.recentArtifacts
            .filter((a) => a.result)
            .map((a) => ({
              id: a.id,
              name: a.label || a.task?.slice(0, 60) || `Run ${a.id}`,
              kind: "text" as const,
              content: a.result ?? "",
              status: a.status,
              createdAt: a.createdAt,
              source: "task" as const,
              sessionId: a.sessionId,
              runId: a.runId,
            })),
        );
      }
    } catch {
      setArtifacts([]);
    }
  }, [sessionId]);

  const search = useCallback(
    async (q: string) => {
      setBusy(true);
      setError(null);
      try {
        const r = await api<{ files: GoogleFile[] }>(`/api/workspace?action=${q ? "search" : "list"}&q=${encodeURIComponent(q)}&limit=40`);
        setFiles(r.files);
      } catch (e) {
        setError((e as Error).message);
        setFiles([]);
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStatus();
     
    loadArtifacts();
  }, [open, loadStatus, loadArtifacts, refreshKey]);

  useEffect(() => {
    if (!open || tab !== "files" || files !== null) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    search("");
  }, [open, tab, files, search]);

  // Load Google Doc / Sheet text into the viewer.
  const openFile = useCallback(async (f: GoogleFile) => {
    setActive({ id: f.id, name: f.name, kind: "doc", url: `/api/workspace?action=export&id=${encodeURIComponent(f.id)}&kind=pdf`, source: "google" });
    setDocText(null);
    setZoom(1);
    if (f.mimeType.includes("document")) {
      setLoadingDoc(true);
      try {
        const r = await api<{ title: string; text: string }>(`/api/workspace?action=doc&id=${encodeURIComponent(f.id)}`);
        setDocText(r.text);
      } catch (e) {
        setDocText(`Could not read document: ${(e as Error).message}`);
      } finally {
        setLoadingDoc(false);
      }
    } else if (f.mimeType.includes("spreadsheet")) {
      setLoadingDoc(true);
      try {
        const r = await api<{ title: string; rows: string[][] }>(`/api/workspace?action=sheet&id=${encodeURIComponent(f.id)}`);
        setDocText(r.rows.map((row) => row.join(" | ")).join("\n") || "(empty sheet)");
      } catch (e) {
        setDocText(`Could not read sheet: ${(e as Error).message}`);
      } finally {
        setLoadingDoc(false);
      }
    }
  }, []);

  const openArtifact = (a: WorkspaceArtifact) => {
    setActive(a);
    setZoom(1);
    if (a.kind === "text") setDocText(a.content ?? "");
  };

  // Ctrl/⌘+wheel is trapped here so the global viewport stays locked while documents zoom.
  const onWheel = useCallback((e: React.WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    setZoom((z) => Math.min(2.5, Math.max(0.5, z - e.deltaY * 0.0015)));
  }, []);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (active) setActive(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, active, onClose]);

  if (!open) return null;

  const isPdf = active ? active.kind === "pdf" || (active.url?.includes("kind=pdf") ?? false) : false;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/50 backdrop-blur-sm fade-in" onClick={onClose}>
      <div className="flex h-full w-full max-w-3xl flex-col border-l border-white/10 bg-panel shadow-2xl slide-up sm:slide-up" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-white/[0.07] px-3 sm:px-4">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-orange-500/15 text-orange-300">
            <IconFile width={15} height={15} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{active ? active.name : "Document viewer"}</p>
            <p className="truncate text-[11px] text-neutral-500">
              {active
                ? active.source === "google"
                  ? "Google Workspace"
                  : active.status
                    ? `Task output · ${active.status}`
                    : "Task output"
                : "Inspect files, reports and run outputs beside your tasks"}
            </p>
          </div>
          {active && (
            <>
              {active.url && (
                <>
                  <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))} className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-neutral-300 hover:bg-white/5" aria-label="Zoom out">
                    <span className="text-base leading-none">−</span>
                  </button>
                  <span className="w-10 text-center font-mono text-[11px] text-neutral-400">{Math.round(zoom * 100)}%</span>
                  <button onClick={() => setZoom((z) => Math.min(2.5, z + 0.1))} className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-neutral-300 hover:bg-white/5" aria-label="Zoom in">
                    <span className="text-base leading-none">+</span>
                  </button>
                  <a href={`${active.url}${active.url.includes("?") ? "&" : "?"}download=1`} className="hidden h-8 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 text-xs text-neutral-300 hover:bg-white/5 sm:inline-flex">
                    Download
                  </a>
                  <a href={active.url} target="_blank" rel="noreferrer" className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-neutral-300 hover:bg-white/5" aria-label="Open in new tab">
                    <IconExternal width={13} height={13} />
                  </a>
                </>
              )}
              <button onClick={() => setActive(null)} className="grid h-8 w-8 place-items-center rounded-lg text-neutral-400 hover:bg-white/5 hover:text-white" aria-label="Close document">
                <IconChevron width={16} height={16} className="rotate-90" />
              </button>
            </>
          )}
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-neutral-400 hover:bg-white/5 hover:text-white" aria-label="Close viewer">
            <IconX width={16} height={16} />
          </button>
        </div>

        {/* Body */}
        {active ? (
          <div className="min-h-0 flex-1 overflow-hidden doc-frame" onWheel={onWheel}>
            {isPdf && active.url ? (
              <iframe
                key={active.url}
                src={`${active.url}#zoom=${Math.round(zoom * 100)}`}
                title={active.name}
                className="h-full w-full border-0 bg-white"
              />
            ) : active.kind === "image" && active.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={active.url} alt={active.name} style={{ transform: `scale(${zoom})` }} className="mx-auto h-full object-contain p-4 transition-transform" />
            ) : loadingDoc ? (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-neutral-500">
                <Spinner /> Loading document…
              </div>
            ) : (
              <div className="scroll-thin h-full overflow-auto p-4 sm:p-6">
                <pre className="prose-result whitespace-pre-wrap font-mono text-[12.5px] leading-relaxed text-neutral-300" style={{ fontSize: `${12.5 * zoom}px` }}>
                  {docText || "(no preview available)"}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 gap-1 border-b border-white/[0.07] px-2 pt-2">
              {(
                [
                  ["artifacts", "Task outputs"],
                  ["files", "Google Drive"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`-mb-px border-b-2 px-3 py-2 text-xs font-medium transition ${tab === id ? "border-orange-400 text-white" : "border-transparent text-neutral-500 hover:text-neutral-300"}`}
                >
                  {label}
                </button>
              ))}
              <button onClick={() => (tab === "files" ? search(query) : loadArtifacts())} className="ml-auto mb-1 grid h-8 w-8 place-items-center rounded-lg text-neutral-400 hover:bg-white/5 hover:text-white" aria-label="Refresh">
                <IconRefresh width={14} height={14} />
              </button>
            </div>

            {tab === "files" && (
              <>
                <div className="shrink-0 p-3">
                  <div className="relative">
                    <IconSearch width={15} height={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && search(query)}
                      placeholder="Search Google Drive…"
                      className={`${inputCls} pl-9`}
                    />
                  </div>
                  {status && !status.connected && (
                    <p className="mt-2 rounded-lg border border-orange-500/25 bg-orange-500/[0.07] px-3 py-2 text-[11.5px] leading-relaxed text-orange-200">
                      Google Workspace is not connected.{" "}
                      <a href="/settings/api-keys?tab=workspace" className="underline">
                        Connect it in Settings
                      </a>{" "}
                      to search Drive, export files and preview documents here.
                    </p>
                  )}
                  {error && <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-[11.5px] text-red-300">{error}</p>}
                </div>
                <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-3 pb-3">
                  {busy && !files ? (
                    <div className="flex items-center gap-2 px-1 py-4 text-sm text-neutral-500">
                      <Spinner /> Loading Drive files…
                    </div>
                  ) : (files ?? []).length === 0 ? (
                    <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-neutral-500">
                      {status?.connected ? "No files match that search." : "Connect Google Workspace to browse Drive files."}
                    </p>
                  ) : (
                    <div className="stagger divide-y divide-white/5 overflow-hidden rounded-xl border border-white/[0.07]">
                      {(files ?? []).map((f) => (
                        <button key={f.id} onClick={() => openFile(f)} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-white/[0.03]">
                          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-neutral-400">
                            <IconFile width={14} height={14} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] text-white">{f.name}</p>
                            <p className="truncate text-[11px] text-neutral-500">
                              {[f.owners[0], prettySize(f.size), f.modifiedTime ? timeAgo(f.modifiedTime) : ""].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {tab === "artifacts" && (
              <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
                {!artifacts ? (
                  <div className="flex items-center gap-2 px-1 py-4 text-sm text-neutral-500">
                    <Spinner /> Loading task outputs…
                  </div>
                ) : artifacts.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-neutral-500">
                    {sessionId ? "No outputs for this session yet." : "Run a task and its result will appear here for review."}
                  </p>
                ) : (
                  <div className="stagger space-y-2">
                    {artifacts.map((a) => (
                      <button key={a.id} onClick={() => openArtifact(a)} className="lift block w-full rounded-xl border border-white/[0.07] p-3 text-left hover:border-white/20">
                        <div className="flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${a.status === "completed" ? "bg-emerald-400" : a.status === "failed" ? "bg-red-400" : "bg-orange-400"}`} />
                          <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-white">{a.name}</p>
                          {a.createdAt && <span className="shrink-0 text-[10px] text-neutral-500">{timeAgo(a.createdAt)}</span>}
                        </div>
                        {a.content && <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-neutral-400">{a.content}</p>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
