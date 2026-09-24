"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, EmptyState, Field, Modal, Spinner, Toggle, inputCls } from "./ui";
import {
  IconBolt, IconCheck, IconCopy, IconExternal, IconEye, IconEyeOff, IconFolder, IconKey,
  IconPlus, IconRefresh, IconShield, IconTrash,
} from "./icons";
import { api, healthTone, loadVault, removeVaultKey, saveVaultKey, updateVaultKey, timeAgo, type VaultKey, type VaultResponse } from "@/lib/bu-client";

const notify = () => window.dispatchEvent(new Event("bu:keys"));

type Provider = "browser-use" | "deepseek" | "openrouter";

export default function KeyVault({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [provider, setProvider] = useState<Provider>("browser-use");
  const [data, setData] = useState<VaultResponse | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ id: number; text: string; ok: boolean } | null>(null);
  const [addOpen, setAddOpen] = useState(defaultOpen);
  const [folder, setFolder] = useState<string>("All");
  const [rotating, setRotating] = useState(false);
  const [checkingAll, setCheckingAll] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async (p: Provider) => {
    try {
      setData(await loadVault(p));
    } catch (e) {
      setToast((e as Error).message);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(provider);
  }, [provider, load]);

  const flash = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 2600);
  };

  const act = async (id: number, action: "activate" | "verify" | "move", extra?: { folder?: string }) => {
    setBusyId(id);
    setMsg(null);
    try {
      const r = await updateVaultKey(id, { action, ...extra });
      if (action === "verify") flash(r.key?.health === "healthy" ? "Key verified — healthy." : "Key verified — balance is low.");
      await load(provider);
      notify();
    } catch (e) {
      setMsg({ id, text: (e as Error).message, ok: false });
      await load(provider);
    } finally {
      setBusyId(null);
    }
  };

  const del = async (k: VaultKey) => {
    if (!confirm(`Remove “${k.name}” from the vault? The key itself is not revoked upstream.`)) return;
    await removeVaultKey(k.id);
    await load(provider);
    notify();
  };

  const rotate = async () => {
    if (!data?.keys.length) return;
    setRotating(true);
    try {
      await api("/api/vault/0", { method: "PATCH", body: { action: "rotate" } });
      await load(provider);
      notify();
      flash("Rotated to the next healthy key.");
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setRotating(false);
    }
  };

  const verifyAll = async () => {
    if (!data?.keys.length) return;
    setCheckingAll(true);
    try {
      await Promise.all(data.keys.map((k) => updateVaultKey(k.id, { action: "verify" }).catch(() => null)));
      await load(provider);
      notify();
      flash("Health check complete for every key.");
    } finally {
      setCheckingAll(false);
    }
  };

  const folders = useMemo(() => ["All", ...(data?.folders.map((f) => f.name) ?? [])], [data]);
  const visible = useMemo(() => {
    if (!data) return [];
    return folder === "All" ? data.keys : data.keys.filter((k) => k.folder === folder);
  }, [data, folder]);

  const active = data?.keys.find((k) => k.isActive) ?? data?.keys[0];
  const healthCount = data ? data.keys.filter((k) => k.health === "healthy").length : 0;

  const providerCopy: Record<Provider, { title: string; hint: string; cta: string }> = {
    "browser-use": {
      title: "Browser Use vault",
      hint: "Up to 10 keys. The active key drives every agent run; rotation switches to the next healthy key.",
      cta: "Create one at cloud.browser-use.com",
    },
    deepseek: {
      title: "DeepSeek keys",
      hint: "Powers deepseek-chat and deepseek-reasoner planning. The active key is used for agent planning.",
      cta: "Create one at platform.deepseek.com",
    },
    openrouter: {
      title: "OpenRouter keys",
      hint: "Used by Free / Fallback Agent Mode to plan tasks without a Browser Use executor.",
      cta: "Create one at openrouter.ai/keys",
    },
  };

  return (
    <section className="rounded-2xl border border-white/[0.07] p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-500/15 text-orange-300">
          <IconShield width={18} height={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-white">{providerCopy[provider].title}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-neutral-400">{providerCopy[provider].hint}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={verifyAll} loading={checkingAll} disabled={!data?.keys.length}>
            <IconShield width={13} height={13} /> Health check
          </Button>
          <Button size="sm" variant="secondary" onClick={rotate} loading={rotating} disabled={!data || data.keys.length < 2}>
            <IconRefresh width={13} height={13} /> Rotate
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)} disabled={(data?.count ?? 0) >= (data?.max ?? 10)}>
            <IconPlus width={14} height={14} /> Add key
          </Button>
        </div>
      </div>

      {/* Provider tabs */}
      <div className="mt-4 flex gap-1 rounded-lg border border-white/5 bg-white/[0.02] p-1 sm:w-fit">
        {(["browser-use", "deepseek", "openrouter"] as Provider[]).map((p) => (
          <button
            key={p}
            onClick={() => setProvider(p)}
            className={`h-7 flex-1 rounded-md px-3 text-[11.5px] capitalize sm:flex-none ${provider === p ? "bg-white/10 text-white" : "text-neutral-500 hover:text-neutral-300"}`}
          >
            {p === "browser-use" ? "Browser Use" : p}
          </button>
        ))}
      </div>

      {!data ? (
        <div className="mt-4 flex items-center gap-2 text-xs text-neutral-500">
          <Spinner className="h-3 w-3" /> Loading vault…
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Keys stored", value: `${data.count}/${data.max}`, icon: IconKey },
              { label: "Active key", value: active ? active.name : "—", icon: IconBolt },
              { label: "Healthy", value: `${healthCount}/${data.keys.length}`, icon: IconShield, live: healthCount > 0 },
              { label: "Balance", value: active?.creditsUsd != null ? `$${active.creditsUsd.toFixed(2)}` : "—", icon: IconFolder },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-white/[0.07] bg-white/[0.015] p-3">
                <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-neutral-500">
                  <s.icon width={12} height={12} /> {s.label}
                  {s.live && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 ring-pulse" />}
                </div>
                <p className="mt-1 truncate text-[15px] font-semibold text-white">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Folders */}
          {data.folders.length > 1 && (
            <div className="scroll-thin -mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {folders.map((f) => (
                <button
                  key={f}
                  onClick={() => setFolder(f)}
                  className={`h-7 shrink-0 rounded-full border px-3 text-[11.5px] transition ${
                    folder === f ? "border-orange-500/40 bg-orange-500/15 text-orange-200" : "border-white/10 text-neutral-400 hover:border-white/20 hover:text-white"
                  }`}
                >
                  <IconFolder width={11} height={11} className="mr-1 inline" />
                  {f}
                </button>
              ))}
            </div>
          )}

          {/* Keys */}
          {visible.length === 0 ? (
            <div className="mt-3">
              <EmptyState
                icon={<IconKey />}
                title={provider === "browser-use" ? "Your vault is empty" : `No ${provider} keys stored`}
                description={providerCopy[provider].cta}
                action={<Button size="sm" onClick={() => setAddOpen(true)}>Add key</Button>}
              />
            </div>
          ) : (
            <div className="stagger mt-3 space-y-2">
              {visible.map((k) => {
                const tone = healthTone(k.health);
                return (
                  <div key={k.id} className={`rounded-xl border p-3.5 transition ${k.isActive ? "border-orange-500/30 bg-orange-500/[0.04]" : "border-white/5 bg-white/[0.02]"}`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${k.isActive ? "bg-orange-500/20 text-orange-300" : "bg-white/5 text-neutral-400"}`}>
                          <IconKey width={15} height={15} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="truncate text-sm font-medium text-white">{k.name}</p>
                            {k.isActive && <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-medium text-orange-200">Active</span>}
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${tone.cls}`}>{tone.label}</span>
                            {data.folders.length > 1 && (
                              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-neutral-400">
                                <IconFolder width={9} height={9} className="mr-0.5 inline" />
                                {k.folder}
                              </span>
                            )}
                          </div>
                          <p className="font-mono text-[11px] text-neutral-500">{k.masked}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {!k.isActive && (
                          <Button size="sm" variant="secondary" loading={busyId === k.id} onClick={() => act(k.id, "activate")}>
                            Set active
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => act(k.id, "verify")} disabled={busyId === k.id}>
                          <IconRefresh width={13} height={13} /> Verify
                        </Button>
                        <button onClick={() => del(k)} className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-red-500/10 hover:text-red-300" aria-label="Remove key">
                          <IconTrash width={13} height={13} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/5 pt-2.5 text-[11px] text-neutral-500">
                      {k.creditsUsd != null && (
                        <span>
                          Balance: <span className="font-mono text-neutral-300">${k.creditsUsd.toFixed(2)}</span>
                        </span>
                      )}
                      {k.accountName && (
                        <span>
                          Account: <span className="text-neutral-300">{k.accountName}</span>
                        </span>
                      )}
                      <span>Added {timeAgo(k.createdAt)}</span>
                      {k.lastVerifiedAt && <span>Verified {timeAgo(k.lastVerifiedAt)}</span>}
                    </div>
                    {msg?.id === k.id && <p className={`mt-2 text-xs ${msg.ok ? "text-emerald-300" : "text-red-300"}`}>{msg.text}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {toast && (
        <div className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] px-3.5 py-2.5 text-xs text-emerald-200 fade-up">{toast}</div>
      )}

      <AddVaultKey
        open={addOpen}
        provider={provider}
        folders={data?.folders.map((f) => f.name) ?? []}
        onClose={() => setAddOpen(false)}
        onAdded={async () => {
          setAddOpen(false);
          await load(provider);
          notify();
        }}
      />
    </section>
  );
}

function AddVaultKey({
  open, onClose, onAdded, provider, folders,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
  provider: Provider;
  folders: string[];
}) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [folder, setFolder] = useState("Default");
  const [show, setShow] = useState(false);
  const [skipVerify, setSkipVerify] = useState(false);
  const [activate, setActivate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName("");
      setKey("");
      setFolder("Default");
      setErr(null);
      setSkipVerify(false);
      setActivate(true);
    }
  }, [open, provider]);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await saveVaultKey({ name, key, provider, folder, skipVerify, activate });
      onAdded();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const link = provider === "deepseek" ? "https://platform.deepseek.com/api_keys" : provider === "openrouter" ? "https://openrouter.ai/keys" : "https://cloud.browser-use.com/settings?tab=api-keys&new=1";
  const prefix = provider === "browser-use" ? "bu_••••••••••••••••" : provider === "deepseek" ? "sk-••••••••••••••••" : "sk-or-••••••••••••••";

  return (
    <Modal open={open} onClose={onClose} title={`Add ${provider === "browser-use" ? "Browser Use" : provider} key`}>
      <div className="space-y-4">
        <a href={link} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-[11.5px] text-neutral-400 hover:border-white/15 hover:text-white">
          <IconKey width={13} height={13} className="text-orange-300" />
          <span className="flex-1">Need a key? Open the provider dashboard</span>
          <IconExternal width={12} height={12} />
        </a>
        <Field label="Label">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={provider === "browser-use" ? "Production" : provider === "deepseek" ? "DEEPSEEK_API_KEY" : "Fallback planner"} className={inputCls} />
        </Field>
        <Field label="Vault folder" hint="Group keys by project or client — e.g. INSUS, Personal, Client A.">
          <input value={folder} onChange={(e) => setFolder(e.target.value)} list="vault-folders" placeholder="Default" className={inputCls} />
          <datalist id="vault-folders">
            {Array.from(new Set(["Default", "INSUS", "Personal", ...folders])).map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </Field>
        <Field label="API key" hint={skipVerify ? "Saved without verification." : "Verified against the provider before saving."}>
          <div className="relative">
            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              type={show ? "text" : "password"}
              placeholder={prefix}
              className={`${inputCls} pr-10 font-mono`}
              autoFocus
              autoComplete="off"
              onKeyDown={(e) => e.key === "Enter" && key.trim() && submit()}
            />
            <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-500 hover:text-white" aria-label={show ? "Hide key" : "Show key"}>
              {show ? <IconEyeOff width={15} height={15} /> : <IconEye width={15} height={15} />}
            </button>
          </div>
        </Field>
        <div className="rounded-lg border border-white/5 px-3">
          <Toggle checked={activate} onChange={setActivate} label="Make this the active key" />
          <Toggle checked={skipVerify} onChange={setSkipVerify} label="Skip verification" />
        </div>
        {err && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">{err}</p>}
        <Button onClick={submit} loading={busy} disabled={!key.trim()} className="w-full">
          <IconCheck width={14} height={14} /> {skipVerify ? "Save key" : "Verify & save"}
        </Button>
      </div>
    </Modal>
  );
}
