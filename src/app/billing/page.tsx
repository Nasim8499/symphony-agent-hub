"use client";

import { useEffect, useState } from "react";
import { ErrorBox, PageHeader, Spinner } from "@/components/ui";
import { IconExternal } from "@/components/icons";
import { ApiError, bu, type Account } from "@/lib/bu-client";

export default function BillingPage() {
  const [acc, setAcc] = useState<Account | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    bu<Account>("v2/billing/account")
      .then(setAcc)
      .catch((e) => setError(e));
  }, []);

  const pct = acc ? Math.min(100, (acc.activeSessionCount / Math.max(1, acc.concurrentSessionLimit)) * 100) : 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        title="Billing & Usage"
        description="Live credit balance and concurrency for the active API key's project."
        actions={
          <a href="https://cloud.browser-use.com/billing" target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-2 rounded-lg bg-white px-3 text-xs font-medium text-black hover:bg-neutral-200">
            Add credits <IconExternal width={12} height={12} />
          </a>
        }
      />
      {error ? (
        <ErrorBox error={error} />
      ) : !acc ? (
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Spinner /> Loading account…
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-orange-500/15 via-transparent to-transparent p-6">
            <p className="text-xs uppercase tracking-wider text-neutral-400">Total credit balance</p>
            <p className="mt-2 font-mono text-4xl font-semibold text-white sm:text-5xl">${acc.totalCreditsBalanceUsd.toFixed(2)}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-neutral-300">{acc.planInfo?.planName ?? (acc.isFreeTier ? "Free tier" : "Pay as you go")}</span>
              {acc.name && <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-neutral-300">{acc.name}</span>}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              ["Monthly credits", `$${acc.monthlyCreditsBalanceUsd.toFixed(2)}`],
              ["Additional credits", `$${acc.additionalCreditsBalanceUsd.toFixed(2)}`],
              ["Concurrency limit", String(acc.concurrentSessionLimit)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <p className="text-[11px] uppercase tracking-wider text-neutral-500">{k}</p>
                <p className="mt-1 font-mono text-xl text-white">{v}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-neutral-400">Active sessions</span>
              <span className="font-mono text-neutral-300">
                {acc.activeSessionCount} / {acc.concurrentSessionLimit}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/5">
              <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-600 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-xs text-neutral-500">
            <p>
              Project <span className="font-mono text-neutral-300">{acc.projectId}</span>
            </p>
            <p className="mt-2">Browser sessions are billed at $0.02/hour; proxy traffic at $5/GB managed. Model tokens are billed per model.</p>
          </div>
        </div>
      )}
    </div>
  );
}
