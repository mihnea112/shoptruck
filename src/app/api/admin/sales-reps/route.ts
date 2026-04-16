// src/app/api/admin/sales-reps/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/api";
import { supabaseAdmin } from "@/lib/supabase/admin";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

// GET — list all staff profiles
export async function GET(req: Request) {
  try {
    await requireAdmin(req);

    const rows = await sql`
      SELECT
        p.user_id,
        COALESCE(p.full_name, '') AS full_name,
        COALESCE(p.email, '')     AS email,
        p.roles,
        p.is_active,
        p.created_at
      FROM profile p
      WHERE p.roles && ARRAY['ADMIN','SALES_REP','WAREHOUSE_OP']::text[]
      ORDER BY p.full_name ASC, p.email ASC
    `;

    return json({ ok: true, items: rows });
  } catch (e: any) {
    return json(
      { ok: false, error: e?.message || "Eroare." },
      Number(e?.status ?? 500),
    );
  }
}

// POST — create new staff user via Supabase Auth + profile
export async function POST(req: Request) {
  try {
    await requireAdmin(req);

    const body = await req.json().catch(() => null);
    const email = String(body?.email ?? "")
      .trim()
      .toLowerCase();
    const password = String(body?.password ?? "").trim();
    const fullName =
      String(body?.fullName ?? body?.full_name ?? "").trim() || null;
    const roles: string[] = Array.isArray(body?.roles)
      ? body.roles
          .map((r: any) => String(r).trim().toUpperCase())
          .filter(Boolean)
      : ["SALES_REP"];

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return json({ ok: false, error: "Email invalid." }, 400);
    if (!password || password.length < 8)
      return json(
        { ok: false, error: "Parola trebuie să aibă minim 8 caractere." },
        400,
      );

    const sb = supabaseAdmin();

    const { data: authData, error: authError } = await sb.auth.admin.createUser(
      {
        email,
        password,
        email_confirm: true,
      },
    );

    if (authError || !authData?.user) {
      const msg = authError?.message || "Eroare la creare cont.";
      if (
        msg.toLowerCase().includes("already") ||
        msg.toLowerCase().includes("duplicate")
      ) {
        return json(
          { ok: false, error: "Există deja un cont cu acest email." },
          409,
        );
      }
      return json({ ok: false, error: msg }, 400);
    }

    const userId = authData.user.id;

    await sql`
      INSERT INTO profile (user_id, email, full_name, roles, is_active, default_route)
      VALUES (
        ${userId}::uuid,
        ${email},
        ${fullName},
        ${roles}::text[],
        true,
        '/admin'
      )
      ON CONFLICT (user_id)
      DO UPDATE SET
        email      = ${email},
        full_name  = COALESCE(${fullName}, profile.full_name),
        roles      = ${roles}::text[],
        is_active  = true,
        updated_at = now()
    `;

    return json({ ok: true, userId });
  } catch (e: any) {
    return json(
      { ok: false, error: e?.message || "Eroare internă." },
      Number(e?.status ?? 500),
    );
  }
}

// PATCH — update roles / name / active status
export async function PATCH(req: Request) {
  try {
    await requireAdmin(req);

    const body = await req.json().catch(() => null);
    const userId = String(body?.userId ?? body?.user_id ?? "").trim();
    const fullName =
      body?.fullName != null ? String(body.fullName).trim() || null : null;
    const isActive = body?.is_active != null ? Boolean(body.is_active) : null;
    const roles = Array.isArray(body?.roles)
      ? body.roles
          .map((r: any) => String(r).trim().toUpperCase())
          .filter(Boolean)
      : null;

    if (!userId) return json({ ok: false, error: "userId lipsă." }, 400);

    await sql`
      UPDATE profile SET
        full_name  = CASE WHEN ${fullName !== null} THEN ${fullName}        ELSE full_name  END,
        roles      = CASE WHEN ${roles !== null} THEN ${roles}::text[]   ELSE roles      END,
        is_active  = CASE WHEN ${isActive !== null} THEN ${isActive}        ELSE is_active  END,
        updated_at = now()
      WHERE user_id = ${userId}::uuid
    `;

    return json({ ok: true });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "Eroare." }, 500);
  }
}

// DELETE — remove user from Supabase Auth (cascades to profile)
export async function DELETE(req: Request) {
  try {
    const me = await requireAdmin(req);

    const body = await req.json().catch(() => null);
    const userId = String(body?.userId ?? body?.user_id ?? "").trim();

    if (!userId) return json({ ok: false, error: "userId lipsă." }, 400);
    if (userId === me.userId)
      return json(
        { ok: false, error: "Nu îți poți șterge propriul cont." },
        400,
      );

    const sb = supabaseAdmin();
    const { error: delError } = await sb.auth.admin.deleteUser(userId);
    if (delError) return json({ ok: false, error: delError.message }, 400);

    await sql`DELETE FROM profile WHERE user_id = ${userId}::uuid`;

    return json({ ok: true, userId });
  } catch (e: any) {
    return json(
      { ok: false, error: e?.message || "Eroare internă." },
      Number(e?.status ?? 500),
    );
  }
}
