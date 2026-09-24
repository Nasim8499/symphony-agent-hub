import { db } from "@/db";
import { automations } from "@/db/schema";
import { computeNextRun } from "@/lib/dispatch";
import { normalizeAutomation } from "@/lib/automation-input";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const [row] = await db.select().from(automations).where(eq(automations.id, Number(id)));
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ automation: row });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const [row] = await db.select().from(automations).where(eq(automations.id, Number(id)));
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // Quick toggle
  if (Object.keys(raw).length === 1 && "enabled" in raw) {
    const enabled = Boolean(raw.enabled);
    const [u] = await db
      .update(automations)
      .set({ enabled, nextRunAt: enabled ? computeNextRun(row) : null })
      .where(eq(automations.id, row.id))
      .returning();
    return Response.json({ automation: u });
  }

  const parsed = normalizeAutomation({ ...row, ...raw });
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  const v = parsed.value;
  const [u] = await db
    .update(automations)
    .set({ ...v, nextRunAt: v.enabled ? computeNextRun(v) : null })
    .where(eq(automations.id, row.id))
    .returning();
  return Response.json({ automation: u });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  await db.delete(automations).where(eq(automations.id, Number(id)));
  return Response.json({ ok: true });
}
