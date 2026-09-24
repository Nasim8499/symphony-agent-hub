"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, EmptyState, ErrorBox, Field, Modal, Spinner, StatusBadge, Toggle, inputCls } from "./ui";
import { IconBolt, IconCheck, IconCopy, IconPlay, IconSearch, IconStore, IconTrash } from "./icons";
import { ApiError, bu, timeAgo, type ExecuteSkillResponse, type Paged, type Skill, type SkillParam } from "@/lib/bu-client";

const CATEGORIES = [
  "search", "e_commerce", "financial", "news", "real_estate", "social_media", "travel", "marketplace",
  "lead_generation", "seo", "jobs", "developer", "media", "automation", "integration", "other",
];

const catLabel = (c: string) => c.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

export default function SkillsBrowser({ mode }: { mode: "mine" | "marketplace" }) {
  const [data, setData] = useState<Paged<Skill> | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Skill | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ pageSize: "24", pageNumber: String(page) });
      if (query) qs.set("query", query);
      if (category) qs.set("category", category);
      const path = mode === "mine" ? `v2/skills?${qs}` : `v2/marketplace/skills?${qs}`;
      setData(await bu<Paged<Skill>>(path));
      setError(null);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setLoading(false);
    }
  }, [mode, query, category, page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const items = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.totalItems / (data.pageSize || 24))) : 1;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <IconSearch width={15} height={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder={mode === "mine" ? "Search your skills…" : "Search marketplace…"}
            className={`${inputCls} pl-9`}
          />
        </div>
        {data && <span className="text-xs text-neutral-500">{data.totalItems} skill{data.totalItems === 1 ? "" : "s"}</span>}
      </div>

      <div className="scroll-thin -mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {["", ...CATEGORIES].map((c) => (
          <button
            key={c || "all"}
            onClick={() => {
              setCategory(c);
              setPage(1);
            }}
            className={`h-7 shrink-0 rounded-full border px-3 text-xs transition ${
              category === c ? "border-orange-500/40 bg-orange-500/15 text-orange-200" : "border-white/10 text-neutral-400 hover:border-white/20 hover:text-white"
            }`}
          >
            {c ? catLabel(c) : "All"}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorBox error={error} />
      ) : loading && !data ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl border border-white/5 bg-white/[0.02]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        mode === "mine" ? (
          <EmptyState
            icon={<IconBolt />}
            title="No skills found"
            description="Clone a skill from the Marketplace to add it to your project, then run it here with parameters."
            action={
              <Link href="/marketplace" className="inline-flex h-8 items-center rounded-lg bg-white px-3 text-xs font-medium text-black">
                Browse marketplace
              </Link>
            }
          />
        ) : (
          <EmptyState icon={<IconStore />} title="No marketplace skills match" description="Try another search or category." />
        )
      ) : (
        <>
          <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 ${loading ? "opacity-60" : ""}`}>
            {items.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelected(s)}
                className="group flex flex-col rounded-xl border border-white/5 bg-white/[0.02] p-4 text-left transition hover:border-white/15 hover:bg-white/[0.04]"
              >
                <div className="flex items-start gap-3">
                  {s.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.iconUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg border border-white/10 bg-[#fff] object-contain p-1" />
                  ) : (
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-orange-300">
                      <IconBolt width={16} height={16} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-medium text-white">{s.title}</p>
                      {s.isOfficial && <span className="shrink-0 rounded bg-sky-500/15 px-1 py-0.5 text-[9px] font-semibold uppercase text-sky-300">Official</span>}
                    </div>
                    <p className="truncate font-mono text-[10px] text-neutral-500">{s.domains?.slice(0, 2).join(", ") || s.slug || s.id.slice(0, 8)}</p>
                  </div>
                  {mode === "mine" && s.status && s.status !== "finished" && <StatusBadge status={s.status} />}
                </div>
                <p className="mt-3 line-clamp-2 flex-1 text-[13px] leading-relaxed text-neutral-400">{s.description}</p>
                <div className="mt-3 flex items-center gap-1.5 border-t border-white/5 pt-3">
                  {s.categories?.slice(0, 2).map((c) => (
                    <span key={c} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-neutral-400">
                      {catLabel(c)}
                    </span>
                  ))}
                  <span className="ml-auto text-[10px] text-neutral-500">
                    {s.parameters?.length ?? 0} param{s.parameters?.length === 1 ? "" : "s"}
                    {typeof s.cloneCount === "number" ? ` · ${s.cloneCount} clones` : ""}
                  </span>
                </div>
              </button>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-xs text-neutral-500">
                {page} / {totalPages}
              </span>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {selected && <SkillModal skill={selected} mode={mode} onClose={() => setSelected(null)} onChanged={load} />}
    </div>
  );
}

function initialValues(params: SkillParam[]) {
  const v: Record<string, string | boolean> = {};
  for (const p of params) {
    if (p.type === "boolean") v[p.name] = p.default === true;
    else if (p.default !== undefined && p.default !== null) v[p.name] = typeof p.default === "string" ? p.default : JSON.stringify(p.default);
    else v[p.name] = "";
  }
  return v;
}

function SkillModal({ skill, mode, onClose, onChanged }: { skill: Skill; mode: "mine" | "marketplace"; onClose: () => void; onChanged: () => void }) {
  const [tab, setTab] = useState<"run" | "api" | "history">("run");
  const [values, setValues] = useState(() => initialValues(skill.parameters ?? []));
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ExecuteSkillResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cloning, setCloning] = useState(false);
  const [cloned, setCloned] = useState(false);
  const [enabled, setEnabled] = useState(skill.isEnabled ?? true);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<{ id: string; status: string; success: boolean; startedAt: string; latencyMs: number | null }[] | null>(null);

  useEffect(() => {
    if (tab !== "history" || mode !== "mine" || history) return;
    bu<Paged<{ id: string; status: string; success: boolean; startedAt: string; latencyMs: number | null }>>(`v2/skills/${skill.id}/executions?pageSize=20`)
      .then((r) => setHistory(r.items ?? []))
      .catch(() => setHistory([]));
  }, [tab, mode, skill.id, history]);

  const buildParams = () => {
    const out: Record<string, unknown> = {};
    for (const p of skill.parameters ?? []) {
      const v = values[p.name];
      if (p.type === "boolean") {
        out[p.name] = Boolean(v);
        continue;
      }
      const s = String(v ?? "").trim();
      if (!s) {
        if (p.required) throw new Error(`"${p.name}" is required`);
        continue;
      }
      if (p.type === "number") {
        const n = Number(s);
        if (Number.isNaN(n)) throw new Error(`"${p.name}" must be a number`);
        out[p.name] = n;
      } else if (p.type === "object" || p.type === "array") {
        try {
          out[p.name] = JSON.parse(s);
        } catch {
          throw new Error(`"${p.name}" must be valid JSON`);
        }
      } else out[p.name] = s;
    }
    return out;
  };

  const execute = async () => {
    setErr(null);
    setResult(null);
    let parameters: Record<string, unknown>;
    try {
      parameters = buildParams();
    } catch (e) {
      setErr((e as Error).message);
      return;
    }
    setRunning(true);
    try {
      const path = mode === "mine" ? `v2/skills/${skill.id}/execute` : `v2/marketplace/skills/${skill.id}/execute`;
      setResult(await bu<ExecuteSkillResponse>(path, { method: "POST", body: { parameters } }));
      setHistory(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const clone = async () => {
    setCloning(true);
    setErr(null);
    try {
      await bu(`v2/marketplace/skills/${skill.id}/clone`, { method: "POST" });
      setCloned(true);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setCloning(false);
    }
  };

  const toggleEnabled = async (v: boolean) => {
    setEnabled(v);
    try {
      await bu(`v2/skills/${skill.id}`, { method: "PATCH", body: { isEnabled: v } });
      onChanged();
    } catch (e) {
      setEnabled(!v);
      setErr((e as Error).message);
    }
  };

  const del = async () => {
    if (!confirm(`Delete skill "${skill.title}"?`)) return;
    try {
      await bu(`v2/skills/${skill.id}`, { method: "DELETE" });
      onChanged();
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  let sample: Record<string, unknown> = {};
  try {
    sample = buildParams();
  } catch {
    sample = Object.fromEntries((skill.parameters ?? []).map((p) => [p.name, p.type === "number" ? 0 : p.type === "boolean" ? false : `<${p.name}>`]));
  }
  const endpoint = mode === "mine" ? `skills/${skill.id}/execute` : `marketplace/skills/${skill.id}/execute`;
  const curl = `curl -X POST https://api.browser-use.com/api/v2/${endpoint} \\\n  -H "X-Browser-Use-API-Key: $BROWSER_USE_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify({ parameters: sample })}'`;

  return (
    <Modal open onClose={onClose} title={skill.title} wide>
      <p className="text-sm leading-relaxed text-neutral-400">{skill.description}</p>
      {skill.domains?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {skill.domains.map((d) => (
            <span key={d} className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">
              {d}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex gap-1 border-b border-white/5">
        {(mode === "mine" ? (["run", "api", "history"] as const) : (["run", "api"] as const)).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`-mb-px border-b-2 px-3 py-2 text-xs font-medium capitalize ${tab === t ? "border-orange-400 text-white" : "border-transparent text-neutral-500 hover:text-neutral-300"}`}>
            {t === "api" ? "API" : t}
          </button>
        ))}
      </div>

      {tab === "run" && (
        <div className="mt-4 space-y-4">
          {(skill.parameters ?? []).length === 0 && <p className="text-xs text-neutral-500">This skill takes no parameters.</p>}
          {(skill.parameters ?? []).map((p) => (
            <div key={p.name}>
              {p.type === "boolean" ? (
                <div className="rounded-lg border border-white/5 px-3">
                  <Toggle checked={Boolean(values[p.name])} onChange={(v) => setValues((s) => ({ ...s, [p.name]: v }))} label={p.name} />
                </div>
              ) : (
                <Field
                  label={`${p.name}${p.required ? " *" : ""}`}
                  hint={[p.description, p.type !== "string" ? `type: ${p.type}` : "", p.cookieDomain ? `cookie from ${p.cookieDomain}` : ""].filter(Boolean).join(" · ")}
                >
                  {p.type === "object" || p.type === "array" ? (
                    <textarea
                      rows={3}
                      value={String(values[p.name] ?? "")}
                      onChange={(e) => setValues((s) => ({ ...s, [p.name]: e.target.value }))}
                      placeholder={p.type === "array" ? "[ ]" : "{ }"}
                      className={`${inputCls} font-mono text-xs`}
                    />
                  ) : (
                    <input
                      type={p.type === "number" ? "number" : "text"}
                      value={String(values[p.name] ?? "")}
                      onChange={(e) => setValues((s) => ({ ...s, [p.name]: e.target.value }))}
                      className={inputCls}
                    />
                  )}
                </Field>
              )}
            </div>
          ))}

          {err && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">{err}</p>}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={execute} loading={running} className="flex-1">
              {!running && <IconPlay width={12} height={12} />} {running ? "Executing…" : "Execute skill"}
            </Button>
            {mode === "marketplace" && (
              <Button variant="secondary" onClick={clone} loading={cloning} disabled={cloned}>
                {cloned ? (
                  <>
                    <IconCheck width={13} height={13} /> Cloned
                  </>
                ) : (
                  "Clone to my skills"
                )}
              </Button>
            )}
          </div>

          {mode === "mine" && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-white/5 px-3">
              <div className="flex-1">
                <Toggle checked={enabled} onChange={toggleEnabled} label="Enabled" />
              </div>
              <button onClick={del} className="flex items-center gap-1 py-2 text-xs text-neutral-500 hover:text-red-300">
                <IconTrash width={12} height={12} /> Delete
              </button>
            </div>
          )}

          {result && (
            <div className={`rounded-xl border p-4 ${result.success ? "border-emerald-500/20 bg-emerald-500/[0.04]" : "border-red-500/20 bg-red-500/[0.05]"}`}>
              <div className="mb-2 flex items-center justify-between">
                <span className={`text-[11px] font-medium uppercase tracking-wider ${result.success ? "text-emerald-400" : "text-red-400"}`}>{result.success ? "Success" : "Failed"}</span>
                {result.latencyMs != null && <span className="font-mono text-[10px] text-neutral-500">{(result.latencyMs / 1000).toFixed(2)}s</span>}
              </div>
              {result.error && <p className="mb-2 text-sm text-red-300">{result.error}</p>}
              {result.result !== null && result.result !== undefined && (
                <pre className="scroll-thin max-h-80 overflow-auto rounded-lg bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-neutral-200">
                  {typeof result.result === "string" ? result.result : JSON.stringify(result.result, null, 2)}
                </pre>
              )}
              {result.stderr && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-[11px] text-neutral-500">stderr</summary>
                  <pre className="mt-1 max-h-40 overflow-auto font-mono text-[10px] text-neutral-500">{result.stderr}</pre>
                </details>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "api" && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400">cURL</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(curl).catch(() => {});
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white"
            >
              {copied ? <IconCheck width={12} height={12} /> : <IconCopy width={12} height={12} />} Copy
            </button>
          </div>
          <pre className="scroll-thin overflow-x-auto rounded-xl border border-white/5 bg-black/60 p-4 font-mono text-[11px] leading-relaxed text-neutral-300">{curl}</pre>
          {skill.outputSchema && Object.keys(skill.outputSchema).length > 0 && (
            <>
              <span className="text-xs text-neutral-400">Output schema</span>
              <pre className="scroll-thin max-h-60 overflow-auto rounded-xl border border-white/5 bg-black/60 p-4 font-mono text-[11px] text-neutral-400">{JSON.stringify(skill.outputSchema, null, 2)}</pre>
            </>
          )}
        </div>
      )}

      {tab === "history" && (
        <div className="mt-4">
          {!history ? (
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Spinner /> Loading…
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-neutral-500">No executions yet.</p>
          ) : (
            <div className="divide-y divide-white/5 rounded-xl border border-white/5">
              {history.map((h) => (
                <div key={h.id} className="flex items-center gap-3 px-3 py-2.5">
                  <StatusBadge status={h.success ? "completed" : h.status === "running" ? "running" : "failed"} />
                  <span className="truncate font-mono text-[10px] text-neutral-500">{h.id.slice(0, 13)}</span>
                  <span className="ml-auto text-[11px] text-neutral-500">{timeAgo(h.startedAt)}</span>
                  {h.latencyMs != null && <span className="font-mono text-[10px] text-neutral-600">{(h.latencyMs / 1000).toFixed(1)}s</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
