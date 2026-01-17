import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sql } from "@/lib/db";

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
    // prevent protocol-relative (//evil.com)
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
    // in case your app stores extra keys under specific names, add them here
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
  const token = c.get("session")?.value || "";

  // Clear cookie regardless (idempotent)
  c.set("session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });

  // Best-effort DB cleanup
  if (token) {
    try {
      // If your DB stores a hashed token, adapt this to your hashing strategy.
      // For now we delete by token_hash assuming it matches the cookie value.
      await sql`DELETE FROM session WHERE token_hash = ${token}`;
    } catch (err) {
      console.error("[auth/logout] failed to delete session", err);
    }
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