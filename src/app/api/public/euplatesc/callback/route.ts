import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getEpClient } from "@/lib/euplatesc";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const raw: Record<string, string> = {};
    formData.forEach((value, key) => {
      raw[key] = String(value);
    });

    console.log("[EuPlatesc callback] raw params:", JSON.stringify(raw));

    // EuPlatesc POSTs snake_case; the library expects camelCase
    const mapped = {
      amount: raw.amount ?? "",
      currency: raw.curr ?? "",
      invoiceId: raw.invoice_id ?? "",
      epId: raw.ep_id ?? "",
      merchantId: raw.merch_id ?? "",
      action: raw.action ?? "",
      message: raw.message ?? "",
      approval: raw.approval ?? "",
      timestamp: raw.timestamp ?? "",
      nonce: raw.nonce ?? "",
      fpHash: raw.fp_hash ?? "",
      secStatus: raw.sec_status,
      rrn: raw.rrn,
      mcard: raw.mcard,
      cardExp: raw.card_exp,
      discountAmount: raw.discount_amount,
      paymentChannel: raw.payment_channel,
      cardType: raw.card_type,
      bin: raw.bin,
      rate: raw.rate,
      cardHolder: raw.card_holder,
      email: raw.email,
      rtype: raw.rtype,
      cce: raw.cce,
    };

    const result = getEpClient().checkResponse(mapped as any);

    console.log("[EuPlatesc callback] checkResponse result:", JSON.stringify(result));

    const invoiceId = raw.invoice_id || "";
    const epId = raw.ep_id || "";

    if (!invoiceId) {
      console.error("[EuPlatesc callback] No invoice_id in params");
      return new NextResponse("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
    }

    // action "0" means success in EuPlatesc
    const isSuccess = (result.success && result.response === "complete") || raw.action === "0";

    if (isSuccess) {
      await sql`
        UPDATE public."order"
        SET payment_status = 'paid', ep_id = ${epId}
        WHERE id = ${invoiceId}::uuid
      `;
      console.log("[EuPlatesc callback] Order PAID:", invoiceId);
    } else {
      await sql`
        UPDATE public."order"
        SET payment_status = 'failed', ep_id = ${epId}
        WHERE id = ${invoiceId}::uuid
      `;
      console.log("[EuPlatesc callback] Order FAILED:", invoiceId, "action:", raw.action);
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
