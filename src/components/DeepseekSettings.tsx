"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Spinner, inputCls } from "./ui";
import { IconEye, IconEyeOff, IconExternal, IconRefresh, IconSpark, IconTrash } from "./icons";
import { timeAgo } from "@/lib/bu-client";

type Row = {
  id: number;
  name: string;
  masked: string;
  isActive: boolean;
  creditsUsd: number | null;
  accountName: string | null;
  lastVerifiedAt: string | null;
  createdAt: string;
  health?: "unknown" | "healthy" | "low" | "invalid";
};

export default function DeepseekSettings() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [env, setEnv] = useState(false);
  const [vaultCount, setVaultCount] = useState(0);
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [test, setTest] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/keys", { cache: "no-store" }).then((r) => r.json());
    setRows(r.deepseek ?? []);
    setEnv(Boolean(r.envDeepseek));
    setVaultCount((r.deepseek ?? []).length);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const notify = () => window.dispatchEvent(new Event("bu:keys"));

  const save = async () => {
    setBusy("save");
    setMsg(null);
    const r = await fetch("/api/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: "deepseek", name: "DEEPSEEK_API_KEY", key }) });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) return setMsg({ ok: false, text: j.error ?? "Failed to save" });
    setKey("");
    setMsg({ ok: true, text: "DeepSeek key verified and saved." });
    load();
    notify();
  };

  const verify = async (id: number) => {
    setBusy(`v${id}`);
    const r = await fetch(`/api/keys/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "verify" }) });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    setMsg(r.ok ? { ok: true, text: "Key is valid." } : { ok: false, text: j.error ?? "Verification failed" });
    load();
  };

  const remove = async (id: number) => {
    if (!confirm("Remove the DeepSeek key?")) return;
    await fetch(`/api/keys/${id}`, { method: "DELETE" });
    load();
    notify();
  };

  const runTest = async () => {
    setBusy("test");
    setTest(null);
    try {
      const r = await fetch("/api/deepseek/test", { method: "POST" });
      const j = await r.json();
      setTest(r.ok ? j.plan : `Error: ${j.error}`);
    } catch (e) {
      setTest(`Error: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const active = rows?.find((r) => r.isActive) ?? rows?.[0];

  return (
    <section className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.03] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-500/15 text-sky-300">
          <IconSpark width={18} height={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-white">DeepSeek</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-neutral-400">
            Powers <span className="font-mono text-sky-300">deepseek-chat</span> (DeepSeek-V3) and <span className="font-mono text-sky-300">deepseek-reasoner</span> (DeepSeek-R1) for agent planning. DeepSeek drafts the plan; a Browser Use executor runs it.
            {vaultCount > 0 && (
              <>
                {" "}
                <span className="text-neutral-300">{vaultCount} key{vaultCount === 1 ? "" : "s"}</span> in the vault — manage rotation in the Key vault tab.
              </>
            )}
          </p>
        </div>
        <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer" className="hidden items-center gap-1 text-xs text-neutral-400 hover:text-white sm:flex">
          Get key <IconExternal width={12} height={12} />
        </a>
      </div>

      {!rows ? (
        <div className="mt-4 flex items-center gap-2 text-xs text-neutral-500">
          <Spinner className="h-3 w-3" /> Loading…
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {active && (
            <div className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-canvas p-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-mono text-[12px] text-white">DEEPSEEK_API_KEY</p>
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">Connected</span>
                </div>
                <p className="mt-0.5 font-mono text-[11px] text-neutral-500">
                  {active.masked}
                  {active.creditsUsd != null && ` · balance ${active.creditsUsd.toFixed(2)}`}
                  {active.lastVerifiedAt && ` · verified ${timeAgo(active.lastVerifiedAt)}`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={runTest} loading={busy === "test"}>
                  Test plan
                </Button>
                <Button size="sm" variant="ghost" onClick={() => verify(active.id)} loading={busy === `v${active.id}`}>
                  <IconRefresh width={13} height={13} /> Verify
                </Button>
                <button onClick={() => remove(active.id)} className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-red-500/10 hover:text-red-300" aria-label="Remove DeepSeek key">
                  <IconTrash width={13} height={13} />
                </button>
              </div>
            </div>
          )}
          {!active && env && <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] px-3 py-2 text-xs text-emerald-300">Using DEEPSEEK_API_KEY from the environment.</p>}

          <div>
            <label htmlFor="ds-key" className="mb-1.5 block text-xs font-medium text-neutral-300">
              {active ? "Replace DEEPSEEK_API_KEY" : "DEEPSEEK_API_KEY"}
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <input
                  id="ds-key"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  type={show ? "text" : "password"}
                  placeholder="sk-••••••••••••••••••••"
                  autoComplete="off"
                  onKeyDown={(e) => e.key === "Enter" && key.trim() && save()}
                  className={`${inputCls} pr-10 font-mono`}
                />
                <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-500 hover:text-white" aria-label={show ? "Hide key" : "Show key"}>
                  {show ? <IconEyeOff width={15} height={15} /> : <IconEye width={15} height={15} />}
                </button>
              </div>
              <Button onClick={save} loading={busy === "save"} disabled={!key.trim()}>
                Verify & save
              </Button>
            </div>
          </div>
          {msg && <p className={`text-xs ${msg.ok ? "text-emerald-300" : "text-red-300"}`}>{msg.text}</p>}
          {test && <pre className="scroll-thin max-h-60 overflow-auto whitespace-pre-wrap rounded-lg border border-white/5 bg-sunken p-3 font-mono text-[11px] text-neutral-300">{test}</pre>}
        </div>
      )}
    </section>
  );
}
