import "server-only";
import postgres from "postgres";

const rawUrl = process.env.DATABASE_URL;
const url = typeof rawUrl === "string" ? rawUrl.trim() : "";
if (!url) throw new Error("Missing DATABASE_URL");

// Supabase Pooler (pgBouncer transaction mode) + serverless do NOT work with prepared statements.
// Also, in Next.js dev/HMR the module can be reloaded while `global` survives; if options/URL changed,
// we must recreate the client (otherwise you can get hangs / prepared-statement errors).

declare global {
  // eslint-disable-next-line no-var
  var __sql: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __sql_url: string | undefined;
}

function createClient(databaseUrl: string) {
  return postgres(databaseUrl, {
    // For Supabase you need SSL.
    ssl: "require",

    // Keep this small; server components can run multiple queries in parallel.
    max: 5,

    // Fail fast instead of hanging on connect.
    connect_timeout: 10,
    idle_timeout: 20,

    // CRITICAL for Supabase pooler / serverless.
    prepare: false,

    // Optional but helpful when you accidentally pass undefined values.
    transform: {
      undefined: null,
    },
  });
}

// Recreate the client in dev if URL changed (or if the old client came from a previous HMR run).
// This prevents stale clients that can keep broken prepared-statement state.
if (process.env.NODE_ENV !== "production") {
  if (global.__sql && global.__sql_url && global.__sql_url !== url) {
    try {
      // Close old connections quickly.
      global.__sql.end({ timeout: 5 });
    } catch {
      // ignore
    }
    global.__sql = undefined;
    global.__sql_url = undefined;
  }
}

export const sql = global.__sql ?? createClient(url);

if (process.env.NODE_ENV !== "production") {
  global.__sql = sql;
  global.__sql_url = url;
}