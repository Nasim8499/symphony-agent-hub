"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import { bu, type SessionInfo } from "@/lib/bu-client";
import { StatusDot } from "./ui";
import ThemeToggle from "./ThemeToggle";
import ErrorBoundary from "./ErrorBoundary";
import DocumentViewer from "./DocumentViewer";
import {
  IconBolt, IconBook, IconBriefcase, IconCard, IconChat, IconChevron, IconGithub, IconGlobe, IconFile, IconKey, IconLayers, IconMenu, IconPlus, IconShield, IconUser, IconX, Logo,
} from "./icons";

type NavItem = { href: string; label: string; icon: ComponentType<SVGProps<SVGSVGElement>>; exact?: boolean; badge?: string; match?: string[] };

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Agent",
    items: [
      { href: "/", label: "Core Agent", icon: IconChat, exact: true, match: ["/sessions"] },
      { href: "/custom-agent", label: "Custom Agent", icon: IconBriefcase, badge: "INSUS" },
    ],
  },
  {
    title: "Automate",
    items: [
      { href: "/automations", label: "All Automations & Tasks", icon: IconLayers },
      { href: "/tasker", label: "Skills & Tasker Engine", icon: IconBolt, match: ["/skills", "/marketplace"] },
    ],
  },
  {
    title: "Infrastructure",
    items: [
      { href: "/browsers", label: "Live Cloud Browsers", icon: IconGlobe },
      { href: "/profiles", label: "Browser Profiles", icon: IconUser },
    ],
  },
  {
    title: "Settings",
    items: [
      { href: "/settings/api-keys", label: "API Keys & Settings", icon: IconKey },
      { href: "/billing", label: "Billing & Usage", icon: IconCard },
    ],
  },
];

const TITLES: [string, string][] = [
  ["/sessions", "Agent Session"],
  ["/custom-agent", "Custom Agent · INSUS"],
  ["/automations", "All Automations & Tasks"],
  ["/tasker", "Skills & Tasker Engine"],
  ["/skills", "Skills & Tasker Engine"],
  ["/marketplace", "Skills & Tasker Engine"],
  ["/browsers", "Live Cloud Browsers"],
  ["/profiles", "Browser Profiles"],
  ["/settings", "API Keys & Settings"],
  ["/billing", "Billing & Usage"],
];

type KeyInfo = {
  keys: { id: number; name: string; masked: string; isActive: boolean; creditsUsd: number | null; health?: string; folder?: string }[];
  deepseek: { id: number; isActive: boolean }[];
  openrouter?: { id: number; isActive: boolean }[];
  envKey: boolean;
  envDeepseek: boolean;
  envOpenrouter?: boolean;
  settings?: { fallbackMode: boolean; fallbackProvider: string };
};

export function refreshSessions() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("bu:sessions"));
}

