import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/api";
import { exchangeCodeForToken } from "@/lib/efactura/oauth";

export async function GET(req: Request) {
  await requireStaff(req, ["admin"]);

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const redirectTo = (ok: boolean, msg?: string) =>
    NextResponse.redirect(
      new URL(
        `/admin/facturi?efactura=${ok ? "connected" : "error"}${msg ? `&msg=${encodeURIComponent(msg)}` : ""}`,
        req.url
      )
    );

  if (error) return redirectTo(false, error);
  if (!code) return redirectTo(false, "cod lipsa");

  try {
    await exchangeCodeForToken(code);
    return redirectTo(true);
  } catch (e: any) {
    return redirectTo(false, e?.message || "eroare necunoscuta");
  }
}
