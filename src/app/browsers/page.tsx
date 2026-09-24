"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, EmptyState, ErrorBox, Field, Modal, PageHeader, Spinner, StatusBadge, Toggle, inputCls } from "@/components/ui";
import { IconCheck, IconCopy, IconExternal, IconGlobe, IconPlus, IconRefresh, IconStop, IconMonitor } from "@/components/icons";
import { ApiError, bu, COUNTRIES, timeAgo, type BrowserSession, type Paged, type Profile } from "@/lib/bu-client";

export default function BrowsersPage() {
  const [data, setData] = useState<Paged<BrowserSession> | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "stopped">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [viewing, setViewing] = useState<BrowserSession | null>(null);
  const [stopping, setStopping] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = filter === "all" ? "" : `&filterBy=${filter}`;
      setData(await bu<Paged<BrowserSession>>(`v4/browsers?pageSize=50&pageNumber=1${q}`));
      setError(null);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const stop = async (id: string) => {
    setStopping(id);
    try {
      await bu(`v4/browsers/${id}`, { method: "PATCH", body: { action: "stop" } });
      await load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setStopping(null);
    }
  };

  const items = data?.items ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        title="Cloud Browsers"
        description="Stealth Chromium sessions you can drive over CDP with Playwright, Puppeteer or Selenium."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={load}>
              <IconRefresh width={14} height={14} /> Refresh
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <IconPlus width={14} height={14} /> New browser
            </Button>
          </>
        }
      />

      <div className="mb-4 flex gap-1 rounded-lg border border-white/5 bg-white/[0.02] p-1 sm:w-fit">
        {(["all", "active", "stopped"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`h-7 flex-1 rounded-md px-3 text-xs capitalize sm:flex-none ${filter === f ? "bg-white/10 text-white" : "text-neutral-500 hover:text-neutral-300"}`}>
            {f}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorBox error={error} />
      ) : loading && !data ? (
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Spinner /> Loading browsers…
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={<IconGlobe />} title="No browser sessions" description="Launch a cloud browser and connect to it from your code via CDP." action={<Button size="sm" onClick={() => setCreateOpen(true)}>Launch browser</Button>} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/5">
          <div className="hidden grid-cols-[1.4fr_0.8fr_1fr_0.8fr_auto] gap-4 border-b border-white/5 bg-white/[0.02] px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-neutral-500 md:grid">
            <span>Session</span>
            <span>Status</span>
            <span>Started</span>
            <span>Cost</span>
            <span className="w-40 text-right">Actions</span>
          </div>
          {items.map((b) => {
            const cost = (parseFloat(b.browserCost) || 0) + (parseFloat(b.proxyCost) || 0);
            return (
              <div key={b.id} className="grid grid-cols-1 gap-2 border-b border-white/5 px-4 py-3 last:border-0 hover:bg-white/[0.02] md:grid-cols-[1.4fr_0.8fr_1fr_0.8fr_auto] md:items-center md:gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-neutral-400">
                    <IconMonitor width={14} height={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-white">{b.id}</p>
                    <p className="text-[11px] text-neutral-500">{parseFloat(b.proxyUsedMb || "0").toFixed(1)} MB proxy</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 md:block">
                  <StatusBadge status={b.status} />
                  <span className="text-[11px] text-neutral-500 md:hidden">· {timeAgo(b.startedAt)} · ${cost.toFixed(4)}</span>
                </div>
                <span className="hidden text-xs text-neutral-400 md:block">{timeAgo(b.startedAt)}</span>
                <span className="hidden font-mono text-xs text-neutral-400 md:block">${cost.toFixed(4)}</span>
                <div className="flex gap-2 md:w-40 md:justify-end">
                  <Button variant="secondary" size="sm" onClick={() => setViewing(b)} className="flex-1 md:flex-none">
                    {b.status === "active" ? "Connect" : "Details"}
                  </Button>
                  {b.status === "active" && (
                    <Button variant="danger" size="sm" loading={stopping === b.id} onClick={() => stop(b.id)} className="flex-1 md:flex-none">
                      <IconStop width={12} height={12} /> Stop
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateBrowserModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(b) => {
          setCreateOpen(false);
          load();
          setViewing(b);
        }}
      />
      {viewing && <BrowserDetailModal browser={viewing} onClose={() => setViewing(null)} onStop={() => stop(viewing.id).then(() => setViewing(null))} />}
    </div>
  );
}

function CreateBrowserModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (b: BrowserSession) => void }) {
  const [proxy, setProxy] = useState("us");
  const [profileId, setProfileId] = useState("");
  const [timeout, setTimeoutMin] = useState(60);
  const [record, setRecord] = useState(false);
  const [captcha, setCaptcha] = useState(true);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    bu<Paged<Profile>>("v4/profiles?pageSize=50")
      .then((r) => setProfiles(r.items ?? []))
      .catch(() => {});
  }, [open]);

  const create = async () => {
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = {
        proxyCountryCode: proxy === "none" ? null : proxy,
        timeout,
        enableRecording: record,
        solveCaptchas: captcha,
      };
      if (profileId) body.profileId = profileId;
      if (width && height) {
        body.browserScreenWidth = Number(width);
        body.browserScreenHeight = Number(height);
      }
      const b = await bu<BrowserSession>("v4/browsers", { method: "POST", body });
      onCreated(b);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Launch cloud browser">
      <div className="space-y-4">
        <Field label="Proxy country">
          <select value={proxy} onChange={(e) => setProxy(e.target.value)} className={inputCls}>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.label}
              </option>
            ))}
            <option value="none">No proxy</option>
          </select>
        </Field>
        <Field label="Profile" hint="Load saved cookies & local storage">
          <select value={profileId} onChange={(e) => setProfileId(e.target.value)} className={inputCls}>
            <option value="">None</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || p.id}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`Timeout: ${timeout} min`} hint="Up to 240 minutes · $0.02/hour">
          <input type="range" min={1} max={240} value={timeout} onChange={(e) => setTimeoutMin(Number(e.target.value))} className="w-full accent-orange-500" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Width (px)">
            <input value={width} onChange={(e) => setWidth(e.target.value)} placeholder="1280" type="number" className={inputCls} />
          </Field>
          <Field label="Height (px)">
            <input value={height} onChange={(e) => setHeight(e.target.value)} placeholder="800" type="number" className={inputCls} />
          </Field>
        </div>
        <div className="rounded-lg border border-white/5 px-3 py-1">
          <Toggle checked={captcha} onChange={setCaptcha} label="Solve CAPTCHAs" />
          <Toggle checked={record} onChange={setRecord} label="Enable recording" />
        </div>
        {err && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">{err}</p>}
        <Button onClick={create} loading={busy} className="w-full">
          Launch browser
        </Button>
      </div>
    </Modal>
  );
}

