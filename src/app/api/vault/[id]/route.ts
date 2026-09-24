import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { verifyKeyFor, type Provider } from "@/lib/bu-server";
import { healthFromCredits, rotateVaultKey, shapeKey } from "@/lib/vault";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const keyId = Number(id);
  const body = (await req.json().catch(() => ({}))) as {
    action?: "activate" | "verify" | "rotate" | "rename" | "move";
    name?: string;
    folder?: string;
  };
  const [row] = await db.select().from(apiKeys).where(eq(apiKeys.id, keyId));

  if (body.action === "rotate" || keyId === 0) {
    const next = await rotateVaultKey(row?.id ?? null);
    return Response.json({ ok: true, key: next });
  }
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });

  if (body.action === "activate") {
    await db.transaction(async (tx) => {
      await tx.update(apiKeys).set({ isActive: false }).where(eq(apiKeys.provider, row.provider));
      await tx.update(apiKeys).set({ isActive: true }).where(eq(apiKeys.id, keyId));
    });
    return Response.json({ ok: true });
  }

  if (body.action === "verify") {
    const v = await verifyKeyFor(row.provider as Provider, row.key);
    if (!v.ok) {
      await db.update(apiKeys).set({ health: "invalid", lastVerifiedAt: new Date() }).where(eq(apiKeys.id, keyId));
      return Response.json({ error: v.error, health: "invalid" }, { status: 400 });
    }
    const health = row.provider === "browser-use" ? healthFromCredits(v.credits) : "healthy";
    const [updated] = await db
      .update(apiKeys)
      .set({ accountName: v.accountName, projectId: v.projectId, creditsUsd: v.credits, health, lastVerifiedAt: new Date() })
      .where(eq(apiKeys.id, keyId))
      .returning();
    return Response.json({ ok: true, key: shapeKey(updated, updated.isActive) });
  }

  if (body.action === "rename" && typeof body.name === "string" && body.name.trim()) {
    const [updated] = await db.update(apiKeys).set({ name: body.name.trim() }).where(eq(apiKeys.id, keyId)).returning();
    return Response.json({ ok: true, key: shapeKey(updated, updated.isActive) });
  }

  if (body.action === "move" && typeof body.folder === "string") {
    const [updated] = await db.update(apiKeys).set({ folder: body.folder.trim() || "Default" }).where(eq(apiKeys.id, keyId)).returning();
    return Response.json({ ok: true, key: shapeKey(updated, updated.isActive) });
  }

  return Response.json({ error: "Nothing to do" }, { status: 400 });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  await db.delete(apiKeys).where(eq(apiKeys.id, Number(id)));
  return Response.json({ ok: true });
}