function healthTuples(info: KeyInfo | null) {
  if (!info || info.keys.length === 0) return "text-neutral-500";
  const healthy = info.keys.filter((k) => k.health === "healthy").length;
  if (healthy === 0) return "text-amber-400";
  if (healthy < info.keys.length) return "text-amber-300";
  return "text-emerald-400";
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionsOpen, setSessionsOpen] = useState(true);
  const [sessionsState, setSessionsState] = useState<"loading" | "ok" | "nokey" | "error">("loading");
  const [keyInfo, setKeyInfo] = useState<KeyInfo | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerKey, setViewerKey] = useState(0);

  const loadSessions = useCallback(async () => {
    try {
      const r = await bu<{ sessions: SessionInfo[] }>("v4/sessions?limit=30");
      setSessions(r.sessions ?? []);
      setSessionsState("ok");
    } catch (e) {
      setSessionsState((e as { status?: number }).status === 401 ? "nokey" : "error");
    }
  }, []);

  const loadKeys = useCallback(async () => {
    const r = await fetch("/api/keys", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (r) setKeyInfo(r);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSessions();
    loadKeys();
    const onS = () => loadSessions();
    const onK = () => {
      loadKeys();
      loadSessions();
    };
    window.addEventListener("bu:sessions", onS);
    window.addEventListener("bu:keys", onK);
    const t = setInterval(loadSessions, 20000);
    return () => {
      window.removeEventListener("bu:sessions", onS);
      window.removeEventListener("bu:keys", onK);
      clearInterval(t);
    };
  }, [loadSessions, loadKeys]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        router.push("/");
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [router]);

  const activeKey = keyInfo?.keys.find((k) => k.isActive) ?? keyInfo?.keys[0];
  const hasBu = Boolean(activeKey || keyInfo?.envKey);
  const hasDs = Boolean(keyInfo?.deepseek?.length || keyInfo?.envDeepseek);
  const fallbackOn = Boolean(keyInfo?.settings?.fallbackMode);
  const healthyKeys = keyInfo?.keys.filter((k) => k.health === "healthy").length ?? 0;
  const isActive = (n: NavItem) => (n.exact ? pathname === n.href : pathname.startsWith(n.href)) || Boolean(n.match?.some((m) => pathname.startsWith(m)));
  const title = pathname === "/" ? "Core Agent" : (TITLES.find(([p]) => pathname.startsWith(p))?.[1] ?? "Browser Use");
  const onSession = pathname.startsWith("/sessions/");

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <Link href="/" aria-label="Home">
          <Logo />
        </Link>
        <button className="rounded-md p-1.5 text-neutral-400 hover:bg-white/10 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
          <IconX />
        </button>
      </div>

      <div className="px-3">
        <button
          onClick={() => router.push("/")}
          className="flex h-10 w-full items-center gap-2 rounded-lg bg-white px-3 text-sm font-medium text-black transition hover:opacity-90"
        >
          <IconPlus width={16} height={16} /> New session
          <kbd className="ml-auto hidden rounded border border-black/15 px-1.5 font-mono text-[10px] opacity-60 sm:inline">⌘K</kbd>
        </button>
      </div>

      <div className="scroll-thin mt-3 min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {SECTIONS.map((sec) => (
          <div key={sec.title} className="mt-3 first:mt-1">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{sec.title}</p>
            <nav className="space-y-0.5">
              {sec.items.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`flex h-9 items-center gap-2.5 rounded-lg px-3 text-[13px] transition ${
                    isActive(n) ? "bg-white/[0.08] font-medium text-white" : "text-neutral-400 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  <n.icon width={16} height={16} className="shrink-0" />
                  <span className="truncate">{n.label}</span>
                  {n.badge && <span className="ml-auto rounded bg-orange-500/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-orange-300">{n.badge}</span>}
                </Link>
              ))}
            </nav>
          </div>
        ))}

        <div className="mt-4">
          <button onClick={() => setSessionsOpen((v) => !v)} className="flex w-full items-center justify-between px-3 pb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Recent sessions</span>
            <span className="flex items-center gap-1 text-[10px] text-neutral-500">
              {sessionsState === "ok" && sessions.length}
              <IconChevron width={12} height={12} className={`transition ${sessionsOpen ? "" : "-rotate-90"}`} />
            </span>
          </button>
          {sessionsOpen && (
            <div>
              {sessionsState === "loading" &&
                Array.from({ length: 4 }).map((_, i) => <div key={i} className="mx-1 mb-1 h-7 animate-pulse rounded-lg bg-white/[0.04]" />)}
              {sessionsState === "nokey" && <p className="px-3 py-1.5 text-xs text-neutral-500">Add an API key to see sessions.</p>}
              {sessionsState === "error" && <p className="px-3 py-1.5 text-xs text-neutral-500">Couldn&apos;t load sessions.</p>}
              {sessionsState === "ok" && sessions.length === 0 && <p className="px-3 py-1.5 text-xs text-neutral-500">No sessions yet.</p>}
              {sessions.map((s) => {
                const href = `/sessions/${s.sessionId}`;
                return (
                  <Link
                    key={s.sessionId}
                    href={href}
                    title={s.title || s.task}
                    className={`flex h-8 items-center gap-2 rounded-lg px-3 text-[12.5px] transition ${
                      pathname === href ? "bg-white/[0.08] text-white" : "text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-200"
                    }`}
                  >
                    <StatusDot status={s.status} />
                    <span className="truncate">{s.title || s.task}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-white/5 p-3">
        <div className="flex gap-1">
          <a href="https://docs.browser-use.com" target="_blank" rel="noreferrer" className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs text-neutral-400 hover:bg-white/[0.04] hover:text-white">
            <IconBook width={14} height={14} /> Docs
          </a>
          <a href="https://github.com/browser-use/browser-use" target="_blank" rel="noreferrer" className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs text-neutral-400 hover:bg-white/[0.04] hover:text-white">
            <IconGithub width={14} height={14} /> GitHub
          </a>
        </div>
        {fallbackOn && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.07] px-2.5 py-1.5 text-[11px] text-emerald-300">
            <IconShield width={12} height={12} className="shrink-0" />
            <span className="truncate">Fallback mode · {keyInfo?.settings?.fallbackProvider}</span>
          </div>
        )}
        <Link href="/settings/api-keys" className="mt-2 flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] p-2.5 hover:bg-white/[0.05]">
          <div className={`grid h-8 w-8 place-items-center rounded-lg ${hasBu ? "bg-emerald-500/15 text-emerald-300" : fallbackOn ? "bg-emerald-500/15 text-emerald-300" : "bg-orange-500/15 text-orange-300"}`}>
            <IconKey width={15} height={15} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-white">{activeKey ? activeKey.name : keyInfo?.envKey ? "Env key" : fallbackOn ? "Fallback mode" : "No API key"}</p>
            <p className="truncate font-mono text-[10px] text-neutral-500">
              {activeKey?.creditsUsd != null ? `$${activeKey.creditsUsd.toFixed(2)}` : hasBu ? "Browser Use" : fallbackOn ? "No key needed" : "Connect"}
              {" · "}
              <span className={healthTuples(keyInfo)}>
                {keyInfo?.keys.length ?? 0} key{(keyInfo?.keys.length ?? 0) === 1 ? "" : "s"}
                {keyInfo && keyInfo.keys.length > 0 ? ` · ${healthyKeys} ok` : ""}
              </span>
              {" · "}
              <span className={hasDs ? "text-sky-400" : ""}>DeepSeek {hasDs ? "✓" : "—"}</span>
            </p>
          </div>
        </Link>
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas text-neutral-200">
      <aside className="hidden w-[264px] shrink-0 border-r border-white/[0.07] bg-panel lg:block">{sidebar}</aside>

      {open && <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] lg:hidden" onClick={() => setOpen(false)} />}
      <aside
        aria-hidden={!open}
        className={`fixed inset-y-0 left-0 z-50 w-[86%] max-w-[300px] border-r border-white/[0.07] bg-panel shadow-2xl transition-transform duration-200 lg:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebar}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-white/[0.07] bg-canvas/80 px-3 backdrop-blur sm:px-5">
          <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-neutral-300 hover:bg-white/10 lg:hidden" aria-label="Open menu">
            <IconMenu />
          </button>
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{title}</h2>
          {fallbackOn && (
            <Link href="/settings/api-keys?tab=mode" className="hidden h-8 items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 text-xs font-medium text-emerald-300 sm:inline-flex">
              <IconShield width={13} height={13} /> Fallback
            </Link>
          )}
          {!hasBu && !fallbackOn && keyInfo && (
            <Link href="/settings/api-keys?new=1" className="hidden h-8 items-center rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 text-xs font-medium text-orange-300 sm:inline-flex">
              Connect API key
            </Link>
          )}
          <button
            onClick={() => { setViewerOpen(true); setViewerKey((k) => k + 1); }}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 text-xs font-medium text-neutral-200 transition press hover:bg-white/5"
            title="Open document viewer"
            aria-label="Open document viewer"
          >
            <IconFile width={14} height={14} />
            <span className="hidden sm:inline">Viewer</span>
          </button>
          <ThemeToggle />
          <button onClick={() => router.push("/")} className="hidden h-8 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-medium text-neutral-200 transition press hover:bg-white/5 sm:inline-flex">
            <IconPlus width={14} height={14} /> New
          </button>
        </header>
        <main className="relative min-h-0 flex-1 overflow-y-auto">
          <ErrorBoundary key={pathname} label={pathname}>
            {children}
          </ErrorBoundary>
        </main>
      </div>

      <DocumentViewer open={viewerOpen} onClose={() => setViewerOpen(false)} sessionId={onSession ? pathname.split("/")[2] : undefined} refreshKey={viewerKey} />
    </div>
  );
}
