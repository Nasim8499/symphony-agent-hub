"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { IconRefresh, IconShield } from "./icons";

type Props = { children: ReactNode; fallback?: ReactNode; label?: string; onReset?: () => void };
type State = { error: Error | null };

/** Client-side error boundary with a friendly, recoverable fallback state. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV !== "production") {
      console.error(`[ErrorBoundary${this.props.label ? `:${this.props.label}` : ""}]`, error, info.componentStack);
    }
  }

  private reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-red-500/25 bg-red-500/[0.04] p-6 text-center fade-up">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-red-500/25 bg-red-500/10 text-red-300">
            <IconShield width={22} height={22} />
          </div>
          <h2 className="text-base font-semibold text-white">Something went wrong here</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-neutral-400">
            This panel hit an unexpected error. The rest of the dashboard keeps running — retry this section, or reload the page.
          </p>
          <pre className="scroll-thin mt-3 max-h-28 overflow-auto rounded-lg border border-white/5 bg-black/30 p-2.5 text-left font-mono text-[10.5px] leading-relaxed text-neutral-500">
            {error.message}
          </pre>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button onClick={this.reset} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-medium text-black hover:bg-neutral-200">
              <IconRefresh width={14} height={14} /> Try again
            </button>
            <button onClick={() => window.location.reload()} className="inline-flex h-9 items-center justify-center rounded-lg border border-white/10 px-4 text-sm font-medium text-neutral-300 hover:bg-white/5">
              Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
