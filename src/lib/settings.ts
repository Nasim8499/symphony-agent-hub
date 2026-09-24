import { db, ensureSchema } from "@/db";
import { appSettings, type AppSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export const DEFAULT_SETTINGS: Omit<AppSettings, "updatedAt"> = {
  id: 1,
  fallbackMode: false,
  fallbackProvider: "mock",
  openrouterModel: "meta-llama/llama-3.3-70b-instruct:free",
  ollamaBaseUrl: "http://127.0.0.1:11434",
  ollamaModel: "llama3.1",
  deepseekPlanningModel: "deepseek-chat",
  deepseekExecutorModel: "gpt-5.6-luna",
  googleClientId: null,
  googleClientSecret: null,
  googleRefreshToken: null,
  googleAccountEmail: null,
  googleConnectedAt: null,
};

export type FallbackProvider = "mock" | "ollama" | "openrouter";
export type { AppSettings };

/** Reads the singleton settings row, creating a default one on first use. */
export async function getSettings(): Promise<AppSettings> {
  await ensureSchema();
  const rows = await db.select().from(appSettings).where(eq(appSettings.id, 1)).limit(1);
  if (rows[0]) return rows[0];
  const [created] = await db
    .insert(appSettings)
    .values({ ...DEFAULT_SETTINGS })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [again] = await db.select().from(appSettings).where(eq(appSettings.id, 1)).limit(1);
  return again ?? ({ ...DEFAULT_SETTINGS, updatedAt: new Date() } as AppSettings);
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  await getSettings();
  const [row] = await db
    .update(appSettings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(appSettings.id, 1))
    .returning();
  return row;
}

/** Never leak secrets to the client. */
export function publicSettings(s: AppSettings) {
  return {
    fallbackMode: s.fallbackMode,
    fallbackProvider: s.fallbackProvider as FallbackProvider,
    openrouterModel: s.openrouterModel,
    ollamaBaseUrl: s.ollamaBaseUrl,
    ollamaModel: s.ollamaModel,
    deepseekPlanningModel: s.deepseekPlanningModel,
    deepseekExecutorModel: s.deepseekExecutorModel,
    googleClientId: s.googleClientId,
    hasGoogleClientSecret: Boolean(s.googleClientSecret),
    googleConnected: Boolean(s.googleRefreshToken),
    googleAccountEmail: s.googleAccountEmail,
    googleConnectedAt: s.googleConnectedAt,
  };
}
