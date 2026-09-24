import { db } from "@/db";
import { candidates } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(candidates).orderBy(desc(candidates.createdAt)).limit(100);
  return Response.json({ candidates: rows });
}

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const s = (k: string) => (typeof b[k] === "string" && (b[k] as string).trim() ? (b[k] as string).trim() : null);
  const fullName = s("fullName");
  if (!fullName) return Response.json({ error: "Full name is required" }, { status: 400 });
  const exp = Number(b.experienceYears);
  const [row] = await db
    .insert(candidates)
    .values({
      fullName,
      passportNumber: s("passportNumber")?.toUpperCase() ?? null,
      phone: s("phone"),
      email: s("email"),
      targetCountry: s("targetCountry"),
      category: s("category"),
      experienceYears: Number.isFinite(exp) && exp >= 0 ? Math.floor(exp) : null,
      education: s("education"),
      englishLevel: s("englishLevel"),
      notes: s("notes"),
      status: s("status") ?? "intake",
    })
    .returning();
  return Response.json({ candidate: row });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  await db.delete(candidates).where(eq(candidates.id, Number(id)));
  return Response.json({ ok: true });
}
