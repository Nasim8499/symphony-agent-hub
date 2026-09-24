"use client";

import { useState } from "react";
import type { RunEvent } from "@/lib/bu-client";
import { IconChevronRight, IconGlobe, IconSpark, IconTerminal, IconCheck, IconX, IconMonitor, IconChat } from "./icons";

const TEXT_KEYS = ["text", "message", "content", "thought", "thinking", "reasoning", "summary", "memory", "next_goal", "nextGoal", "evaluation", "result", "output", "error", "reason", "title"];
const TOOL_KEYS = ["tool", "tool_name", "toolName", "name", "action", "command"];
const ARG_KEYS = ["args", "arguments", "input", "params", "parameters"];
const URL_KEYS = ["url", "page_url", "pageUrl", "current_url"];
const IMG_KEYS = ["screenshot_url", "screenshotUrl", "screenshot", "image_url", "imageUrl"];

function pickStr(data: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = data[k];
    if (typeof v === "string" && v.trim()) return v;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const inner = v as Record<string, unknown>;
      for (const ik of ["text", "content", "message"]) if (typeof inner[ik] === "string" && (inner[ik] as string).trim()) return inner[ik] as string;
    }
  }
  return null;
}

export function findLiveUrl(events: RunEvent[]): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const d = events[i].data ?? {};
    for (const k of ["live_view_url", "liveViewUrl", "live_url", "liveUrl"]) {
      if (typeof d[k] === "string" && (d[k] as string).startsWith("http")) return d[k] as string;
    }
  }
  return null;
}

export function humanType(t: string) {
  const s = t.replace(/[._]/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function kind(type: string) {
  const t = type.toLowerCase();
  if (t.startsWith("browser")) return "browser";
  if (t.includes("tool") || t.includes("action")) return "tool";
  if (t.includes("fail") || t.includes("error")) return "error";
  if (t.includes("complete") || t.includes("done") || t.includes("success")) return "done";
  if (t.includes("model") || t.includes("llm") || t.includes("thinking") || t.includes("reason")) return "model";
  if (t.includes("assistant") || t.includes("message")) return "message";
  return "info";
}

const HIDDEN = new Set(["heartbeat", "ping", "keepalive"]);

export function isVisibleEvent(e: RunEvent) {
  const t = e.type.toLowerCase();
  if (HIDDEN.has(t)) return false;
  if (t.includes("delta") || t.includes("token")) return false;
  return true;
}

export default function EventItem({ event }: { event: RunEvent }) {
  const [open, setOpen] = useState(false);
  const d = event.data ?? {};
  const k = kind(event.type);
  const text = pickStr(d, TEXT_KEYS);
  const tool = pickStr(d, TOOL_KEYS);
  const url = pickStr(d, URL_KEYS);
  const img = pickStr(d, IMG_KEYS);
  const argsObj = ARG_KEYS.map((a) => d[a]).find((v) => v && typeof v === "object");
  const argsStr = argsObj ? JSON.stringify(argsObj) : null;

  const Icon = { browser: IconGlobe, tool: IconTerminal, error: IconX, done: IconCheck, model: IconSpark, message: IconChat, info: IconMonitor }[k];
  const tone = {
    browser: "text-sky-300 bg-sky-500/10 border-sky-500/20",
    tool: "text-violet-300 bg-violet-500/10 border-violet-500/20",
    error: "text-red-300 bg-red-500/10 border-red-500/20",
    done: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
    model: "text-orange-300 bg-orange-500/10 border-orange-500/20",
    message: "text-neutral-200 bg-white/5 border-white/10",
    info: "text-neutral-400 bg-white/5 border-white/10",
  }[k];

  return (
    <div className="group relative flex gap-3 pb-3 fade-up">
      <div className="flex flex-col items-center">
        <div className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border ${tone}`}>
          <Icon width={12} height={12} />
        </div>
        <div className="mt-1 w-px flex-1 bg-white/5 group-last:hidden" />
      </div>
      <div className="min-w-0 flex-1 pb-1">
        <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 text-left">
          <span className="text-[13px] font-medium text-neutral-200">{tool && k === "tool" ? tool : humanType(event.type)}</span>
          {tool && k !== "tool" && <span className="truncate rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">{tool}</span>}
          <span className="ml-auto shrink-0 font-mono text-[10px] text-neutral-600">{new Date(event.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
          <IconChevronRight width={12} height={12} className={`shrink-0 text-neutral-600 transition ${open ? "rotate-90" : ""}`} />
        </button>
        {text && <p className={`prose-result mt-1 text-[13px] leading-relaxed ${k === "error" ? "text-red-300" : "text-neutral-400"} ${open ? "" : "line-clamp-4"}`}>{text}</p>}
        {!text && argsStr && <p className="mt-1 truncate font-mono text-[11px] text-neutral-500">{argsStr}</p>}
        {url && (
          <a href={url} target="_blank" rel="noreferrer" className="mt-1 block truncate font-mono text-[11px] text-sky-400/80 hover:text-sky-300">
            {url}
          </a>
        )}
        {img && img.startsWith("http") && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="screenshot" className="mt-2 max-h-56 rounded-lg border border-white/10" />
        )}
        {open && (
          <pre className="scroll-thin mt-2 max-h-72 overflow-auto rounded-lg border border-white/5 bg-black/50 p-3 font-mono text-[11px] leading-relaxed text-neutral-400">
            {JSON.stringify(d, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
