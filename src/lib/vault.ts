import { db, ensureSchema } from "@/db";
import { apiKeys } from "@/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";

export const MAX_VAULT_KEYS = 10;

export type VaultKey = {
  id: number;
  provider: string;
  name: string;
  folder: string;
  masked: string;
  isActive: boolean;
  accountName: string | null;
  projectId: string | null;
  creditsUsd: number | null;
  health: "unknown" | "healthy" | "low" | "invalid";
  lastVerifiedAt: string | null;
  createdAt: string;
};

const mask = (key: string) => (key.length <= 10 ? "••••••••" : `${key.slice(0, 6)}••••••••${key.slice(-4)}`);

/** Credit-based health so the dashboard can flag keys before a run fails. */
export function healthFromCredits(credits: number | null | undefined): VaultKey["health"] {
  if (credits === null || credits === undefined) return "unknown";
  if (credits <= 0) return "invalid";
  if (credits < 1) return "low";
  return "healthy";
}

export function shapeKey(row: typeof apiKeys.$inferSelect, isActive: boolean): VaultKey {
  return {
    id: row.id,
    provider: row.provider,
    name: row.name,
    folder: row.folder || "Default",
    masked: mask(row.key),
    isActive,
    accountName: row.accountName,
    projectId: row.projectId,
    creditsUsd: row.creditsUsd,
    health: (row.health as VaultKey["health"]) || "unknown",
    lastVerifiedAt: row.lastVerifiedAt ? row.lastVerifiedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** All keys of a provider, grouped for the folder/vault UI. */
export async function listVault(provider: "browser-use" | "deepseek" | "openrouter" = "browser-use"): Promise<{ keys: VaultKey[]; folders: { name: string; keys: VaultKey[] }[]; activeId: number | null; count: number }> {
  await ensureSchema();
  const rows = await db.select().from(apiKeys).where(eq(apiKeys.provider, provider)).orderBy(desc(apiKeys.createdAt));
  const activeRow = rows.find((r) => r.isActive) ?? rows[0] ?? null;
  const keys = rows.map((r) => shapeKey(r, r.id === activeRow?.id));
  const byFolder = new Map<string, VaultKey[]>();
  for (const k of keys) {
    const list = byFolder.get(k.folder) ?? [];
    list.push(k);
    byFolder.set(k.folder, list);
  }
  const folders = Array.from(byFolder.entries())
    .map(([name, list]) => ({ name, keys: list.sort((a, b) => Number(b.isActive) - Number(a.isActive)) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { keys, folders, activeId: activeRow?.id ?? null, count: rows.length };
}

export async function vaultCount(): Promise<number> {
  await ensureSchema();
  const rows = await db.select({ id: apiKeys.id }).from(apiKeys).where(eq(apiKeys.provider, "browser-use"));
  return rows.length;
}

/**
 * Picks the active key for a run. When the active key is the same as the failing one,
 * rotation moves to the next healthy key in insertion order.
 */
export async function rotateVaultKey(fromId?: number | null): Promise<VaultKey | null> {
  await ensureSchema();
  const rows = await db.select().from(apiKeys).where(eq(apiKeys.provider, "browser-use")).orderBy(asc(apiKeys.createdAt));
  if (!rows.length) return null;
  const usable = rows.filter((r) => r.health !== "invalid");
  const pool = usable.length ? usable : rows;
  const currentIdx = pool.findIndex((r) => r.id === fromId);
  const next = pool[(currentIdx + 1 + pool.length) % pool.length] ?? pool[0];
  await db.transaction(async (tx) => {
    await tx.update(apiKeys).set({ isActive: false }).where(and(eq(apiKeys.provider, "browser-use")));
    await tx.update(apiKeys).set({ isActive: true }).where(eq(apiKeys.id, next.id));
  });
  return shapeKey(next, true);
}

export async function setActive(id: number): Promise<void> {
  await ensureSchema();
  const [row] = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
  if (!row) return;
  await db.transaction(async (tx) => {
    await tx.update(apiKeys).set({ isActive: false }).where(eq(apiKeys.provider, row.provider));
    await tx.update(apiKeys).set({ isActive: true }).where(eq(apiKeys.id, id));
  });
}
