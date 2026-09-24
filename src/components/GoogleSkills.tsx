"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, EmptyState, Field, PageHeader, Spinner, inputCls } from "@/components/ui";
import { ExecutorSelect, ModelSelect } from "@/components/Composer";
import { ExecutionFeed, ScheduleFields, scheduleToBody, type ScheduleState } from "@/components/automation-ui";
import { IconCloud, IconFile, IconGoogle, IconMail, IconPlay, IconSearch, IconShield } from "@/components/icons";
import { api, dispatchAgent, isDeepseekModel, loadVault, type GoogleFile, type GoogleStatus, type VaultResponse } from "@/lib/bu-client";

type SkillId = "drive-search" | "file-fetch" | "doc-export" | "gmail-digest" | "folder-report";

const SKILLS: { id: SkillId; title: string; desc: string; icon: typeof IconSearch; needsQuery: boolean }[] = [
  { id: "drive-search", title: "Drive search", desc: "Find files by name or content across Drive", icon: IconSearch, needsQuery: true },
  { id: "file-fetch", title: "File fetch", desc: "Open a file and summarise its contents", icon: IconFile, needsQuery: true },
  { id: "doc-export", title: "Document export", desc: "Export a Doc or Sheet to PDF / Word / CSV", icon: IconFile, needsQuery: true },
  { id: "gmail-digest", title: "Gmail digest", desc: "Summarise recent inbox messages", icon: IconMail, needsQuery: false },
  { id: "folder-report", title: "Folder report", desc: "Inventory a Drive folder with owner and size", icon: IconCloud, needsQuery: true },
];

