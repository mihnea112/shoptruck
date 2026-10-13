import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/api";
import { getAuthorizeUrl } from "@/lib/efactura/oauth";

/**
 * Kicks off the one-time ANAF OAuth2 authorization. The admin needs their qualified
 * digital certificate available in the browser to complete ANAF's login screen.
 */
export async function GET(req: Request) {
  await requireStaff(req, ["admin"]);
  const url = getAuthorizeUrl(crypto.randomUUID());
  return NextResponse.redirect(url);
}
