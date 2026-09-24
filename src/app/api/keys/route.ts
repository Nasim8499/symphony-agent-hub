import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { maskKey, verifyKeyFor, type Provider } from "@/lib/bu-server";
import { MAX_VAULT_KEYS, healthFromCredits } from "@/lib/vault";
import { getSettings, publicSettings } from "@/lib/settings";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Backwards-compatible settings endpoint.
 * Prefer /api/vault for the folder/vault UI; this route keeps the shell and
 * DeepSeek panel working with the original shape.
 */
export async function GET() {
  const rows = await db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
  const shape = (provider: Provider) => {
    const list = rows.filter((r) => r.provider === provider);
    const hasActive = list.some((r) => r.isActive);
    return list.map((r, i) => ({
      id: r.id,
      provider: r.provider,
      name: r.name,
      folder: r.folder,
      masked: maskKey(r.key),
      isActive: r.isActive || (!hasActive && i === 0),
      accountName: r.accountName,
      projectId: r.projectId,
      creditsUsd: r.creditsUsd,
      health: r.health,
      lastVerifiedAt: r.lastVerifiedAt,
      createdAt: r.createdAt,
    }));
  };
  const settings = await getSettings();
  return Response.json({
    envKey: Boolean(process.env.BROWSER_USE_API_KEY),
    envDeepseek: Boolean(process.env.DEEPSEEK_API_KEY),
    envOpenrouter: Boolean(process.env.OPENROUTER_API_KEY),
    max: MAX_VAULT_KEYS,
    settings: publicSettings(settings),
    keys: shape("browser-use"),
    deepseek: shape("deepseek"),
    openrouter: shape("openrouter"),
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { name?: string; key?: string; skipVerify?: boolean; provider?: Provider; folder?: string };
  const provider: Provider = body.provider === "deepseek" ? "deepseek" : body.provider === "openrouter" ? "openrouter" : "browser-use";
  const key = (body.key ?? "").trim();
  const name = (body.name ?? "").trim() || (provider === "deepseek" ? "DeepSeek" : provider === "openrouter" ? "OpenRouter" : "My API Key");
  const folder = (body.folder ?? "").trim() || "Default";
  if (!key) return Response.json({ error: "API key is required" }, { status: 400 });

  const existing = await db.select({ id: apiKeys.id }).from(apiKeys).where(eq(apiKeys.provider, provider));
  if (existing.length >= MAX_VAULT_KEYS) {
    return Response.json({ error: `The vault holds up to ${MAX_VAULT_KEYS} keys. Remove one first.`, code: "VAULT_FULL" }, { status: 400 });
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

  const result = await db.transaction(async (tx) => {
    await tx.update(apiKeys).set({ isActive: false }).where(eq(apiKeys.provider, provider));
    const [row] = await tx
      .insert(apiKeys)
      .values({ provider, name, key, folder, isActive: true, accountName, projectId, creditsUsd, health, lastVerifiedAt: body.skipVerify ? null : new Date() })
      .returning();
    return row;
  });

  return Response.json({ id: result.id, name: result.name, masked: maskKey(result.key) });
}
