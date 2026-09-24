import { db } from "@/db";
import { automations } from "@/db/schema";
import { computeNextRun } from "@/lib/dispatch";
import { normalizeAutomation } from "@/lib/automation-input";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(automations).orderBy(desc(automations.createdAt));
  return Response.json({ automations: rows });
}

export async function POST(req: Request) {
  const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = normalizeAutomation(raw);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  const v = parsed.value;
  const [row] = await db
    .insert(automations)
    .values({ ...v, nextRunAt: v.enabled ? computeNextRun(v) : null })
    .returning();
  return Response.json({ automation: row });
}
