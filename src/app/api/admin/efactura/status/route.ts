import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/api";
import { isConnected } from "@/lib/efactura/oauth";
import { isEfacturaEnv } from "@/lib/efactura/config";

export async function GET(req: Request) {
  await requireStaff(req, ["admin", "sales", "sales_rep"]);
  const connected = await isConnected();
  return NextResponse.json(
    { ok: true, connected, env: isEfacturaEnv() },
    { headers: { "cache-control": "no-store" } }
  );
}
