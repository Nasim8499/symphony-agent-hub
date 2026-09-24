"use client";

import { useEffect, useState } from "react";
import { Button, PageHeader } from "@/components/ui";
import { IconCheck, IconCopy, IconExternal, IconGoogle, IconKey } from "@/components/icons";
import { timeAgo } from "@/lib/bu-client";
import KeyVault from "@/components/KeyVault";
import FallbackSettings from "@/components/FallbackSettings";
import GoogleWorkspace from "@/components/GoogleWorkspace";
import DeepseekSettings from "@/components/DeepseekSettings";
import ThemeToggle from "@/components/ThemeToggle";
import InstallCard from "@/components/InstallCard";

type Tab = "vault" | "mode" | "workspace" | "appearance";

const TABS: { id: Tab; label: string }[] = [
  { id: "vault", label: "Key vault" },
  { id: "mode", label: "Agent mode & models" },
  { id: "workspace", label: "Google Workspace" },
  { id: "appearance", label: "Appearance & install" },
];

export default function ApiKeysPage() {
  const [tab, setTab] = useState<Tab>("vault");
  const [lang, setLang] = useState<"curl" | "ts" | "py">("curl");
  const [copied, setCopied] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab") as Tab | null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (t && TABS.some((x) => x.id === t)) setTab(t);
    if (params.get("new") === "1") {
      setTab("vault");
      setAddOpen(true);
    }
  }, []);

  const snippets = {
    curl: `curl https://api.browser-use.com/api/v4/runs \\\n  -H "X-Browser-Use-API-Key: $BROWSER_USE_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"task":"Find the top Hacker News story"}'`,
    ts: `import { BrowserUse } from "browser-use-sdk/v4";\n\nconst client = new BrowserUse();\nconst run = await client.runs.create({\n  task: "Find the top Hacker News story",\n});\nconst result = await client.runs.waitForCompletion(run.id);\nconsole.log(result.result);`,
    py: `from browser_use_sdk.v4 import BrowserUse\n\nwith BrowserUse() as client:\n    run = client.runs.create("Find the top Hacker News story")\n    result = client.runs.wait_for_completion(run.id)\n    print(result.result)`,
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        title="API Keys & Settings"
        description="Vault of up to 10 Browser Use keys, free/fallback agent mode, DeepSeek routing and Google Workspace — all stored server-side."
        actions={
          <Button size="sm" onClick={() => { setTab("vault"); setAddOpen(true); }}>
            <IconKey width={14} height={14} /> Add API key
          </Button>
        }
      />

      <a
        href="https://cloud.browser-use.com/settings?tab=api-keys&new=1"
        target="_blank"
        rel="noreferrer"
        className="mb-5 flex items-center gap-3 rounded-xl border border-white/5 bg-gradient-to-r from-orange-500/10 to-transparent px-4 py-3 text-sm text-neutral-300 transition hover:border-orange-500/30"
      >
        <IconKey width={16} height={16} className="shrink-0 text-orange-300" />
        <span className="flex-1">
          Don&apos;t have a key? Create one at <span className="text-white">cloud.browser-use.com</span> (starts with <code className="font-mono text-orange-200">bu_</code>), or turn on Free / Fallback Agent Mode to run without one.
        </span>
        <IconExternal width={14} height={14} className="shrink-0 text-neutral-500" />
      </a>

      {/* Tabs */}
      <div className="scroll-thin mb-5 flex gap-1 overflow-x-auto border-b border-white/[0.07]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2.5 text-[13px] transition ${tab === t.id ? "border-orange-400 font-medium text-white" : "border-transparent text-neutral-500 hover:text-neutral-300"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "vault" && (
        <div className="space-y-8 fade-up">
          <KeyVault defaultOpen={addOpen} />
          <DeepseekSettings />
        </div>
      )}

      {tab === "mode" && (
        <div className="fade-up">
          <FallbackSettings />
        </div>
      )}

      {tab === "workspace" && (
        <div className="fade-up">
          <GoogleWorkspace />
        </div>
      )}

      {tab === "appearance" && (
        <div className="space-y-4 fade-up">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.07] p-4 sm:p-5">
            <div>
              <h2 className="text-sm font-semibold text-white">Appearance</h2>
              <p className="mt-0.5 text-xs text-neutral-500">Light is the default. Your choice is saved on this device.</p>
            </div>
            <ThemeToggle />
          </div>
          <InstallCard />
        </div>
      )}

      <div className="mt-10">
        <h2 className="mb-3 text-sm font-semibold text-white">Quickstart</h2>
        <div className="overflow-hidden rounded-xl border border-white/5">
          <div className="flex items-center gap-1 border-b border-white/5 bg-white/[0.02] px-2 py-1.5">
            {([["curl", "cURL"], ["ts", "TypeScript"], ["py", "Python"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setLang(k)} className={`h-7 rounded-md px-2.5 text-xs ${lang === k ? "bg-white/10 text-white" : "text-neutral-500 hover:text-neutral-300"}`}>
                {l}
              </button>
            ))}
            <button
              onClick={() => {
                navigator.clipboard.writeText(snippets[lang]).catch(() => {});
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="ml-auto flex items-center gap-1 px-2 text-xs text-neutral-400 hover:text-white"
            >
              {copied ? <IconCheck width={12} height={12} /> : <IconCopy width={12} height={12} />} Copy
            </button>
          </div>
          <pre className="scroll-thin overflow-x-auto bg-black/50 p-4 font-mono text-[11px] leading-relaxed text-neutral-300">{snippets[lang]}</pre>
        </div>
      </div>
    </div>
  );
}

/** Kept for the legacy import path used by older builds. */
export function LegacyDeepseekPanel() {
  return <DeepseekSettings />;
}

export type { Tab };
