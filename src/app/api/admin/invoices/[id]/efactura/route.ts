import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/api";
import { sendInvoiceToAnaf, refreshAnafStatus } from "@/lib/efactura/send";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

/** POST: validate + submit the invoice to ANAF (upload or uploadb2c). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireStaff(req, ["admin", "sales", "sales_rep"]);
  const { id } = await params;

  const result = await sendInvoiceToAnaf(id);
  if (!result.ok) {
    return json({ error: result.error, validationErrors: result.validationErrors }, 400);
  }
  return json({ ok: true, uploadId: result.uploadId, status: result.status });
}

/** GET: report current ANAF status, polling ANAF if a submission is still pending. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireStaff(req, ["admin", "sales", "sales_rep"]);
  const { id } = await params;

  const result = await refreshAnafStatus(id);
  if (!result.ok) return json({ error: result.error }, 404);
  return json(result);
}
