import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { refreshAnafStatus } from "@/lib/efactura/send";

/**
 * Polls ANAF for the status of every invoice still awaiting processing.
 * Trigger this on a schedule (e.g. Vercel Cron, every 15-30 min) with header
 * `Authorization: Bearer ${CRON_SECRET}`.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
    }
  }

  const pending = (await sql`
    SELECT id FROM invoice WHERE anaf_status = 'trimisa' AND anaf_upload_id IS NOT NULL
  `) as any[];

  const results: any[] = [];
  for (const row of pending) {
    try {
      const result = await refreshAnafStatus(row.id);
      results.push({ id: row.id, ...result });
    } catch (e: any) {
      console.error("[efactura-poll] failed for", row.id, e?.message);
      results.push({ id: row.id, ok: false, error: e?.message });
    }
  }

  return NextResponse.json({ ok: true, checked: results.length, results });
}
