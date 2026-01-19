import "server-only";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Missing DATABASE_URL");

// Supabase is standard Postgres. For Next.js/serverless, prefer the Supabase Pooler
// connection string and keep connection counts low.
export const sql = postgres(url, {
  ssl: "require",
  max: 3,
  idle_timeout: 20,
  connect_timeout: 10,
});