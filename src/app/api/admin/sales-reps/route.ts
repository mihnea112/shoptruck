import { NextResponse } from "next/server";
import argon2 from "argon2";
import { sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/server";

function isValidEmail(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isStrongEnoughPassword(pw: string) {
  if (pw.length < 8 || pw.length > 200) return false;
  const hasLetter = /[A-Za-z]/.test(pw);
  const hasNumber = /\d/.test(pw);
  return hasLetter && hasNumber;
}

function sameOriginCheck(req: Request) {
  if (process.env.NODE_ENV !== "production") return true;
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) return false;
  try {
    const o = new URL(origin);
    return o.host === host;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!sameOriginCheck(req)) {
    return NextResponse.json(
      { ok: false, error: "Cerere respinsă (origine invalidă)." },
      { status: 403 }
    );
  }

  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    return NextResponse.json(
      { ok: false, error: "Content-Type invalid. Folosește application/json." },
      { status: 415 }
    );
  }

  const me = await getSessionUser();
  if (!me)
    return NextResponse.json(
      { ok: false, error: "Neautorizat." },
      { status: 401 }
    );
  if (me.kind !== "staff" || !me.roles.includes("ADMIN")) {
    return NextResponse.json(
      { ok: false, error: "Acces interzis." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const emailRaw = body?.email?.toString()?.trim() || "";
  const email = emailRaw.toLowerCase();
  const password = body?.password?.toString() || "";
  const fullName = body?.fullName?.toString()?.trim() || null; // not persisted yet

  if (!isValidEmail(email)) {
    return NextResponse.json(
      { ok: false, error: "Email invalid." },
      { status: 400 }
    );
  }
  if (!isStrongEnoughPassword(password)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Parola trebuie să aibă minim 8 caractere și să conțină litere și cifre.",
      },
      { status: 400 }
    );
  }

  const exists =
    await sql`SELECT 1 FROM app_user WHERE email = ${email} LIMIT 1`;
  if (Array.isArray(exists) && exists.length > 0) {
    return NextResponse.json(
      { ok: false, error: "Există deja un cont cu acest email." },
      { status: 409 }
    );
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    timeCost: 3,
    memoryCost: 2 ** 16,
    parallelism: 1,
  });

  try {
    const rows = await sql`
      WITH role_cte AS (
        SELECT id FROM role WHERE key = 'SALES_REP' LIMIT 1
      ),
      new_user AS (
        INSERT INTO app_user (email, password_hash, kind, is_active)
        SELECT ${email}, ${passwordHash}, 'staff', true
        FROM role_cte
        RETURNING id
      ),
      role_link AS (
        INSERT INTO user_role (user_id, role_id)
        SELECT nu.id, r.id
        FROM new_user nu
        JOIN role_cte r ON true
        ON CONFLICT DO NOTHING
        RETURNING user_id
      )
      SELECT (SELECT id FROM new_user) AS user_id,
             (SELECT COUNT(*)::int FROM role_cte) AS role_exists
    `;

    const userId = (rows as any[])?.[0]?.user_id as string | undefined;
    const roleExists = (rows as any[])?.[0]?.role_exists as number | undefined;

    if (!roleExists) {
      return NextResponse.json(
        { ok: false, error: "Rolul SALES_REP lipsește din baza de date." },
        { status: 500 }
      );
    }
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Eroare la creare utilizator." },
        { status: 500 }
      );
    }

    void fullName;

    return NextResponse.json(
      { ok: true, userId },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (e: any) {
    if (e?.code === "23505") {
      return NextResponse.json(
        { ok: false, error: "Există deja un cont cu acest email." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { ok: false, error: "Eroare internă." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  if (!sameOriginCheck(req)) {
    return NextResponse.json(
      { ok: false, error: "Cerere respinsă (origine invalidă)." },
      { status: 403 }
    );
  }

  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    return NextResponse.json(
      { ok: false, error: "Content-Type invalid. Folosește application/json." },
      { status: 415 }
    );
  }

  const me = await getSessionUser();
  if (!me)
    return NextResponse.json(
      { ok: false, error: "Neautorizat." },
      { status: 401 }
    );
  if (me.kind !== "staff" || !me.roles.includes("ADMIN")) {
    return NextResponse.json(
      { ok: false, error: "Acces interzis." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const userId = body?.userId?.toString()?.trim();
  if (!userId)
    return NextResponse.json(
      { ok: false, error: "Lipsește userId." },
      { status: 400 }
    );

  if ((me as any).id && userId === (me as any).id) {
    return NextResponse.json(
      { ok: false, error: "Nu îți poți șterge propriul cont." },
      { status: 400 }
    );
  }

  try {
    const rows = await sql`
      WITH role_admin AS (SELECT id FROM role WHERE key = 'ADMIN' LIMIT 1),
      target AS (
        SELECT u.id
        FROM app_user u
        WHERE u.id = ${userId}
          AND u.kind = 'staff'
          AND NOT EXISTS (
            SELECT 1 FROM user_role ur
            WHERE ur.user_id = u.id AND ur.role_id = (SELECT id FROM role_admin)
          )
        LIMIT 1
      ),
      del_sessions AS (
        DELETE FROM session s
        WHERE s.user_id = (SELECT id FROM target)
        RETURNING 1
      ),
      del_roles AS (
        DELETE FROM user_role ur
        WHERE ur.user_id = (SELECT id FROM target)
        RETURNING 1
      ),
      del_user AS (
        DELETE FROM app_user u
        WHERE u.id = (SELECT id FROM target)
        RETURNING u.id
      )
      SELECT (SELECT id FROM target) AS target_id,
             (SELECT id FROM del_user) AS user_id
    `;

    const targetId = (rows as any[])?.[0]?.target_id as string | undefined;
    const deletedId = (rows as any[])?.[0]?.user_id as string | undefined;

    // Idempotent behavior: if already deleted, treat as success
    if (!targetId) {
      const stillThere =
        await sql`SELECT 1 FROM app_user WHERE id = ${userId} LIMIT 1`;
      const exists = Array.isArray(stillThere) && stillThere.length > 0;

      if (!exists) {
        return NextResponse.json(
          { ok: true, userId, alreadyDeleted: true },
          { headers: { "cache-control": "no-store" } }
        );
      }

      return NextResponse.json(
        {
          ok: false,
          error: "Agentul nu a fost găsit (sau este administrator).",
        },
        { status: 404 }
      );
    }

    // Target exists but delete didn't return id => blocked by FK constraints etc.
    if (!deletedId) {
      return NextResponse.json(
        { ok: false, error: "Ștergerea a fost blocată de baza de date." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { ok: true, userId: deletedId },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (e: any) {
    const debug =
      process.env.NODE_ENV !== "production"
        ? {
            code: e?.code ?? null,
            constraint: e?.constraint ?? null,
            table: e?.table ?? null,
            detail: e?.detail ?? null,
            message: e?.message ?? String(e),
          }
        : undefined;

    return NextResponse.json(
      { ok: false, error: "Eroare internă.", debug },
      { status: 500 }
    );
  }
}