/** Google Workspace skills: runnable directly against the Google APIs, or handed to a browser agent. */
export default function GoogleSkills() {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [skill, setSkill] = useState<SkillId>("drive-search");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState("25");
  const [busy, setBusy] = useState<"run" | "agent" | "save" | null>(null);
  const [files, setFiles] = useState<GoogleFile[] | null>(null);
  const [digest, setDigest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [model, setModel] = useState("gpt-5.6-luna");
  const [executor, setExecutor] = useState("gpt-5.6-luna");
  const [schedule, setSchedule] = useState<ScheduleState>({ scheduleType: "manual", intervalMinutes: "1440", runAt: "", dailyTime: "06:00" });
  const [showSchedule, setShowSchedule] = useState(false);
  const [feedKey, setFeedKey] = useState(0);
  const [vault, setVault] = useState<VaultResponse | null>(null);

  useEffect(() => {
    api<GoogleStatus>("/api/google?action=status").then(setStatus).catch(() => setStatus(null));
    loadVault("openrouter").catch(() => {});
  }, []);

  const current = useMemo(() => SKILLS.find((s) => s.id === skill)!, [skill]);

  const runSkill = async () => {
    setBusy("run");
    setError(null);
    setFiles(null);
    setDigest(null);
    try {
      if (skill === "gmail-digest") {
        const r = await api<{ messages: { subject: string; from: string; date: string; snippet: string }[] }>(`/api/google?action=gmail&limit=${limit}&q=${encodeURIComponent(query)}`);
        const text = r.messages.length
          ? r.messages.map((m, i) => `${i + 1}. ${m.subject || "(no subject)"}\n   From: ${m.from}\n   ${m.date}\n   ${m.snippet}`).join("\n\n")
          : "No messages matched.";
        setDigest(text);
      } else {
        const action = skill === "folder-report" ? "list" : "search";
        const r = await api<{ files: GoogleFile[] }>(`/api/google?action=${action}&q=${encodeURIComponent(query)}&limit=${limit}`);
        setFiles(r.files);
        if (skill === "doc-export" && r.files.length) {
          setOutcome(`Ready — ${r.files.length} file(s). Use Export in the Google Workspace panel or the viewer to pull PDF/Word/CSV.`);
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const buildPrompt = () => {
    const goal = {
      "drive-search": `Search Google Drive for "${query}" and summarise the 5 most relevant files with owner, last-modified date and what each file is about.`,
      "file-fetch": `Open the Google Drive file matching "${query}", read its contents and return a structured summary plus any action items.`,
      "doc-export": `Locate the Google Drive document matching "${query}" and confirm it can be exported to PDF. Report the exact title, owner and link.`,
      "gmail-digest": `Review my recent Gmail messages${query ? ` matching "${query}"` : ""} and produce a prioritised digest with sender, subject and the action required.`,
      "folder-report": `Inventory the Google Drive folder matching "${query}" and return a table of file name, type, owner and size, noting anything modified in the last 7 days.`,
    }[skill];
    return `You are the Google Workspace integration skill for the Symphony agent hub.

${goal}

Rules:
- Use official Google Workspace interfaces (drive.google.com, docs.google.com, sheets.google.com, mail.google.com).
- Read-only: never delete, share or change permissions on any file.
- If a login, MFA or captcha blocks you, stop and report exactly what the operator must do.
- Verify owners and dates before reporting them.

Deliverable: a concise report with a results table, the direct file links, and next actions.`;
  };

  const handToAgent = async () => {
    setBusy("agent");
    setOutcome(null);
    try {
      const d = await dispatchAgent({
        task: buildPrompt(),
        model,
        executorModel: isDeepseekModel(model) ? executor : undefined,
        source: "manual",
        label: `Google Workspace · ${current.title}${query ? ` · ${query}` : ""}`,
        browserSettings: { proxyCountryCode: "us" },
      });
      setOutcome(`Dispatched${d.plannerModel ? " with a plan" : ""}. Open the session to watch the cloud browser work.`);
      window.dispatchEvent(new Event("bu:sessions"));
    } catch (e) {
      setOutcome((e as Error).message);
    } finally {
      setBusy(null);
      setFeedKey((k) => k + 1);
    }
  };

  const saveRoutine = async () => {
    setBusy("save");
    setOutcome(null);
    try {
      await api("/api/automations", {
        method: "POST",
        body: {
          name: `Google Workspace · ${current.title}${query ? ` · ${query}` : ""}`,
          description: current.desc,
          kind: "agent",
          source: "tasker",
          workflow: "google-workspace",
          template: buildPrompt(),
          model,
          executorModel: isDeepseekModel(model) ? executor : null,
          browserSettings: { proxyCountryCode: "us" },
          ...scheduleToBody(schedule),
        },
      });
      setOutcome(`Saved to All Automations${schedule.scheduleType !== "manual" ? " with its schedule" : ""}. The Google Workspace skill runs automatically.`);
    } catch (e) {
      setOutcome((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.03] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-500/15 text-sky-300">
            <IconGoogle width={18} height={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-white">Real-time Google Workspace skills</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-neutral-400">
              Run these directly against the Google APIs (fast, no browser) or hand them to a cloud browser agent for deeper research. Files open in the in-dashboard viewer.
            </p>
          </div>
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium ${status?.connected ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-white/10 bg-white/5 text-neutral-400"}`}>
            {status?.connected ? "Connected" : "Connect in Settings"}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-5">
          {SKILLS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSkill(s.id)}
              aria-pressed={skill === s.id}
              className={`rounded-xl border p-3 text-left transition press ${skill === s.id ? "border-sky-500/50 bg-sky-500/[0.1]" : "border-white/8 hover:border-white/20"}`}
            >
              <s.icon width={15} height={15} className={skill === s.id ? "text-sky-300" : "text-neutral-400"} />
              <p className="mt-2 text-[12.5px] font-medium leading-snug text-white">{s.title}</p>
              <p className="mt-0.5 hidden text-[10.5px] leading-snug text-neutral-500 sm:block">{s.desc}</p>
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
          <Field label={skill === "folder-report" ? "Folder name or ID" : skill === "gmail-digest" ? "Optional search (leave blank for inbox)" : "File name or search phrase"}>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={current.needsQuery ? "e.g. INSUS candidate report" : "e.g. from:client@example.com"} className={inputCls} />
          </Field>
          <Field label="Limit">
            <input value={limit} onChange={(e) => setLimit(e.target.value)} type="number" min="1" max="100" className={inputCls} />
          </Field>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Button onClick={runSkill} loading={busy === "run"} disabled={Boolean(busy)} className="flex-1">
            {busy !== "run" && <IconPlay width={12} height={12} />} Run skill now
          </Button>
          <Button variant="secondary" onClick={handToAgent} loading={busy === "agent"} disabled={Boolean(busy)}>
            Run with cloud browser
          </Button>
          <Button variant="ghost" onClick={() => setShowSchedule((v) => !v)}>
            {showSchedule ? "Hide schedule" : "Schedule / save"}
          </Button>
        </div>

        {showSchedule && (
          <div className="mt-3 space-y-3 border-t border-white/[0.07] pt-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Agent model">
                <ModelSelect value={model} onChange={setModel} />
              </Field>
              {isDeepseekModel(model) && (
                <Field label="Executor model">
                  <ExecutorSelect value={executor} onChange={setExecutor} />
                </Field>
              )}
            </div>
            <ScheduleFields value={schedule} onChange={setSchedule} />
            <Button variant="secondary" size="sm" onClick={saveRoutine} loading={busy === "save"} disabled={Boolean(busy)}>
              {schedule.scheduleType === "manual" ? "Save as automation" : "Save & schedule"}
            </Button>
          </div>
        )}

        {error && <p className="mt-3 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}
        {outcome && <p className="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">{outcome}</p>}

        {digest && (
          <pre className="scroll-thin mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-white/5 bg-sunken p-3 font-mono text-[11px] leading-relaxed text-neutral-300">{digest}</pre>
        )}
        {files && (
          <div className="stagger mt-3 divide-y divide-white/5 overflow-hidden rounded-xl border border-white/[0.07]">
            {files.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-neutral-500">No files matched.</p>
            ) : (
              files.slice(0, 10).map((f) => (
                <div key={f.id} className="flex items-center gap-3 px-3.5 py-2.5">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-neutral-400">
                    <IconFile width={14} height={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-white">{f.name}</p>
                    <p className="truncate text-[11px] text-neutral-500">{[f.owners[0], f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString() : ""].filter(Boolean).join(" · ")}</p>
                  </div>
                  <a href={`/api/google?action=export&id=${encodeURIComponent(f.id)}&kind=pdf`} target="_blank" rel="noreferrer" className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-[11px] text-neutral-300 hover:bg-white/5">
                    Preview
                  </a>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Recent Workspace &amp; agent runs</p>
        <ExecutionFeed query="" limit={10} refreshKey={feedKey} emptyText="Run a Workspace skill to see results here." />
      </div>

      {!vault && null}
    </div>
  );
}

export function GoogleSkillsHeader() {
  return <PageHeader title="Google Workspace Skills" description="Drive search, file fetching, document export and Gmail digests." />;
}

export function GoogleSkillsEmpty({ onClose }: { onClose: () => void }) {
  return (
    <EmptyState
      icon={<IconShield />}
      title="Google Workspace not connected"
      description="Connect an account in Settings → Google Workspace to enable these skills."
      action={
        <Button size="sm" onClick={onClose}>
          Close
        </Button>
      }
    />
  );
}

export function GoogleSkillsSpinner() {
  return (
    <div className="flex items-center gap-2 text-xs text-neutral-500">
      <Spinner className="h-3 w-3" /> Loading…
    </div>
  );
}
