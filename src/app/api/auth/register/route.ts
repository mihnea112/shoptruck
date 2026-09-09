// src/app/api/auth/register/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sql } from "@/lib/db";
import { encryptPII } from "@/lib/crypto/pii";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function normalizeEmail(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
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

function isValidEmail(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function cleanText(v: unknown, max = 2000) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function okPassword(pw: string) {
  return pw.length >= 8 && pw.length <= 500;
}

type RegisterBody =
  | {
      kind: "individual";
      email: string;
      password: string;
      mode?: "cookie" | "token" | "both";
      firstName: string;
      lastName: string;
      phone?: string;
    }
  | {
      kind: "company";
      email: string;
      password: string;
      mode?: "cookie" | "token" | "both";
      companyName: string;
      vatId?: string;
      regNo?: string;
      contactName?: string;
      contactPhone?: string;
      contactEmail?: string;
    };



export async function POST(req: Request) {
  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    return json(
      { ok: false, error: "Content-Type invalid. Folosește application/json." },
      415
    );
  }

  const body = (await req.json().catch(() => null)) as RegisterBody | null;

  const modeRaw = String((body as any)?.mode ?? "cookie");
  const mode = modeRaw === "token" || modeRaw === "both" ? modeRaw : "cookie";

  if ((mode === "cookie" || mode === "both") && !sameOriginCheck(req)) {
    return json({ ok: false, error: "Cerere respinsă (origine invalidă)." }, 403);
  }

  const kind = String((body as any)?.kind ?? "");
  const email = normalizeEmail((body as any)?.email);
  const password = String((body as any)?.password ?? "");

  if (!email || !password || !isValidEmail(email) || !okPassword(password)) {
    return json({ ok: false, error: "Date invalide. Verifică email/parolă." }, 400);
  }

  if (kind !== "individual" && kind !== "company") {
    return json({ ok: false, error: "Tip cont invalid." }, 400);
  }

  // Verify Supabase config
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ ok: false, error: "Configurare Supabase invalidă." }, 500);
  }

  // Email uniqueness is handled by Supabase auth

  // Build account payload
  let accountKind: "INDIVIDUAL" | "COMPANY";
  let displayName: string | null = null;
  let legalName: string | null = null;
  let phone: string | null = null;
  let taxId: string | null = null;
  let regNo: string | null = null;
  let notes: string | null = null;

  let accountEmail = email;

  if (kind === "individual") {
    const firstName = cleanText((body as any)?.firstName, 120);
    const lastName = cleanText((body as any)?.lastName, 120);
    phone = cleanText((body as any)?.phone, 50);

    if (!firstName || !lastName) {
      return json({ ok: false, error: "Completează numele și prenumele." }, 400);
    }

    accountKind = "INDIVIDUAL";
    displayName = `${lastName} ${firstName}`.trim();
    legalName = null;
    notes = null;
  } else {
    const companyName = cleanText((body as any)?.companyName, 200);
    if (!companyName) return json({ ok: false, error: "Completează numele firmei." }, 400);

    accountKind = "COMPANY";
    displayName = companyName;
    legalName = companyName;

    taxId = cleanText((body as any)?.vatId, 50);
    regNo = cleanText((body as any)?.regNo, 80);

    const contactName = cleanText((body as any)?.contactName, 200);
    const contactPhone = cleanText((body as any)?.contactPhone, 50);
    const contactEmailRaw = normalizeEmail((body as any)?.contactEmail);
    const contactEmailOk = contactEmailRaw ? isValidEmail(contactEmailRaw) : false;

    notes =
      [contactName ? `Contact: ${contactName}` : null, contactPhone ? `Tel: ${contactPhone}` : null]
        .filter(Boolean)
        .join(" · ") || null;

    phone = contactPhone ?? null;
    accountEmail = contactEmailOk ? contactEmailRaw : email;
  }

  let supabaseUserId: string | null = null;

  try {
    // 1. Create user in Supabase auth first using regular signup
    const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!SUPABASE_ANON_KEY) {
      return json({ ok: false, error: "Configurare Supabase invalidă." }, 500);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${SUPABASE_URL.split('?')[0]}/api/auth/callback`,
      },
    });

    if (signUpError || !signUpData?.user?.id) {
      console.error("Supabase signup error:", signUpError);
      const msg = signUpError?.message?.includes("already exists")
        ? "Există deja un cont cu acest email."
        : "Eroare la crearea contului. Încearcă din nou.";
      return json({ ok: false, error: msg }, signUpError?.status || 500);
    }

    supabaseUserId = signUpData.user.id;

    // Check if an existing account matches this email/tax_id (admin-created before signup)
    let linkedExisting = false;
    try {
      const existingAccount = await sql`
        SELECT id FROM account
        WHERE (LOWER(email) = ${email} AND user_id IS NULL)
          ${taxId ? sql`OR (tax_id IS NOT NULL AND LOWER(tax_id) = LOWER(${taxId}) AND user_id IS NULL)` : sql``}
        LIMIT 1
      ` as any[];

      if (existingAccount.length > 0) {
        // Link & update the existing account
        await sql`
          UPDATE account SET
            user_id = ${supabaseUserId}::uuid,
            display_name = COALESCE(display_name, ${displayName}),
            legal_name = COALESCE(legal_name, ${legalName}),
            full_name = COALESCE(full_name, ${kind === "individual" ? displayName : null}),
            phone = COALESCE(phone, ${phone}),
            tax_id = COALESCE(tax_id, ${taxId}),
            reg_no = COALESCE(reg_no, ${regNo}),
            roles = COALESCE(NULLIF(roles, ARRAY[]::TEXT[]), ARRAY[]::TEXT[]),
            is_active = true,
            updated_at = now()
          WHERE id = ${existingAccount[0].id}::uuid
        `;
        linkedExisting = true;
        console.log("[REGISTER] Linked existing account to user");

        // Also link partner if it exists for that account
        await sql`
          UPDATE partner SET account_id = ${supabaseUserId}::uuid
          WHERE account_id = ${existingAccount[0].id}::uuid
            AND NOT EXISTS (SELECT 1 FROM partner WHERE account_id = ${supabaseUserId}::uuid)
        `;
      }
    } catch (linkErr) {
      console.error("Account linking failed (non-critical):", linkErr);
    }

    // Create account entry if not linked above
    if (!linkedExisting) {
      try {
        await sql`
          INSERT INTO account (
            user_id, kind, display_name, legal_name, full_name,
            email, phone, tax_id, reg_no, notes,
            roles, is_active
          ) VALUES (
            ${supabaseUserId}::uuid, ${accountKind}, ${displayName}, ${legalName || displayName},
            ${kind === "individual" ? displayName : null},
            ${email}, ${encryptPII(phone)}, ${encryptPII(taxId)}, ${encryptPII(regNo)}, ${notes},
            ARRAY[]::TEXT[], true
          )
        `;
      } catch (accErr) {
        console.error("Account creation error:", accErr);
        // Clean up auth user
        try {
          const supabaseAdminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
          await supabaseAdminClient.auth.admin.deleteUser(supabaseUserId);
        } catch {}
        return json({ ok: false, error: "Eroare la crearea contului. Încearcă din nou." }, 500);
      }
    }

    // Auto-create partner entry (if not already linked above)
    try {
      const existingPartner = await sql`
        SELECT id FROM partner WHERE account_id = ${supabaseUserId}::uuid LIMIT 1
      ` as any[];

      if (existingPartner.length === 0) {
        const partnerKind = accountKind === "COMPANY" ? "COMPANY" : "INDIVIDUAL";
        await sql`
          INSERT INTO partner (
            partner_type, kind, display_name, legal_name,
            email, phone, tax_id, reg_no,
            account_id, credit_days, credit_limit
          ) VALUES (
            'CLIENT', ${partnerKind}, ${displayName}, ${legalName || displayName},
            ${email}, ${encryptPII(phone)}, ${encryptPII(taxId)}, ${encryptPII(regNo)},
            ${supabaseUserId}::uuid, 0, 0
          )
        `;
      }
    } catch (partnerErr) {
      console.error("Auto-create partner entry failed:", partnerErr);
    }

    // After registration, redirect to login so user can authenticate with Supabase
    const redirectTo = "/login";
    const userId = supabaseUserId;
    const roles: string[] = [];

    const userSafe = { id: userId, email, kind: "customer" as const, roles };

    return json({
      ok: true,
      redirectTo,
      user: userSafe,
    });
  } catch (e: any) {
    // If Supabase user creation succeeded but profile creation failed, clean up
    if (supabaseUserId) {
      try {
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await supabaseAdmin.auth.admin.deleteUser(supabaseUserId);
      } catch {}
    }
    console.error("Register error:", e);
    return json({ ok: false, error: "Eroare internă." }, 500);
  }
}