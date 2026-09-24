import { planWithDeepseek } from "@/lib/dispatch";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST() {
  try {
    const r = await planWithDeepseek("Find the current processing time for an Australian Visitor visa (subclass 600) for a Bangladeshi applicant.", "deepseek-chat");
    return Response.json({ plan: r.plan });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
