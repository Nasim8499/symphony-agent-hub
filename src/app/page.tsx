"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Composer, { type ComposerPayload } from "@/components/Composer";
import { refreshSessions } from "@/components/AppShell";
import { ErrorBox, StatusDot } from "@/components/ui";
import { IconBolt, IconBriefcase, IconChevronRight, IconGlobe, IconLayers } from "@/components/icons";
import { api, ApiError, dispatchAgent, isDeepseekModel, timeAgo, type Execution } from "@/lib/bu-client";

const EXAMPLES = [
  { label: "Top HN story", task: "Find the top story on Hacker News right now and summarize the discussion in 3 bullets." },
  { label: "Cheapest flight DAC → SYD", task: "Find the cheapest one-way flight from Dhaka (DAC) to Sydney (SYD) next month on Google Flights. Return airline, price, duration and stops." },
  { label: "Australia 482 visa fees", task: "Go to immi.homeaffairs.gov.au and find the current fees and processing times for the Skills in Demand (subclass 482) visa. Return a table." },
  { label: "GitHub trending", task: "List the top 5 trending Python repositories on GitHub today with their star counts." },
];

const TOOLS = [
  { href: "/custom-agent", icon: IconBriefcase, title: "INSUS Custom Agent", desc: "Visa, work-permit & onboarding bots" },
  { href: "/automations", icon: IconLayers, title: "Automations", desc: "Scheduled & manual routines" },
  { href: "/tasker", icon: IconBolt, title: "Tasker Engine", desc: "Batch tasks & skills" },
  { href: "/browsers", icon: IconGlobe, title: "Cloud Browsers", desc: "CDP, live view & takeover" },
];

export default function Home() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string | undefined>();
  const [error, setError] = useState<ApiError | null>(null);
  const [preset, setPreset] = useState<{ text: string; nonce: number } | undefined>();
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [recent, setRecent] = useState<Execution[] | null>(null);

  useEffect(() => {
    const loadKey = () =>
      fetch("/api/keys")
        .then((r) => r.json())
        .then((r) => setHasKey(r.keys?.length > 0 || r.envKey))
        .catch(() => setHasKey(false));
    loadKey();
    api<{ executions: Execution[] }>("/api/executions?limit=5")
      .then((r) => setRecent(r.executions))
      .catch(() => setRecent([]));
    window.addEventListener("bu:keys", loadKey);
    return () => window.removeEventListener("bu:keys", loadKey);
  }, []);

  const run = async (p: ComposerPayload) => {
    setBusy(true);
    setBusyLabel(isDeepseekModel(p.model) ? "DeepSeek is planning…" : "Dispatching…");
    setError(null);
    try {
      const r = await dispatchAgent({ ...p, source: "manual" });
      refreshSessions();
      router.push(`/sessions/${r.sessionId}?run=${r.runId}`);
    } catch (e) {
      setError(e as ApiError);
      setBusy(false);
      setBusyLabel(undefined);
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <div className="relative flex-1">
        <div className="glow pointer-events-none absolute inset-0" />
        <div className="relative mx-auto w-full max-w-3xl px-4 pb-8 pt-10 sm:pt-16">
          <div className="text-center fade-up">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[11px] text-neutral-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Cloud Agent v4 · DeepSeek planning
            </div>
            <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-white sm:text-[44px]">
              What should the <span className="text-orange-400">browser</span> do?
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">Type a task below. An AI agent drives a stealth cloud browser while you watch live.</p>
          </div>

          {hasKey === false && (
            <div className="mt-6 fade-up">
              <ErrorBox error={{ message: "", code: "NO_KEY" }} />
            </div>
          )}

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((e) => (
              <button
                key={e.label}
                onClick={() => setPreset({ text: e.task, nonce: Date.now() })}
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-neutral-400 transition hover:border-white/25 hover:text-white"
              >
                {e.label}
              </button>
            ))}
          </div>

          <div className="mt-10 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {TOOLS.map((c) => (
              <Link key={c.href} href={c.href} className="group rounded-xl border border-white/[0.07] p-3.5 transition hover:border-white/15 hover:bg-white/[0.03]">
                <c.icon width={18} height={18} className="text-orange-400" />
                <p className="mt-2.5 text-[13px] font-medium text-white">{c.title}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">{c.desc}</p>
              </Link>
            ))}
          </div>

          {recent && recent.length > 0 && (
            <div className="mt-8">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Recent activity</span>
                <Link href="/automations" className="text-[11px] text-neutral-500 hover:text-white">
                  View all
                </Link>
              </div>
              <div className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/[0.07]">
                {recent.map((e) => {
                  const inner = (
                    <>
                      <StatusDot status={e.status} />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-300">{e.label || e.task}</span>
                      <span className="hidden text-[10px] uppercase text-neutral-500 sm:inline">{e.source}</span>
                      <span className="shrink-0 text-[11px] text-neutral-500">{timeAgo(e.createdAt)}</span>
                      {e.sessionId && <IconChevronRight width={14} height={14} className="text-neutral-600" />}
                    </>
                  );
                  return e.sessionId ? (
                    <Link key={e.id} href={`/sessions/${e.sessionId}`} className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-white/[0.03]">
                      {inner}
                    </Link>
                  ) : (
                    <div key={e.id} className="flex items-center gap-3 px-3.5 py-2.5">
                      {inner}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Docked footer composer */}
      <div className="sticky bottom-0 z-20 border-t border-white/[0.07] bg-canvas/85 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md sm:px-6">
        <div className="mx-auto max-w-3xl">
          {error && (
            <div className="mb-2">
              <ErrorBox error={error} />
            </div>
          )}
          <Composer onSubmit={run} busy={busy} busyLabel={busyLabel} autoFocus initialValue={preset} compact />
        </div>
      </div>
    </div>
  );
}
