// src/app/api/auth/login/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// ... keep your helpers (sameOriginCheck, normalize, etc.)

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const mode = String(body?.mode ?? "cookie").toLowerCase();

  console.log("[LOGIN] Email:", email, "Mode:", mode);

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.json(
      { ok: false, error: "Lipsește configurarea Supabase." },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }

  const cookieStore = await cookies();

  // Buffer cookies that Supabase wants to set (needed for chunked auth cookies)
  const cookieBuffer: Array<{ name: string; value: string; options: any }> = [];

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const c of cookiesToSet) cookieBuffer.push(c);
      },
    },
  });

  const { data, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  console.log("[LOGIN] Sign in result:", { hasUser: !!data?.user, error: signInError?.message });

  if (signInError || !data?.user) {
    return NextResponse.json(
      { ok: false, error: "Email sau parolă incorecte." },
      { status: 401, headers: { "cache-control": "no-store" } }
    );
  }

  // --- profile lookup (same as your code) ---
  const { data: profile, error: profileErr } = await supabase
    .from("profile")
    .select("user_id, roles, is_active, default_route")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (profileErr) {
    return NextResponse.json(
      { ok: false, error: "Eroare la citirea profilului." },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }

  const roles = Array.isArray((profile as any)?.roles)
    ? (profile as any).roles.map((x: any) => String(x ?? "").trim().toLowerCase()).filter(Boolean)
    : [];

  if ((profile as any)?.is_active === false) {
    return NextResponse.json(
      { ok: false, error: "Email sau parolă incorecte." },
      { status: 401, headers: { "cache-control": "no-store" } }
    );
  }

  const kind = roles.length > 0 ? "staff" : "customer";
  const dbDefaultRoute = String((profile as any)?.default_route ?? "").trim();

  const ROLE_DEFAULT_ROUTE: Record<string, string> = {
    admin: "/admin",
    sales_rep: "/vanzari",
  };

  const safeNext = (next: string | null) => {
    if (!next) return null;
    if (!next.startsWith("/")) return null;
    if (next.startsWith("//")) return null;
    return next;
  };

  const landingRouteForRoles = (r: string[]) => {
    const priority = ["admin", "sales_rep"];
    for (const role of priority) if (r.includes(role) && ROLE_DEFAULT_ROUTE[role]) return ROLE_DEFAULT_ROUTE[role];
    for (const role of r) if (ROLE_DEFAULT_ROUTE[role]) return ROLE_DEFAULT_ROUTE[role];
    return "/";
  };

  const url = new URL(req.url);
  const nextParam = safeNext(url.searchParams.get("next")) || safeNext(body?.next ?? null);

  let redirectTo = "/";
  if (nextParam) redirectTo = nextParam;
  else if (roles.includes("admin")) redirectTo = "/admin";
  else if (dbDefaultRoute && safeNext(dbDefaultRoute)) redirectTo = dbDefaultRoute;
  else if (kind === "staff") redirectTo = landingRouteForRoles(roles);
  else redirectTo = "/account";

  const session = data.session ?? null;

  // Build the final response payload
  const payload =
    mode === "token"
      ? {
          ok: true,
          accessToken: session?.access_token ?? null,
          refreshToken: session?.refresh_token ?? null,
          user: { id: data.user.id, email: data.user.email, kind, roles, default_route: dbDefaultRoute || null },
          redirectTo,
        }
      : {
          ok: true,
          user: { id: data.user.id, email: data.user.email, kind, roles, default_route: dbDefaultRoute || null },
          redirectTo,
        };

  console.log("[LOGIN] Response payload:", { ok: payload.ok, redirectTo: payload.redirectTo, cookiesCount: cookieBuffer.length });

  // Build the final response and apply cookies that Supabase requested
  const response = NextResponse.json(payload, {
    status: 200,
    headers: { "cache-control": "no-store" },
  });

  for (const { name, value, options } of cookieBuffer) {
    response.cookies.set(name, value, options);
  }

  console.log("[LOGIN] Response sent with cookies:", cookieBuffer.map(c => c.name));
  return response;
}