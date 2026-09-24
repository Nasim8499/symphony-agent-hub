import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { maskKey, verifyKeyFor, type Provider } from "@/lib/bu-server";
import { listVault, shapeKey, healthFromCredits, MAX_VAULT_KEYS } from "@/lib/vault";
import { getSettings, publicSettings } from "@/lib/settings";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const VALID: Provider[] = ["browser-use", "deepseek", "openrouter"];

export async function GET(req: Request) {
  const provider = (new URL(req.url).searchParams.get("provider") ?? "browser-use") as Provider;
  const target: Provider = VALID.includes(provider) ? provider : "browser-use";
  const vault = await listVault(target as "browser-use" | "deepseek" | "openrouter");
  const settings = await getSettings();
  return Response.json({ ...vault, max: MAX_VAULT_KEYS, provider: target, settings: publicSettings(settings) });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    key?: string;
    provider?: Provider;
    folder?: string;
    skipVerify?: boolean;
    activate?: boolean;
  };
  const provider: Provider = VALID.includes(body.provider as Provider) ? (body.provider as Provider) : "browser-use";
  const key = (body.key ?? "").trim();
  const name = (body.name ?? "").trim() || (provider === "deepseek" ? "DeepSeek" : provider === "openrouter" ? "OpenRouter" : "Browser Use key");
  const folder = (body.folder ?? "").trim() || "Default";
  if (!key) return Response.json({ error: "API key is required" }, { status: 400 });

  const existing = await db.select({ id: apiKeys.id }).from(apiKeys).where(eq(apiKeys.provider, provider));
  if (existing.length >= MAX_VAULT_KEYS) {
    return Response.json({ error: `The vault holds up to ${MAX_VAULT_KEYS} keys per provider. Remove one first.`, code: "VAULT_FULL" }, { status: 400 });
  }

  let accountName: string | null = null;
  let projectId: string | null = null;
  let creditsUsd: number | null = null;
  let health: "unknown" | "healthy" | "low" | "invalid" = "unknown";

  if (!body.skipVerify) {
    const v = await verifyKeyFor(provider, key);
    if (!v.ok) return Response.json({ error: `Key verification failed: ${v.error}` }, { status: 400 });
    accountName = v.accountName;
    projectId = v.projectId;
    creditsUsd = v.credits;
    health = provider === "browser-use" ? healthFromCredits(v.credits) : "healthy";
  }

  const shouldActivate = body.activate !== false;
  const result = await db.transaction(async (tx) => {
    if (shouldActivate) await tx.update(apiKeys).set({ isActive: false }).where(eq(apiKeys.provider, provider));
    const [row] = await tx
      .insert(apiKeys)
      .values({ provider, name, key, folder, isActive: shouldActivate, accountName, projectId, creditsUsd, health, lastVerifiedAt: body.skipVerify ? null : new Date() })
      .returning();
    return row;
  });

  // First DeepSeek key becomes the routing default.
  if (provider === "deepseek") {
    const s = await getSettings();
    if (s.deepseekPlanningModel === "deepseek-chat") {
      const { updateSettings } = await import("@/lib/settings");
      await updateSettings({ deepseekPlanningModel: "deepseek-chat" });
    }
  }

  return Response.json({ key: shapeKey(result, true), id: result.id, name: result.name, masked: maskKey(result.key) });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  const all = url.searchParams.get("all") === "1";
  const provider = url.searchParams.get("provider") as Provider | null;
  if (all && provider) {
    await db.delete(apiKeys).where(eq(apiKeys.provider, provider));
    return Response.json({ ok: true });
  }
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  const [row] = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
  await db.delete(apiKeys).where(eq(apiKeys.id, id));
  // Promote a replacement if the removed row was active.
  if (row?.isActive) {
    const next = await db.select().from(apiKeys).where(eq(apiKeys.provider, row.provider)).orderBy(desc(apiKeys.createdAt)).limit(1);
    if (next[0]) await db.update(apiKeys).set({ isActive: true }).where(eq(apiKeys.id, next[0].id));
  }
  return Response.json({ ok: true });
}
