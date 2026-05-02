import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function sameOriginCheck(req: Request) {
  if (process.env.NODE_ENV !== "production") return true;

  const host = req.headers.get("host");
  if (!host) return false;

  const origin = req.headers.get("origin") || req.headers.get("referer");
  if (!origin) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function safeNext(req: Request) {
  // allow only relative paths to prevent open redirects
  try {
    const url = new URL(req.url);
    const next = (url.searchParams.get("next") || "/").trim();
    if (!next.startsWith("/")) return "/";
    if (next.startsWith("//")) return "/";
    return next;
  } catch {
    return "/";
  }
}

function htmlLogoutRedirect(nextPath: string) {
  const body = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Logging out…</title>
  <meta http-equiv="cache-control" content="no-store" />
  <meta http-equiv="refresh" content="0;url=${nextPath}" />
</head>
<body>
  <script>
    try { localStorage.clear(); } catch (e) {}
    try { sessionStorage.clear(); } catch (e) {}
    window.location.replace(${JSON.stringify(nextPath)});
  </script>
  <noscript>
    <p>Logging out… <a href="${nextPath}">Continue</a></p>
  </noscript>
</body>
</html>`;

  return new NextResponse(body, {
    status: 303,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "location": nextPath,
    },
  });
}

async function performLogout() {
  const c = await cookies();
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll() {
          return c.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            c.set(name, value, options);
          }
        },
      },
    });

    // Sign out from Supabase
    await supabase.auth.signOut();
  }

  // Clear all auth-related cookies manually to be sure
  const cookieNames = [
    "sb-access-token",
    "sb-refresh-token",
    "sb-auth-token",
  ];

  for (const name of cookieNames) {
    c.delete(name);
  }
}

// If the user clicks a link to /api/auth/logout in the browser, redirect instead of showing JSON.
export async function GET(req: NextRequest) {
  await performLogout();
  const nextPath = safeNext(req);
  return htmlLogoutRedirect(nextPath);
}

export async function POST(req: Request) {
  if (!sameOriginCheck(req)) {
    return new NextResponse("Forbidden", {
      status: 403,
      headers: { "cache-control": "no-store" },
    });
  }

  await performLogout();
  const nextPath = safeNext(req);
  return htmlLogoutRedirect(nextPath);
}