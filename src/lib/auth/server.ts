// src/lib/auth/server.ts
import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { sql } from "@/lib/db";

export type SessionUser = {
  userId: string;
  email: string;
  kind: "staff" | "customer";
  roles: string[];            // lowercase
  defaultRoute?: string | null;
};

function normalizeRoles(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => String(x ?? "").trim().toLowerCase())
    .filter(Boolean);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  const cookieStore = await cookies();

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set({ name, value, ...options });
          }
        } catch {
          // Called from a Server Component — ignore cookie writes
        }
      },
    },
  });

  // 1) who is logged in (from Supabase auth cookies)
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) return null;

  const u = userData.user;

  // 2) load account data (single source of truth — no RLS, direct SQL)
  let account: any = null;
  try {
    const rows = await sql`
      SELECT user_id, roles, is_active, default_route
      FROM account
      WHERE user_id = ${u.id}::uuid
      LIMIT 1
    ` as any[];
    account = rows[0] || null;
  } catch {
    // account table might not have the new columns yet
    account = null;
  }

  const roles = normalizeRoles(account?.roles ?? []);
  const isActive = account?.is_active;

  if (isActive === false) return null;

  const staffRoles = roles.filter((r) => r !== "user");
  const kind: "staff" | "customer" = staffRoles.length > 0 ? "staff" : "customer";

  return {
    userId: u.id,
    email: u.email ?? "",
    kind,
    roles,
    defaultRoute: account?.default_route ?? null,
  };
}

export function hasAnyRole(user: SessionUser, roles: string[]) {
  const wanted = (roles || []).map((r) => String(r ?? "").trim().toLowerCase()).filter(Boolean);
  return wanted.some((r) => user.roles.includes(r));
}