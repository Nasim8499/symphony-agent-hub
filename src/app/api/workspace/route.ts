import { db, ensureSchema } from "@/db";
import { executions } from "@/db/schema";
import { docText, driveFetchContent, driveList, driveSearch, googleStatus, sheetValues } from "@/lib/google";
import type { ExportKind } from "@/lib/google";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Unified workspace endpoint used by the in-dashboard document viewer and the
 * Google Workspace skill surface.
 *
 * GET  /api/workspace?action=status
 * GET  /api/workspace?action=list|search|doc|sheet|export|session-files
 */
export async function GET(req: Request) {
  await ensureSchema();
  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "status";

  try {
    if (action === "status") {
      const [g, recent] = await Promise.all([
        googleStatus(),
        db.select().from(executions).orderBy(desc(executions.createdAt)).limit(8),
      ]);
      return Response.json({
        google: g,
        recentArtifacts: recent.map((r) => ({
          id: r.id,
          label: r.label,
          task: r.task,
          status: r.status,
          sessionId: r.sessionId,
          runId: r.runId,
          result: r.result ? r.result.slice(0, 1500) : null,
          createdAt: r.createdAt,
        })),
      });
    }

    if (action === "list") {
      return Response.json({ files: await driveList(Number(url.searchParams.get("limit") ?? 25) || 25, url.searchParams.get("folderId") ?? undefined) });
    }

    if (action === "search") {
      const q = url.searchParams.get("q") ?? "";
      return Response.json({ query: q, files: await driveSearch(q, Number(url.searchParams.get("limit") ?? 25) || 25) });
    }

    if (action === "doc") {
      const id = url.searchParams.get("id");
      if (!id) return Response.json({ error: "id required" }, { status: 400 });
      return Response.json(await docText(id));
    }

    if (action === "sheet") {
      const id = url.searchParams.get("id");
      if (!id) return Response.json({ error: "id required" }, { status: 400 });
      return Response.json(await sheetValues(id, url.searchParams.get("range") ?? "A1:Z100"));
    }

    if (action === "export") {
      const id = url.searchParams.get("id");
      if (!id) return Response.json({ error: "id required" }, { status: 400 });
      const kind = (url.searchParams.get("kind") ?? "pdf") as ExportKind;
      const download = url.searchParams.get("download") === "1";
      const { buffer, mimeType, name } = await driveFetchContent(id, kind);
      return new Response(buffer, {
        headers: {
          "Content-Type": mimeType,
          "Cache-Control": "private, max-age=60",
          "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name.replace(/"/g, "")}"`,
        },
      });
    }

    if (action === "session-files") {
      const sessionId = url.searchParams.get("sessionId");
      if (!sessionId) return Response.json({ error: "sessionId required" }, { status: 400 });
      const rows = await db.select().from(executions).where(eq(executions.sessionId, sessionId)).orderBy(desc(executions.createdAt));
      return Response.json({
        files: rows
          .filter((r) => r.result || r.plan)
          .map((r) => ({
            id: `exec-${r.id}`,
            executionId: r.id,
            name: r.label || r.task?.slice(0, 60) || `Run ${r.id}`,
            kind: "text" as const,
            status: r.status,
            createdAt: r.createdAt,
            content: r.result || r.plan || "",
            runId: r.runId,
            sessionId: r.sessionId,
          })),
      });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
