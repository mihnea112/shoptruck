// src/lib/auth/server.ts
import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

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
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        cookieStore.set({ name, value: "", ...options, maxAge: 0 });
      },
    },
  });

  // 1) who is logged in (from Supabase auth cookies)
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) return null;

  const u = userData.user;

  // 2) load profile (Option A)
  let profile: any = null;
  try {
    const result = await supabase
      .from("profile")
      .select("user_id, roles, is_active, default_route")
      .eq("user_id", u.id)
      .maybeSingle();

    if (result.error) {
      // Profile table might not exist, that's ok for new users
      profile = null;
    } else {
      profile = result.data;
    }
  } catch {
    // Profile table doesn't exist, use default
    profile = null;
  }

  // If profile missing => customer
  const roles = normalizeRoles(profile?.roles ?? []);
  const isActive = profile?.is_active;

  if (isActive === false) return null;

  const kind: "staff" | "customer" = roles.length > 0 ? "staff" : "customer";

  return {
    userId: u.id,
    email: u.email ?? "",
    kind,
    roles,
    defaultRoute: profile?.default_route ?? null,
  };
}

export function hasAnyRole(user: SessionUser, roles: string[]) {
  const wanted = (roles || []).map((r) => String(r ?? "").trim().toLowerCase()).filter(Boolean);
  return wanted.some((r) => user.roles.includes(r));
}