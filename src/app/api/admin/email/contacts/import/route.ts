import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireStaff } from "@/lib/auth/api";
import { parseCSV } from "@/lib/email/csv-parser";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function POST(req: Request) {
  try {
    await requireStaff(req, ["admin"]);

    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return json({ ok: false, error: "Content-Type trebuie să fie application/json." }, 415);
    }

    const body = await req.json();
    const { csv } = body;

    if (!csv || typeof csv !== "string") {
      return json({ ok: false, error: "CSV necesar ca string." }, 400);
    }

    // Parse CSV
    let rows;
    try {
      rows = parseCSV(csv, 5000); // Max 5000 rows per import
    } catch (error: any) {
      return json({ ok: false, error: error?.message || "Eroare la parsare CSV." }, 400);
    }

    if (rows.length === 0) {
      return json({ ok: false, error: "CSV nu contine rânduri valide." }, 400);
    }

    // Upsert contacts (on email conflict, update first_name, last_name, tags)
    let insertedCount = 0;
    let updatedCount = 0;

    for (const row of rows) {
      try {
        // Upsert: insert if not exists, update tags/names if exists
        const result = await sql`
          INSERT INTO email_contact (email, first_name, last_name, tags, is_unsubscribed)
          VALUES (${row.email}, ${row.first_name || null}, ${row.last_name || null}, ${row.tags}::text[], false)
          ON CONFLICT (email) DO UPDATE
          SET
            first_name = COALESCE(EXCLUDED.first_name, email_contact.first_name),
            last_name = COALESCE(EXCLUDED.last_name, email_contact.last_name),
            tags = ARRAY(SELECT DISTINCT unnest(email_contact.tags || EXCLUDED.tags)),
            updated_at = NOW()
          RETURNING id, (xmax = 0) as is_inserted
        `;

        if (result.length > 0) {
          if (result[0].is_inserted) {
            insertedCount++;
          } else {
            updatedCount++;
          }
        }
      } catch (error: any) {
        console.error("[CSV Import Error]", row.email, error);
        continue;
      }
    }

    return json({
      ok: true,
      inserted: insertedCount,
      updated: updatedCount,
      total: insertedCount + updatedCount,
    });
  } catch (e: any) {
    console.error("[API contacts import POST]", e);
    return json({ ok: false, error: e?.message || "Eroare internă." }, 500);
  }
}
