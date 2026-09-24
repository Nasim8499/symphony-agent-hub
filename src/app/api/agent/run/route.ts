import { dispatchRun, type DispatchInput } from "@/lib/dispatch";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<DispatchInput>;
  if (!body.task || !body.task.trim()) return Response.json({ detail: "Task is required" }, { status: 400 });
  try {
    const r = await dispatchRun({
      task: body.task.trim(),
      model: body.model,
      executorModel: body.executorModel,
      sessionId: body.sessionId,
      browserSettings: body.browserSettings,
      agentmail: body.agentmail,
      maxCostUsd: body.maxCostUsd,
      source: body.source ?? "manual",
      label: body.label,
      params: body.params,
    });
    return Response.json(r);
  } catch (e) {
    const status = (e as { status?: number }).status ?? 400;
    const msg = (e as Error).message;
    return Response.json({ detail: msg, code: /No Browser Use API key/.test(msg) ? "NO_KEY" : undefined }, { status: /No Browser Use API key/.test(msg) ? 401 : status });
  }
}
