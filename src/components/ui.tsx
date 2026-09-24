"use client";

import Link from "next/link";
import { useEffect, type ReactNode, type ButtonHTMLAttributes } from "react";
import { IconKey, IconX } from "./icons";

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  loading,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md"; loading?: boolean }) {
  const v = {
    primary: "bg-white text-black hover:bg-neutral-200",
    secondary: "border border-white/10 bg-white/[0.04] text-neutral-200 hover:bg-white/[0.08]",
    ghost: "text-neutral-400 hover:bg-white/[0.06] hover:text-white",
    danger: "border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20",
  }[variant];
  const s = size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm";
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${v} ${s} ${className}`}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <span className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    running: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    dispatching: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    queued: "bg-neutral-500/15 text-neutral-300 border-neutral-500/30",
    completed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    finished: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    failed: "bg-red-500/15 text-red-300 border-red-500/30",
    cancelled: "bg-neutral-500/15 text-neutral-400 border-neutral-500/30",
    stopped: "bg-neutral-500/15 text-neutral-400 border-neutral-500/30",
  };
  const live = ["running", "dispatching", "active"].includes(status);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${map[status] ?? map.queued}`}>
      <span className={`h-1.5 w-1.5 rounded-full bg-current ${live ? "animate-pulse" : ""}`} />
      {status}
    </span>
  );
}

export function StatusDot({ status }: { status: string }) {
  const c =
    status === "running" || status === "dispatching"
      ? "bg-orange-400 animate-pulse"
      : status === "completed"
        ? "bg-emerald-400"
        : status === "failed"
          ? "bg-red-400"
          : "bg-neutral-500";
  return <span className={`h-2 w-2 shrink-0 rounded-full ${c}`} />;
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        className={`max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border border-white/10 bg-elevated shadow-2xl sm:rounded-2xl ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/5 bg-elevated px-5 py-4">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-neutral-400 hover:bg-white/10 hover:text-white">
            <IconX />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-neutral-400">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center">
      <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/5 text-neutral-300">{icon}</div>
      <p className="text-sm font-medium text-white">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-neutral-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBox({ error }: { error: { message: string; code?: string; status?: number } | string | null }) {
  if (!error) return null;
  const msg = typeof error === "string" ? error : error.message;
  const noKey = typeof error !== "string" && (error.code === "NO_KEY" || error.status === 401);
  if (noKey) return <NoKeyCard message={msg} />;
  return <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{msg}</div>;
}

export function NoKeyCard({ message }: { message?: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-transparent p-5 sm:flex-row sm:items-center">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-500/20 text-orange-300">
        <IconKey />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-white">Connect your Browser Use API key</p>
        <p className="mt-0.5 text-sm text-neutral-400">{message || "Add a real API key to run agents, launch cloud browsers and execute skills."}</p>
      </div>
      <Link href="/settings/api-keys?new=1" className="inline-flex h-9 items-center justify-center rounded-lg bg-white px-4 text-sm font-medium text-black hover:bg-neutral-200">
        Add API key
      </Link>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-neutral-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-neutral-500">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-neutral-600 outline-none transition focus:border-white/30 focus:ring-2 focus:ring-white/5";

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-3 py-1.5 text-left">
      <span className="text-sm text-neutral-300">{label}</span>
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked ? "bg-orange-500" : "bg-white/15"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-[#fff] shadow transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}
