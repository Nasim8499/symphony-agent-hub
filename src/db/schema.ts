import { boolean, doublePrecision, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/** Provider credentials. provider = "browser-use" | "deepseek" | "google" | "openrouter" */
export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull().default("browser-use"),
  name: text("name").notNull(),
  key: text("key").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  folder: text("folder").notNull().default("Default"),
  accountName: text("account_name"),
  projectId: text("project_id"),
  creditsUsd: doublePrecision("credits_usd"),
  health: text("health").notNull().default("unknown"), // unknown | healthy | low | invalid
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Singleton runtime settings: free/fallback agent mode, DeepSeek routing, Google Workspace, viewer prefs. */
export const appSettings = pgTable("app_settings", {
  id: integer("id").primaryKey().default(1),
  fallbackMode: boolean("fallback_mode").notNull().default(false),
  fallbackProvider: text("fallback_provider").notNull().default("mock"), // mock | ollama | openrouter
  openrouterModel: text("openrouter_model").notNull().default("meta-llama/llama-3.3-70b-instruct:free"),
  ollamaBaseUrl: text("ollama_base_url").notNull().default("http://127.0.0.1:11434"),
  ollamaModel: text("ollama_model").notNull().default("llama3.1"),
  deepseekPlanningModel: text("deepseek_planning_model").notNull().default("deepseek-chat"),
  deepseekExecutorModel: text("deepseek_executor_model").notNull().default("gpt-5.6-luna"),
  googleClientId: text("google_client_id"),
  googleClientSecret: text("google_client_secret"),
  googleRefreshToken: text("google_refresh_token"),
  googleAccountEmail: text("google_account_email"),
  googleConnectedAt: timestamp("google_connected_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BrowserSettingsJson = { proxyCountryCode?: string | null; profileId?: string | null; record?: boolean };


/** Reusable routines: agent prompt templates or deterministic skills, optionally batched & scheduled. */
export const automations = pgTable("automations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  kind: text("kind").notNull().default("agent"), // agent | skill
  source: text("source").notNull().default("tasker"), // tasker | insus | manual
  workflow: text("workflow"),
  template: text("template"),
  skillId: text("skill_id"),
  skillSource: text("skill_source"), // mine | marketplace
  paramKeys: jsonb("param_keys").$type<string[]>().notNull().default([]),
  batch: jsonb("batch").$type<Record<string, string>[]>().notNull().default([]),
  model: text("model").notNull().default("gpt-5.6-luna"),
  executorModel: text("executor_model"),
  browserSettings: jsonb("browser_settings").$type<BrowserSettingsJson>(),
  agentmail: boolean("agentmail").notNull().default(false),
  scheduleType: text("schedule_type").notNull().default("manual"), // manual | once | interval | daily
  intervalMinutes: integer("interval_minutes"),
  runAt: timestamp("run_at", { withTimezone: true }),
  dailyTime: text("daily_time"),
  enabled: boolean("enabled").notNull().default(true),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  runCount: integer("run_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Every dispatched run (agent run or skill execution), from any source. */
export const executions = pgTable("executions", {
  id: serial("id").primaryKey(),
  automationId: integer("automation_id"),
  source: text("source").notNull().default("manual"),
  kind: text("kind").notNull().default("agent"),
  label: text("label"),
  task: text("task"),
  params: jsonb("params").$type<Record<string, unknown>>(),
  runId: text("run_id"),
  sessionId: text("session_id"),
  plannerModel: text("planner_model"),
  plan: text("plan"),
  executorModel: text("executor_model"),
  status: text("status").notNull().default("queued"),
  result: text("result"),
  error: text("error"),
  costUsd: doublePrecision("cost_usd"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** INSUS candidate intake records. */
export const candidates = pgTable("candidates", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  passportNumber: text("passport_number"),
  phone: text("phone"),
  email: text("email"),
  targetCountry: text("target_country"),
  category: text("category"),
  experienceYears: integer("experience_years"),
  education: text("education"),
  englishLevel: text("english_level"),
  notes: text("notes"),
  status: text("status").notNull().default("intake"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ApiKey = typeof apiKeys.$inferSelect;
export type Automation = typeof automations.$inferSelect;
export type Execution = typeof executions.$inferSelect;
export type Candidate = typeof candidates.$inferSelect;
export type AppSettings = typeof appSettings.$inferSelect;
