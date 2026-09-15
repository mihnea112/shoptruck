import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getEpClient } from "@/lib/euplatesc";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = String(value);
    });

    console.log("[EuPlatesc callback] params:", JSON.stringify(params));

    const result = getEpClient().checkResponse(params as any);

    console.log("[EuPlatesc callback] result:", JSON.stringify(result));

    const invoiceId = params.invoice_id || params.invoiceId || params.merch_id || "";
    const epId = params.ep_id || params.epId || "";
    const action = params.action || "";

    if (!invoiceId) {
      console.error("[EuPlatesc callback] No invoice_id found in params");
      return new NextResponse("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
    }

    const isSuccess = (result.success && result.response === "complete") || action === "0";

    if (isSuccess) {
      await sql`
        UPDATE public."order"
        SET payment_status = 'paid', ep_id = ${epId}
        WHERE id = ${invoiceId}::uuid
      `;
      console.log("[EuPlatesc callback] Order marked as paid:", invoiceId);
    } else {
      await sql`
        UPDATE public."order"
        SET payment_status = 'failed', ep_id = ${epId}
        WHERE id = ${invoiceId}::uuid
      `;
      console.log("[EuPlatesc callback] Order marked as failed:", invoiceId);
    }

    return new NextResponse("OK", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (e: any) {
    console.error("[EuPlatesc callback] Error:", e);
    return new NextResponse("OK", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
