import { db } from "@/db";
import { executions, type Execution } from "@/db/schema";
import { buFetch } from "@/lib/bu-server";
import { and, desc, eq, type SQL } from "drizzle-orm";

export const dynamic = "force-dynamic";

const TERMINAL = new Set(["completed", "failed", "cancelled"]);

async function refresh(e: Execution): Promise<Execution> {
  if (e.kind !== "agent" || !e.runId || TERMINAL.has(e.status)) return e;
  try {
    const s = await buFetch<{ status: string }>(`v4/runs/${e.runId}/status`);
    if (TERMINAL.has(s.status)) {
      const full = await buFetch<{ status: string; result: string | null; error: string | null; totalCostUsd: string }>(`v4/runs/${e.runId}`);
      const patch = { status: full.status, result: full.result, error: full.error, costUsd: parseFloat(full.totalCostUsd) || 0, updatedAt: new Date() };
      await db.update(executions).set(patch).where(eq(executions.id, e.id));
      return { ...e, ...patch };
    }
    if (s.status !== e.status) {
      await db.update(executions).set({ status: s.status, updatedAt: new Date() }).where(eq(executions.id, e.id));
      return { ...e, status: s.status };
    }
  } catch {}
  return e;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const conds: SQL[] = [];
  const automationId = url.searchParams.get("automationId");
  const sessionId = url.searchParams.get("sessionId");
  const source = url.searchParams.get("source");
  if (automationId) conds.push(eq(executions.automationId, Number(automationId)));
  if (sessionId) conds.push(eq(executions.sessionId, sessionId));
  if (source) conds.push(eq(executions.source, source));
  const limit = Math.min(200, Number(url.searchParams.get("limit") ?? 50));

  const rows = await db
    .select()
    .from(executions)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(executions.createdAt))
    .limit(limit);

  let budget = 10;
  const out = await Promise.all(
    rows.map((r) => {
      if (r.kind === "agent" && r.runId && !TERMINAL.has(r.status) && budget > 0) {
        budget--;
        return refresh(r);
      }
      return Promise.resolve(r);
    }),
  );
  return Response.json({ executions: out });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  await db.delete(executions).where(eq(executions.id, Number(id)));
  return Response.json({ ok: true });
}
