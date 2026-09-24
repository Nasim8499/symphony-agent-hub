import {
  buildAuthUrl, disconnectGoogle, docText, driveFetchContent, driveGet, driveList, driveSearch,
  exportMime, gmailRecent, googleStatus, isViewable, sheetValues, type ExportKind,
} from "@/lib/google";
import { getSettings, updateSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "status";
  try {
    if (action === "status") return Response.json(await googleStatus());

    if (action === "connect") {
      const state = crypto.randomUUID();
      const res = Response.json({ url: buildAuthUrl(state), state });
      res.headers.append("Set-Cookie", `g_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
      return res;
    }

    if (action === "list") {
      return Response.json({ files: await driveList(Number(url.searchParams.get("limit") ?? 25) || 25, url.searchParams.get("folderId") ?? undefined) });
    }

    if (action === "search") {
      const q = url.searchParams.get("q") ?? "";
      return Response.json({ query: q, files: await driveSearch(q, Number(url.searchParams.get("limit") ?? 25) || 25) });
    }

    if (action === "file") {
      const id = url.searchParams.get("id");
      if (!id) return Response.json({ error: "id required" }, { status: 400 });
      return Response.json({ file: await driveGet(id) });
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

    if (action === "gmail") {
      return Response.json({ messages: await gmailRecent(Number(url.searchParams.get("limit") ?? 10) || 10, url.searchParams.get("q") ?? "") });
    }

    if (action === "disconnect") {
      await disconnectGoogle();
      return Response.json({ ok: true });
    }

    if (action === "export") {
      const id = url.searchParams.get("id");
      if (!id) return Response.json({ error: "id required" }, { status: 400 });
      const kind = (url.searchParams.get("kind") ?? "pdf") as ExportKind;
      const { buffer, mimeType, name } = await driveFetchContent(id, kind);
      const download = url.searchParams.get("download") === "1";
      return new Response(buffer, {
        headers: {
          "Content-Type": mimeType,
          "Cache-Control": "private, max-age=60",
          "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name.replace(/"/g, "")}"`,
        },
      });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e) {
    const msg = (e as Error).message;
    const status = (e as { status?: number }).status === 401 ? 401 : 400;
    return Response.json({ error: msg }, { status });
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { action?: string; clientId?: string; clientSecret?: string };
  if (body.action === "configure") {
    const patch: Record<string, string | null> = {};
    if (typeof body.clientId === "string") patch.googleClientId = body.clientId.trim() || null;
    if (typeof body.clientSecret === "string" && body.clientSecret.trim()) patch.googleClientSecret = body.clientSecret.trim();
    await updateSettings(patch);
    const s = await getSettings();
    return Response.json({ ok: true, configured: Boolean(s.googleClientId && s.googleClientSecret) });
  }
  if (body.action === "capabilities") {
    const s = await getSettings();
    return Response.json({
      exportMime: { pdf: exportMime("pdf"), text: exportMime("text"), docx: exportMime("docx"), csv: exportMime("csv"), xlsx: exportMime("xlsx") },
      connected: Boolean(s.googleRefreshToken),
      viewable: isViewable("application/pdf"),
    });
  }
  return Response.json({ error: "Unknown action" }, { status: 400 });
}
