"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, EmptyState, ErrorBox, Field, Modal, PageHeader, Spinner, inputCls } from "@/components/ui";
import { IconCheck, IconCopy, IconPlus, IconSearch, IconTrash, IconUser } from "@/components/icons";
import { ApiError, bu, timeAgo, type Paged, type Profile } from "@/lib/bu-client";

export default function ProfilesPage() {
  const [data, setData] = useState<Paged<Profile> | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Profile | "new" | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      setData(await bu<Paged<Profile>>(`v4/profiles?pageSize=100&pageNumber=1${q ? `&query=${encodeURIComponent(q)}` : ""}`));
      setError(null);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(query), 250);
    return () => clearTimeout(t);
  }, [query, load]);

  const del = async (p: Profile) => {
    if (!confirm(`Delete profile "${p.name || p.id}"? This permanently removes its cookies and state.`)) return;
    try {
      await bu(`v4/profiles/${p.id}`, { method: "DELETE" });
      load(query);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const items = data?.items ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        title="Profiles"
        description="Persist cookies, local storage and logins across agent runs and browser sessions."
        actions={
          <Button size="sm" onClick={() => setEditing("new")}>
            <IconPlus width={14} height={14} /> New profile
          </Button>
        }
      />

      <div className="relative mb-4 sm:max-w-sm">
        <IconSearch width={15} height={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search profiles…" className={`${inputCls} pl-9`} />
      </div>

      {error ? (
        <ErrorBox error={error} />
      ) : loading && !data ? (
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Spinner /> Loading profiles…
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={<IconUser />} title="No profiles yet" description="Create a profile, then select it in the agent settings to reuse logins." action={<Button size="sm" onClick={() => setEditing("new")}>Create profile</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <div key={p.id} className="group rounded-xl border border-white/5 bg-white/[0.02] p-4 transition hover:border-white/10">
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-orange-400/30 to-orange-600/10 text-sm font-semibold text-orange-200">
                  {(p.name || "P").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{p.name || "Untitled profile"}</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(p.id).catch(() => {});
                      setCopied(p.id);
                      setTimeout(() => setCopied(null), 1500);
                    }}
                    className="flex items-center gap-1 font-mono text-[10px] text-neutral-500 hover:text-neutral-300"
                  >
                    {p.id.slice(0, 18)}… {copied === p.id ? <IconCheck width={10} height={10} /> : <IconCopy width={10} height={10} />}
                  </button>
                </div>
              </div>
              {p.cookieDomains && p.cookieDomains.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {p.cookieDomains.slice(0, 5).map((d) => (
                    <span key={d} className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">
                      {d}
                    </span>
                  ))}
                  {p.cookieDomains.length > 5 && <span className="text-[10px] text-neutral-500">+{p.cookieDomains.length - 5}</span>}
                </div>
              )}
              <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
                <span className="text-[11px] text-neutral-500">{p.lastUsedAt ? `Used ${timeAgo(p.lastUsedAt)}` : `Created ${timeAgo(p.createdAt)}`}</span>
                <div className="flex gap-1">
                  <button onClick={() => setEditing(p)} className="rounded-md px-2 py-1 text-xs text-neutral-400 hover:bg-white/5 hover:text-white">
                    Edit
                  </button>
                  <button onClick={() => del(p)} className="rounded-md p-1.5 text-neutral-500 hover:bg-red-500/10 hover:text-red-300">
                    <IconTrash width={13} height={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <ProfileModal
          profile={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load(query);
          }}
        />
      )}
    </div>
  );
}

function ProfileModal({ profile, onClose, onSaved }: { profile: Profile | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(profile?.name ?? "");
  const [userId, setUserId] = useState(profile?.userId ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const body = { name: name || null, userId: userId || null };
      if (profile) await bu(`v4/profiles/${profile.id}`, { method: "PATCH", body });
      else await bu("v4/profiles", { method: "POST", body });
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={profile ? "Edit profile" : "New profile"}>
      <div className="space-y-4">
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. LinkedIn account" className={inputCls} autoFocus />
        </Field>
        <Field label="User ID (optional)" hint="Your own identifier to map profiles to end users">
          <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="user_123" className={inputCls} />
        </Field>
        {err && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">{err}</p>}
        <Button onClick={save} loading={busy} className="w-full">
          {profile ? "Save changes" : "Create profile"}
        </Button>
      </div>
    </Modal>
  );
}
