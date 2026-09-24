import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __bootstrapPromise?: Promise<void>;
};

export const pool: Pool | null = databaseUrl
  ? (globalForDb.__arenaNextJsPostgresqlPool ??
      new Pool({
        connectionString: databaseUrl,
        max: 8,
        idleTimeoutMillis: 20_000,
        connectionTimeoutMillis: 10_000,
        ssl: /sslmode=require|neon\.tech|supabase\.(co|com)/.test(databaseUrl) ? { rejectUnauthorized: false } : undefined,
      }))
  : null;

if (process.env.NODE_ENV !== "production" && pool) {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db: NodePgDatabase<Record<string, never>> = drizzle(pool as Pool);

export const hasDatabase = Boolean(databaseUrl);

/**
 * Creates the tables the dashboard needs if they are missing.
 * Keeps a fresh Vercel + Neon/Supabase deploy working with no manual migration step.
 */
async function bootstrap() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id serial PRIMARY KEY,
      provider text NOT NULL DEFAULT 'browser-use',
      name text NOT NULL,
      key text NOT NULL,
      is_active boolean NOT NULL DEFAULT false,
      folder text NOT NULL DEFAULT 'Default',
      account_name text,
      project_id text,
      credits_usd double precision,
      health text NOT NULL DEFAULT 'unknown',
      last_verified_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS folder text NOT NULL DEFAULT 'Default';
    ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS health text NOT NULL DEFAULT 'unknown';

    CREATE TABLE IF NOT EXISTS app_settings (
      id integer PRIMARY KEY DEFAULT 1,
      fallback_mode boolean NOT NULL DEFAULT false,
      fallback_provider text NOT NULL DEFAULT 'mock',
      openrouter_model text NOT NULL DEFAULT 'meta-llama/llama-3.3-70b-instruct:free',
      ollama_base_url text NOT NULL DEFAULT 'http://127.0.0.1:11434',
      ollama_model text NOT NULL DEFAULT 'llama3.1',
      deepseek_planning_model text NOT NULL DEFAULT 'deepseek-chat',
      deepseek_executor_model text NOT NULL DEFAULT 'gpt-5.6-luna',
      google_client_id text,
      google_client_secret text,
      google_refresh_token text,
      google_account_email text,
      google_connected_at timestamptz,
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS automations (
      id serial PRIMARY KEY,
      name text NOT NULL,
      description text,
      kind text NOT NULL DEFAULT 'agent',
      source text NOT NULL DEFAULT 'tasker',
      workflow text,
      template text,
      skill_id text,
      skill_source text,
      param_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
      batch jsonb NOT NULL DEFAULT '[]'::jsonb,
      model text NOT NULL DEFAULT 'gpt-5.6-luna',
      executor_model text,
      browser_settings jsonb,
      agentmail boolean NOT NULL DEFAULT false,
      schedule_type text NOT NULL DEFAULT 'manual',
      interval_minutes integer,
      run_at timestamptz,
      daily_time text,
      enabled boolean NOT NULL DEFAULT true,
      next_run_at timestamptz,
      last_run_at timestamptz,
      run_count integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS executions (
      id serial PRIMARY KEY,
      automation_id integer,
      source text NOT NULL DEFAULT 'manual',
      kind text NOT NULL DEFAULT 'agent',
      label text,
      task text,
      params jsonb,
      run_id text,
      session_id text,
      planner_model text,
      plan text,
      executor_model text,
      status text NOT NULL DEFAULT 'queued',
      result text,
      error text,
      cost_usd double precision,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS candidates (
      id serial PRIMARY KEY,
      full_name text NOT NULL,
      passport_number text,
      phone text,
      email text,
      target_country text,
      category text,
      experience_years integer,
      education text,
      english_level text,
      notes text,
      status text NOT NULL DEFAULT 'intake',
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS executions_created_at_idx ON executions (created_at DESC);
    CREATE INDEX IF NOT EXISTS executions_session_idx ON executions (session_id);
  `);
}

/** Idempotent — safe to await from every request path. */
export function ensureSchema(): Promise<void> {
  if (!pool) return Promise.resolve();
  if (!globalForDb.__bootstrapPromise) {
    globalForDb.__bootstrapPromise = bootstrap().catch((e) => {
      globalForDb.__bootstrapPromise = undefined;
      console.error("[db] schema bootstrap failed:", (e as Error).message);
    });
  }
  return globalForDb.__bootstrapPromise;
}

export async function dbHealthy(): Promise<boolean> {
  if (!pool) return false;
  try {
    await pool.query("select 1");
    return true;
  } catch {
    return false;
  }
}
