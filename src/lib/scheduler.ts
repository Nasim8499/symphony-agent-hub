import { db } from "@/db";
import { automations } from "@/db/schema";
import { and, eq, isNotNull, lte, ne } from "drizzle-orm";
import { runAutomation } from "./dispatch";

const g = globalThis as typeof globalThis & { __buScheduler?: NodeJS.Timeout; __buTicking?: boolean };

export async function runDueAutomations() {
  if (g.__buTicking) return;
  g.__buTicking = true;
  try {
    const due = await db
      .select()
      .from(automations)
      .where(and(eq(automations.enabled, true), ne(automations.scheduleType, "manual"), isNotNull(automations.nextRunAt), lte(automations.nextRunAt, new Date())))
      .limit(10);
    for (const a of due) {
      try {
        await runAutomation(a, { trigger: "schedule" });
      } catch (e) {
        console.error(`[scheduler] automation ${a.id} failed:`, (e as Error).message);
      }
    }
  } catch {
    // tables may not exist yet during bootstrap — ignore
  } finally {
    g.__buTicking = false;
  }
}

export function startScheduler() {
  if (g.__buScheduler) return;
  g.__buScheduler = setInterval(runDueAutomations, 30_000);
  setTimeout(runDueAutomations, 5_000);
}
