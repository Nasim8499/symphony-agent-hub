"use client";

export { api, isDeepseekModel, type Automation } from "./bu-client";

export function renderPreview(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, k: string) => (vars[k]?.trim() ? vars[k] : `‹${k}›`));
}
