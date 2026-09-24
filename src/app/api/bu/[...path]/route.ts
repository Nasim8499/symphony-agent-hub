import { BU_BASE, getActiveKey } from "@/lib/bu-server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

async function proxy(req: Request, { params }: Ctx) {
  const { path } = await params;
  if (!path?.length || !["v2", "v3", "v4"].includes(path[0])) {
    return Response.json({ detail: "Invalid API path" }, { status: 400 });
  }
  const active = await getActiveKey();
  if (!active) {
    return Response.json({ detail: "No API key configured. Add one in Settings → API Keys.", code: "NO_KEY" }, { status: 401 });
  }
  const url = new URL(req.url);
  const target = `${BU_BASE}/${path.map(encodeURIComponent).join("/")}${url.search}`;
  const init: RequestInit = {
    method: req.method,
    headers: {
      "X-Browser-Use-API-Key": active.key,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    cache: "no-store",
  };
  if (!["GET", "HEAD"].includes(req.method)) {
    const body = await req.text();
    if (body) init.body = body;
  }
  try {
    const res = await fetch(target, init);
    const text = await res.text();
    return new Response(text || "{}", {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
    });
  } catch (e) {
    return Response.json({ detail: e instanceof Error ? e.message : "Upstream error" }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
