import { db } from "@/db";
import { automations } from "@/db/schema";
import { runAutomation } from "@/lib/dispatch";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const [row] = await db.select().from(automations).where(eq(automations.id, Number(id)));
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { rows?: Record<string, string>[] };
  const results = await runAutomation(row, { rows: body.rows, trigger: "manual" });
  const failed = results.filter((r) => !r.ok);
  return Response.json({
    results,
    dispatched: results.length - failed.length,
    failed: failed.length,
    error: failed.length === results.length ? failed[0]?.error : undefined,
  });
}
