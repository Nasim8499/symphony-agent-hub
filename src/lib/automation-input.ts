import type { BrowserSettingsJson } from "@/db/schema";

export type AutomationInput = {
  name: string;
  description: string | null;
  kind: "agent" | "skill";
  source: string;
  workflow: string | null;
  template: string | null;
  skillId: string | null;
  skillSource: string | null;
  paramKeys: string[];
  batch: Record<string, string>[];
  model: string;
  executorModel: string | null;
  browserSettings: BrowserSettingsJson | null;
  agentmail: boolean;
  scheduleType: "manual" | "once" | "interval" | "daily";
  intervalMinutes: number | null;
  runAt: Date | null;
  dailyTime: string | null;
  enabled: boolean;
};

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function extractParamKeys(tpl: string) {
  return Array.from(new Set(Array.from(tpl.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)).map((m) => m[1])));
}

export function normalizeAutomation(raw: Record<string, unknown>): { value: AutomationInput } | { error: string } {
  const name = str(raw.name);
  if (!name) return { error: "Name is required" };
  const kind = raw.kind === "skill" ? "skill" : "agent";
  const template = str(raw.template);
  const skillId = str(raw.skillId);
  if (kind === "agent" && !template) return { error: "Task template is required" };
  if (kind === "skill" && !skillId) return { error: "Select a skill" };

  const scheduleType = (["manual", "once", "interval", "daily"] as const).includes(raw.scheduleType as never)
    ? (raw.scheduleType as AutomationInput["scheduleType"])
    : "manual";
  const intervalMinutes = raw.intervalMinutes ? Math.max(5, Math.floor(Number(raw.intervalMinutes))) : null;
  if (scheduleType === "interval" && !intervalMinutes) return { error: "Interval (minutes) is required" };
  const runAt = raw.runAt ? new Date(String(raw.runAt)) : null;
  if (scheduleType === "once" && (!runAt || Number.isNaN(runAt.getTime()))) return { error: "Run time is required" };
  const dailyTime = str(raw.dailyTime);
  if (scheduleType === "daily" && !(dailyTime && /^\d{1,2}:\d{2}$/.test(dailyTime))) return { error: "Daily time (HH:MM UTC) is required" };

  const batch = Array.isArray(raw.batch)
    ? (raw.batch as unknown[])
        .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === "object")
        .map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v == null ? "" : String(v)])))
        .filter((r) => Object.values(r).some((v) => v.trim() !== ""))
        .slice(0, 50)
    : [];

  const paramKeys = Array.isArray(raw.paramKeys)
    ? (raw.paramKeys as unknown[]).map(String).filter(Boolean)
    : kind === "agent" && template
      ? extractParamKeys(template)
      : [];

  return {
    value: {
      name,
      description: str(raw.description),
      kind,
      source: str(raw.source) ?? "tasker",
      workflow: str(raw.workflow),
      template,
      skillId,
      skillSource: str(raw.skillSource),
      paramKeys,
      batch,
      model: str(raw.model) ?? "gpt-5.6-luna",
      executorModel: str(raw.executorModel),
      browserSettings: (raw.browserSettings as BrowserSettingsJson) ?? null,
      agentmail: Boolean(raw.agentmail),
      scheduleType,
      intervalMinutes: scheduleType === "interval" ? intervalMinutes : null,
      runAt: scheduleType === "once" ? runAt : null,
      dailyTime: scheduleType === "daily" ? dailyTime : null,
      enabled: raw.enabled === undefined ? true : Boolean(raw.enabled),
    },
  };
}
