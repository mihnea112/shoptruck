import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireStaff } from "@/lib/auth/api";
import { supabaseAdmin } from "@/lib/supabase/admin";

const BUCKET = "account-attachments";
const ROLES = ["admin", "sales", "sales_rep"];

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireStaff(req, ROLES);
    const { id: accountId } = await ctx.params;

    const rows = (await sql`
      SELECT id, vehicle_id, kind, storage_path, file_name, note, created_at
      FROM account_attachment
      WHERE account_id = ${accountId}::uuid
      ORDER BY created_at DESC
    `) as any[];

    const sb = supabaseAdmin();
    const items = await Promise.all(
      rows.map(async (r) => {
        const { data } = await sb.storage.from(BUCKET).createSignedUrl(r.storage_path, 3600);
        return { ...r, url: data?.signedUrl ?? null };
      }),
    );
    return json({ ok: true, items });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "Eroare." }, Number(e?.status ?? 500));
  }
}

// body: { action: "upload-url", ext } -> signed upload url
//       { action: "register", storage_path, file_name?, note?, kind?, vehicle_id? } -> saves the row
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireStaff(req, ROLES);
    const { id: accountId } = await ctx.params;
    const body = await req.json().catch(() => ({}));

    if (body?.action === "upload-url") {
      const ext = String(body?.ext || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${accountId}/${crypto.randomUUID()}.${ext}`;
      const { data, error } = await supabaseAdmin().storage.from(BUCKET).createSignedUploadUrl(path);
      if (error) return json({ ok: false, error: error.message }, 400);
      return json({ ok: true, ...data });
    }

    if (body?.action === "register") {
      const storagePath = String(body?.storage_path || "").trim();
      // only accept paths inside this account's folder
      if (!storagePath || !storagePath.startsWith(`${accountId}/`)) {
        return json({ ok: false, error: "storage_path invalid." }, 400);
      }
      const fileName = body?.file_name ? String(body.file_name).slice(0, 200) : null;
      const note = body?.note ? String(body.note).slice(0, 500) : null;
      const kind = body?.kind ? String(body.kind).slice(0, 40) : "nameplate";
      const vehicleId = body?.vehicle_id ? String(body.vehicle_id) : null;

      const rows = (await sql`
        INSERT INTO account_attachment (account_id, vehicle_id, kind, storage_path, file_name, note, created_by_user_id)
        VALUES (
          ${accountId}::uuid,
          ${vehicleId ? sql`${vehicleId}::uuid` : null},
          ${kind}, ${storagePath}, ${fileName}, ${note},
          ${(user as any).userId ? sql`${(user as any).userId}::uuid` : null}
        )
        RETURNING id
      `) as any[];
      return json({ ok: true, id: rows[0]?.id });
    }

    return json({ ok: false, error: "Acțiune necunoscută." }, 400);
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "Eroare." }, Number(e?.status ?? 500));
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireStaff(req, ROLES);
    const { id: accountId } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const attId = String(body?.id || "").trim();
    if (!attId) return json({ ok: false, error: "id lipsă." }, 400);
    const note = body?.note != null ? String(body.note).slice(0, 500) : null;
    await sql`
      UPDATE account_attachment SET note = ${note}
      WHERE id = ${attId}::uuid AND account_id = ${accountId}::uuid
    `;
    return json({ ok: true });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "Eroare." }, Number(e?.status ?? 500));
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireStaff(req, ROLES);
    const { id: accountId } = await ctx.params;
    const attId = String(new URL(req.url).searchParams.get("id") || "").trim();
    if (!attId) return json({ ok: false, error: "id lipsă." }, 400);

    const rows = (await sql`
      DELETE FROM account_attachment
      WHERE id = ${attId}::uuid AND account_id = ${accountId}::uuid
      RETURNING storage_path
    `) as any[];
    if (rows[0]?.storage_path) {
      await supabaseAdmin().storage.from(BUCKET).remove([rows[0].storage_path]);
    }
    return json({ ok: true });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "Eroare." }, Number(e?.status ?? 500));
  }
}
