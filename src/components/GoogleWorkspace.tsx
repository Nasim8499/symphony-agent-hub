"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Field, Spinner, inputCls } from "./ui";
import { IconCheck, IconCloud, IconExternal, IconFile, IconRefresh, IconSearch } from "./icons";
import { api, timeAgo, type GoogleFile, type GoogleStatus } from "@/lib/bu-client";
import DocumentViewer from "./DocumentViewer";

/** Real-time Google Workspace skill surface: Drive search, file fetch and document export. */
export default function GoogleWorkspace() {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<GoogleFile[] | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await api<GoogleStatus>("/api/google?action=status");
      setStatus(s);
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // Returning from the OAuth redirect lands here with ?tab=workspace
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "1") setMsg({ ok: true, text: "Google Workspace connected." });
  }, [load]);

  const configure = async () => {
    setBusy("configure");
    setMsg(null);
    try {
      await api("/api/google", { method: "POST", body: { action: "configure", clientId, clientSecret } });
      setClientSecret("");
      setMsg({ ok: true, text: "OAuth client saved. Connect your account next." });
      await load();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const connect = async () => {
    setBusy("connect");
    setMsg(null);
    try {
      const r = await api<{ url: string }>("/api/google?action=connect");
      window.location.href = r.url;
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
      setBusy(null);
    }
  };

  const disconnect = async () => {
    if (!confirm("Disconnect Google Workspace from this dashboard?")) return;
    setBusy("disconnect");
    try {
      await api("/api/google?action=disconnect");
      setFiles(null);
      await load();
    } finally {
      setBusy(null);
    }
  };

  const search = async () => {
    setBusy("search");
    setMsg(null);
    try {
      const r = await api<{ files: GoogleFile[] }>(`/api/google?action=${query ? "search" : "list"}&q=${encodeURIComponent(query)}&limit=30`);
      setFiles(r.files);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
      setFiles([]);
    } finally {
      setBusy(null);
    }
  };

  const exportFile = (f: GoogleFile, kind: "pdf" | "docx" | "text" | "csv" | "xlsx") => {
    window.open(`/api/google?action=export&id=${encodeURIComponent(f.id)}&kind=${kind}&download=1`, "_blank");
  };

  return (
    <section className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.03] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-500/15 text-sky-300">
          <IconCloud width={18} height={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-white">Google Workspace</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-neutral-400">
            Real-time Drive search, file fetching and document export. Preview PDFs, Docs and Sheets in the in-dashboard viewer beside your running tasks.
          </p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium ${status?.connected ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-white/10 bg-white/5 text-neutral-400"}`}>
          {status?.connected ? "Connected" : status?.configured ? "Not connected" : "Not configured"}
        </span>
      </div>

      {!status ? (
        <div className="mt-4 flex items-center gap-2 text-xs text-neutral-500">
          <Spinner className="h-3 w-3" /> Loading Google status…
        </div>
      ) : status.connected ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 sm:flex-row sm:items-center">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-500/15 text-emerald-300">
              <IconCheck width={15} height={15} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-white">{status.email ?? "Google account"}</p>
              <p className="text-[11px] text-neutral-500">
                Drive, Docs, Sheets and Gmail read access
                {status.connectedAt ? ` · connected ${timeAgo(status.connectedAt)}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setViewerOpen(true)}>
                <IconFile width={13} height={13} /> Open viewer
              </Button>
              <Button size="sm" variant="ghost" onClick={connect} loading={busy === "connect"}>
                <IconRefresh width={13} height={13} /> Reconnect
              </Button>
              <button onClick={disconnect} className="rounded-lg px-2 text-xs text-neutral-500 hover:text-red-300">
                Disconnect
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <IconSearch width={15} height={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
                placeholder="Search Drive by name or content…"
                className={`${inputCls} pl-9`}
              />
            </div>
            <Button onClick={search} loading={busy === "search"}>
              <IconSearch width={14} height={14} /> Search
            </Button>
          </div>

          {files && (
            <div className="stagger divide-y divide-white/5 overflow-hidden rounded-xl border border-white/[0.07]">
              {files.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-neutral-500">No Drive files match that search.</p>
              ) : (
                files.slice(0, 12).map((f) => (
                  <div key={f.id} className="flex items-center gap-3 px-3.5 py-2.5">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-neutral-400">
                      <IconFile width={14} height={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-white">{f.name}</p>
                      <p className="truncate text-[11px] text-neutral-500">
                        {[f.owners[0], f.modifiedTime ? timeAgo(f.modifiedTime) : ""].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {f.mimeType.startsWith("application/vnd.google-apps") && (
                        <button onClick={() => exportFile(f, f.mimeType.includes("spreadsheet") ? "xlsx" : f.mimeType.includes("presentation") ? "pdf" : "docx")} className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-neutral-300 hover:bg-white/5">
                          Export
                        </button>
                      )}
                      <button onClick={() => exportFile(f, "pdf")} className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-neutral-300 hover:bg-white/5">
                        PDF
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="OAuth Client ID">
              <input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="1234.apps.googleusercontent.com" className={`${inputCls} font-mono text-[12px]`} />
            </Field>
            <Field label="OAuth Client Secret">
              <input value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} type="password" placeholder="GOCSPX-••••••••" className={`${inputCls} font-mono text-[12px]`} />
            </Field>
          </div>
          <p className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-[11px] leading-relaxed text-neutral-500">
            In Google Cloud Console create an <span className="text-neutral-300">OAuth client → Web application</span> and add this redirect URI:{" "}
            <code className="font-mono text-sky-300">{typeof window !== "undefined" ? `${window.location.origin}/api/google/callback` : "/api/google/callback"}</code>
            . Enable the Drive, Docs, Sheets and Gmail APIs for the project.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            {(!status.configured || clientId || clientSecret) && (
              <Button onClick={configure} loading={busy === "configure"} disabled={(!clientId && !clientSecret) || (!clientId && !status.configured)}>
                Save OAuth client
              </Button>
            )}
            <Button variant={status.configured ? "primary" : "secondary"} onClick={connect} loading={busy === "connect"} disabled={!status.configured && !clientId}>
              <IconExternal width={13} height={13} /> Connect Google account
            </Button>
          </div>
        </div>
      )}

      {msg && <p className={`mt-3 text-xs ${msg.ok ? "text-emerald-300" : "text-red-300"}`}>{msg.text}</p>}

      <DocumentViewer open={viewerOpen} onClose={() => setViewerOpen(false)} />
    </section>
  );
}
