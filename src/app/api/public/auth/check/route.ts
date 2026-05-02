import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/server";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

// GET /api/public/auth/check - Check if user is logged in
export async function GET(req: Request) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return json({ ok: false, isLoggedIn: false }, 401);
    }

    return json({
      ok: true,
      isLoggedIn: true,
      user: {
        id: user.userId,
        kind: user.kind,
      },
    });
  } catch (e: any) {
    console.error("[API auth check GET]", e);
    return json({ ok: false, isLoggedIn: false, error: e?.message || "Eroare internă." }, 500);
  }
}
