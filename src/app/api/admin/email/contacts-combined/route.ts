import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireStaff } from "@/lib/auth/api";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

interface CombinedContact {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  tags: string[];
  is_unsubscribed: boolean;
  created_at: string;
  source: "account" | "email_contact" | "both";
  account_id?: string;
  phone?: string;
  kind?: "COMPANY" | "INDIVIDUAL";
}

export async function GET(req: Request) {
  try {
    await requireStaff(req, ["admin"]);

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 50), 1), 200);
    const offset = Math.max(Number(searchParams.get("offset") || 0), 0);
    const sourceFilter = (searchParams.get("source") || "").trim(); // 'account', 'email_contact', or 'both'

    // Build search condition
    let searchCondition = sql``;
    if (q && q.length >= 2) {
      searchCondition = sql`
        AND (
          LOWER(COALESCE(a.email, ec.email)) ILIKE LOWER(${`%${q}%`})
          OR LOWER(a.display_name) ILIKE LOWER(${`%${q}%`})
          OR LOWER(ec.first_name || ' ' || ec.last_name) ILIKE LOWER(${`%${q}%`})
          OR LOWER(a.phone) ILIKE LOWER(${`%${q}%`})
        )
      `;
    }

    // Build source filter
    let sourceCondition = sql``;
    if (sourceFilter === "account") {
      sourceCondition = sql`AND ec.id IS NULL`;
    } else if (sourceFilter === "email_contact") {
      sourceCondition = sql`AND a.id IS NULL`;
    } else if (sourceFilter === "both") {
      sourceCondition = sql`AND a.id IS NOT NULL AND ec.id IS NOT NULL`;
    }

    // Query combined contacts (FULL OUTER JOIN to get all)
    const rows = await sql`
      SELECT
        COALESCE(ec.id, gen_random_uuid())::text as id,
        LOWER(COALESCE(a.email, ec.email)) as email_lower,
        COALESCE(a.email, ec.email) as email,
        COALESCE(ec.first_name, SPLIT_PART(a.display_name, ' ', 1)) as first_name,
        COALESCE(ec.last_name, NULLIF(SUBSTRING(a.display_name FROM POSITION(' ' IN a.display_name) + 1), '')) as last_name,
        COALESCE(ec.tags, '{}') as tags,
        COALESCE(ec.is_unsubscribed, false) as is_unsubscribed,
        COALESCE(ec.created_at, a.created_at) as created_at,
        CASE
          WHEN a.id IS NOT NULL AND ec.id IS NOT NULL THEN 'both'
          WHEN ec.id IS NOT NULL THEN 'email_contact'
          WHEN a.id IS NOT NULL THEN 'account'
          ELSE 'unknown'
        END as source,
        a.id as account_id,
        a.phone,
        a.kind
      FROM account a
      FULL OUTER JOIN email_contact ec ON LOWER(a.email) = LOWER(ec.email)
      WHERE (a.email IS NOT NULL AND a.email != '') OR (ec.email IS NOT NULL AND ec.email != '')
      ${searchCondition}
      ${sourceCondition}
      ORDER BY COALESCE(ec.created_at, a.created_at) DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Get total count
    const countResult = await sql`
      SELECT COUNT(DISTINCT LOWER(COALESCE(a.email, ec.email))) as total
      FROM account a
      FULL OUTER JOIN email_contact ec ON LOWER(a.email) = LOWER(ec.email)
      WHERE (a.email IS NOT NULL AND a.email != '') OR (ec.email IS NOT NULL AND ec.email != '')
      ${searchCondition}
      ${sourceCondition}
    `;

    const total = countResult.length > 0 ? Number(countResult[0].total) : 0;

    // Format response
    const contacts: CombinedContact[] = rows.map((row: any) => ({
      id: row.id,
      email: row.email,
      first_name: row.first_name || undefined,
      last_name: row.last_name || undefined,
      tags: row.tags || [],
      is_unsubscribed: row.is_unsubscribed || false,
      created_at: row.created_at,
      source: row.source,
      ...(row.account_id && { account_id: row.account_id }),
      ...(row.phone && { phone: row.phone }),
      ...(row.kind && { kind: row.kind }),
    }));

    return json({
      ok: true,
      items: contacts,
      total,
      limit,
      offset,
      source_breakdown: {
        account_only: rows.filter((r: any) => r.source === "account").length,
        email_contact_only: rows.filter((r: any) => r.source === "email_contact").length,
        both: rows.filter((r: any) => r.source === "both").length,
      },
    });
  } catch (e: any) {
    console.error("[API contacts-combined GET]", e);
    return json({ ok: false, error: e?.message || "Eroare internă." }, 500);
  }
}

export async function POST(req: Request) {
  try {
    await requireStaff(req, ["admin"]);

    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return json({ ok: false, error: "Content-Type trebuie să fie application/json." }, 415);
    }

    const body = await req.json();
    const { action, account_ids } = body;

    if (action === "import-customers") {
      // Import specific customers from account to email_contact
      if (!Array.isArray(account_ids) || account_ids.length === 0) {
        return json({ ok: false, error: "account_ids trebuie să fie un array non-gol." }, 400);
      }

      let importedCount = 0;
      let skippedCount = 0;

      for (const accountId of account_ids) {
        try {
          // Get account data
          const account = await sql`
            SELECT id, email, display_name, kind FROM account WHERE id = ${accountId}::uuid
          `;

          if (!account.length || !account[0].email) {
            skippedCount++;
            continue;
          }

          // Check if already in email_contact
          const existing = await sql`
            SELECT id FROM email_contact WHERE LOWER(email) = LOWER(${account[0].email})
          `;

          if (existing.length > 0) {
            skippedCount++;
            continue;
          }

          // Parse name
          const fullName = account[0].display_name || "";
          const nameParts = fullName.split(" ");
          const firstName = nameParts[0] || null;
          const lastName = nameParts.slice(1).join(" ") || null;

          // Add tag based on kind
          const tags = account[0].kind === "COMPANY" ? ["business"] : [];

          // Insert into email_contact
          await sql`
            INSERT INTO email_contact (email, first_name, last_name, tags, created_at)
            VALUES (${account[0].email}, ${firstName}, ${lastName}, ${tags}::text[], NOW())
            ON CONFLICT (email) DO NOTHING
          `;

          importedCount++;
        } catch (error) {
          console.error(`[Import Error] ${accountId}:`, error);
          skippedCount++;
          continue;
        }
      }

      return json({
        ok: true,
        imported: importedCount,
        skipped: skippedCount,
        message: `Importat ${importedCount} clienți, ${skippedCount} ignorați.`,
      });
    }

    return json({ ok: false, error: "Action necunoscut. Folosiți: import-customers" }, 400);
  } catch (e: any) {
    console.error("[API contacts-combined POST]", e);
    return json({ ok: false, error: e?.message || "Eroare internă." }, 500);
  }
}
