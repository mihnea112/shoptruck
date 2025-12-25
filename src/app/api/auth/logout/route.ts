import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sql } from "@/lib/db";
import { hashToken } from "@/lib/auth/crypto";

export async function POST(req: Request) {
  const c = await cookies();
  const token = c.get("session")?.value;

  if (token) {
    const tokenHash = hashToken(token);
    await sql`UPDATE session SET revoked_at = now() WHERE token_hash = ${tokenHash}`;
  }

  c.set("session", "", { path: "/", expires: new Date(0) });

  const accept = req.headers.get("accept") || "";
  if (accept.includes("application/json")) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.redirect(new URL("/", req.url), 303);
}