import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sql } from "@/lib/db";
import { hashToken } from "@/lib/auth/crypto";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

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

export async function POST(req: Request) {
  if (!sameOriginCheck(req)) {
    return json({ ok: false, error: "Cerere respinsă (origine invalidă)." }, 403);
  }

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

  if (token) {
    const tokenHash = hashToken(token);
    await sql`DELETE FROM session WHERE token_hash = ${tokenHash}`;
  }

  return json({ ok: true, redirectTo: "/login" });
}