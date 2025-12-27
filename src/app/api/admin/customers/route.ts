import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/server";

// --- TIPURI ---
// Definim tipul direct aici pentru validare
type CustomerPayload = {
  id?: string;
  kind: 'company' | 'individual';
  
  // Date Persoana
  first_name?: string;
  last_name?: string;
  phone?: string;
  
  // Date Firma
  company_name?: string;
  vat_id?: string;
  reg_no?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
};

// ==================================================================
// GET: Căutare Clienți
// Usage: GET /api/admin/customers?q=Popescu
// ==================================================================
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";

  // Returnăm listă goală dacă query-ul e prea scurt (optimizare)
  if (q.length < 2) {
    return NextResponse.json({ ok: true, items: [] });
  }

  const term = `%${q}%`;

  try {
    // Interogăm baza de date (JOIN-uri între customer și extensiile sale)
    const rows = await sql`
      SELECT 
        c.id, 
        c.kind::text as kind, -- Facem cast la text pentru siguranță
        
        -- Date firma
        cc.company_name,
        cc.vat_id,
        cc.reg_no,
        cc.contact_name,
        cc.contact_phone,
        cc.contact_email::text as contact_email,
        
        -- Date persoana
        ci.first_name,
        ci.last_name,
        ci.phone as individual_phone

      FROM customer c
      LEFT JOIN customer_company cc ON c.id = cc.customer_id
      LEFT JOIN customer_individual ci ON c.id = ci.customer_id
      WHERE 
        -- Cautam in FIRMA
        (c.kind = 'company' AND (
           cc.company_name ILIKE ${term} OR 
           cc.vat_id ILIKE ${term} OR
           cc.contact_name ILIKE ${term}
        ))
        OR
        -- Cautam in PERSOANA FIZICA
        (c.kind = 'individual' AND (
           ci.first_name ILIKE ${term} OR 
           ci.last_name ILIKE ${term} OR 
           ci.phone ILIKE ${term}
        ))
      LIMIT 20
    `;

    // Formatăm datele pentru Frontend
    const items = rows.map((r: any) => {
      const isCompany = r.kind === 'company';
      return {
        id: r.id,
        kind: r.kind,
        display_name: isCompany 
          ? r.company_name 
          : `${r.first_name} ${r.last_name}`,
          
        company_name: r.company_name,
        vat_id: r.vat_id,
        reg_no: r.reg_no,
        contact_name: r.contact_name,
        contact_phone: r.contact_phone,
        contact_email: r.contact_email,
        
        first_name: r.first_name,
        last_name: r.last_name,
        phone: r.individual_phone
      };
    });

    return NextResponse.json({ ok: true, items });

  } catch (err: any) {
    console.error("GET Customer Search Error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// ==================================================================
// POST: Creare sau Actualizare Client
// Usage: POST /api/admin/customers (JSON Body)
// ==================================================================
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as CustomerPayload;
    
    let customerId = body.id;

    // 1. Validare de bază
    if (body.kind === 'company' && !body.company_name) {
      return NextResponse.json({ ok: false, error: "Numele firmei este obligatoriu." }, { status: 400 });
    }
    if (body.kind === 'individual' && (!body.first_name || !body.last_name)) {
      return NextResponse.json({ ok: false, error: "Numele și prenumele sunt obligatorii." }, { status: 400 });
    }

    // 2. INSERT CLIENT PĂRINTE (Dacă e nou)
    if (!customerId) {
      // Inserăm în tabelul 'customer'.
      // user_id este NULL implicit (client offline)
      const res = await sql`
        INSERT INTO customer (kind, created_at)
        VALUES (${body.kind}, NOW())
        RETURNING id
      `;
      customerId = res[0].id;
    }

    // 3. UPSERT ÎN TABELELE COPIL
    if (body.kind === 'company') {
      await sql`
        INSERT INTO customer_company (
          customer_id, company_name, vat_id, reg_no, 
          contact_name, contact_phone, contact_email
        ) VALUES (
          ${customerId}, 
          ${body.company_name}, 
          ${body.vat_id || null}, 
          ${body.reg_no || null},
          ${body.contact_name || null}, 
          ${body.contact_phone || null}, 
          ${body.contact_email || null}
        )
        ON CONFLICT (customer_id) DO UPDATE SET
          company_name = EXCLUDED.company_name,
          vat_id = EXCLUDED.vat_id,
          reg_no = EXCLUDED.reg_no,
          contact_name = EXCLUDED.contact_name,
          contact_phone = EXCLUDED.contact_phone,
          contact_email = EXCLUDED.contact_email
      `;
    } else {
      // Individual
      await sql`
        INSERT INTO customer_individual (
          customer_id, first_name, last_name, phone
        ) VALUES (
          ${customerId}, 
          ${body.first_name}, 
          ${body.last_name}, 
          ${body.phone || null}
        )
        ON CONFLICT (customer_id) DO UPDATE SET
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          phone = EXCLUDED.phone
      `;
    }

    // Returnăm ID-ul pentru a-l folosi în UI (ex: selectare automată în ofertă)
    return NextResponse.json({ ok: true, customerId });

  } catch (err: any) {
    console.error("CREATE Customer Error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}