function BrowserDetailModal({ browser, onClose, onStop }: { browser: BrowserSession; onClose: () => void; onStop: () => void }) {
  const [b, setB] = useState(browser);
  const [copied, setCopied] = useState<string | null>(null);
  const [lang, setLang] = useState<"playwright" | "puppeteer" | "python">("playwright");

  useEffect(() => {
    bu<BrowserSession>(`v4/browsers/${browser.id}`)
      .then(setB)
      .catch(() => {});
  }, [browser.id]);

  const copy = (t: string, k: string) => {
    navigator.clipboard.writeText(t).catch(() => {});
    setCopied(k);
    setTimeout(() => setCopied(null), 1500);
  };

  const cdp = b.cdpUrl ?? "wss://…";
  const snippets = {
    playwright: `import { chromium } from "playwright";\n\nconst browser = await chromium.connectOverCDP("${cdp}");\nconst page = browser.contexts()[0].pages()[0];\nawait page.goto("https://example.com");`,
    puppeteer: `import puppeteer from "puppeteer-core";\n\nconst browser = await puppeteer.connect({\n  browserWSEndpoint: "${cdp}",\n});\nconst [page] = await browser.pages();\nawait page.goto("https://example.com");`,
    python: `from playwright.async_api import async_playwright\n\nasync with async_playwright() as p:\n    browser = await p.chromium.connect_over_cdp("${cdp}")\n    page = browser.contexts[0].pages[0]\n    await page.goto("https://example.com")`,
  };

  return (
    <Modal open onClose={onClose} title="Browser session" wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={b.status} />
          <span className="font-mono text-[11px] text-neutral-500">{b.id}</span>
        </div>
        {b.status === "active" && b.liveUrl && (
          <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
            <iframe src={b.liveUrl} title="Live browser" className="aspect-video w-full border-0" allow="autoplay; clipboard-read; clipboard-write" />
          </div>
        )}
        {b.liveUrl && (
          <div className="flex items-center gap-2">
            <input readOnly value={b.liveUrl} className={`${inputCls} font-mono text-xs`} />
            <Button variant="secondary" size="sm" onClick={() => copy(b.liveUrl!, "live")}>{copied === "live" ? <IconCheck width={13} height={13} /> : <IconCopy width={13} height={13} />}</Button>
            <a href={b.liveUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-lg border border-white/10 px-2.5 text-neutral-300 hover:bg-white/5">
              <IconExternal width={13} height={13} />
            </a>
          </div>
        )}
        {b.cdpUrl && (
          <Field label="CDP URL">
            <div className="flex items-center gap-2">
              <input readOnly value={b.cdpUrl} className={`${inputCls} font-mono text-xs`} />
              <Button variant="secondary" size="sm" onClick={() => copy(b.cdpUrl!, "cdp")}>{copied === "cdp" ? <IconCheck width={13} height={13} /> : <IconCopy width={13} height={13} />}</Button>
            </div>
          </Field>
        )}
        <div>
          <div className="mb-2 flex gap-1">
            {(["playwright", "puppeteer", "python"] as const).map((l) => (
              <button key={l} onClick={() => setLang(l)} className={`h-7 rounded-md px-2.5 text-xs capitalize ${lang === l ? "bg-white/10 text-white" : "text-neutral-500"}`}>
                {l}
              </button>
            ))}
            <button onClick={() => copy(snippets[lang], "code")} className="ml-auto flex items-center gap-1 text-xs text-neutral-400 hover:text-white">
              {copied === "code" ? <IconCheck width={12} height={12} /> : <IconCopy width={12} height={12} />} Copy
            </button>
          </div>
          <pre className="scroll-thin overflow-x-auto rounded-xl border border-white/5 bg-black/60 p-4 font-mono text-[11px] leading-relaxed text-neutral-300">{snippets[lang]}</pre>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ["Browser", `$${parseFloat(b.browserCost || "0").toFixed(4)}`],
            ["Proxy", `$${parseFloat(b.proxyCost || "0").toFixed(4)}`],
            ["Data", `${parseFloat(b.proxyUsedMb || "0").toFixed(1)} MB`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-neutral-500">{k}</p>
              <p className="mt-0.5 font-mono text-sm text-white">{v}</p>
            </div>
          ))}
        </div>
        {b.recordingUrl && (
          <a href={b.recordingUrl} target="_blank" rel="noreferrer" className="block text-center text-xs text-sky-400 hover:text-sky-300">
            Download recording
          </a>
        )}
        {b.status === "active" && (
          <Button variant="danger" onClick={onStop} className="w-full">
            <IconStop width={12} height={12} /> Stop browser
          </Button>
        )}
      </div>
    </Modal>
  );
}
