import { redirect } from "next/navigation";
import argon2 from "argon2";
import { sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/server";

type PageProps = {
  searchParams?: Promise<{ error?: string; ok?: string }> | { error?: string; ok?: string };
};

async function createAgent(formData: FormData) {
  "use server";

  const me = await getSessionUser();
  if (!me) redirect("/login?next=/admin/agenti/nou");
  if (me.kind !== "staff" || !me.roles.includes("ADMIN")) redirect("/admin");

  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !email.includes("@")) {
    redirect(`/admin/agenti/nou?error=${encodeURIComponent("Email invalid.")}`);
  }
  if (!password || password.length < 8) {
    redirect(
      `/admin/agenti/nou?error=${encodeURIComponent(
        "Parola trebuie să aibă minim 8 caractere."
      )}`
    );
  }

  const exists = await sql`SELECT 1 FROM app_user WHERE email = ${email} LIMIT 1`;
  if (Array.isArray(exists) && exists.length > 0) {
    redirect(
      `/admin/agenti/nou?error=${encodeURIComponent(
        "Există deja un cont cu acest email."
      )}`
    );
  }

  const passwordHash = await argon2.hash(password);

  const rows = await sql`
    WITH new_user AS (
      INSERT INTO app_user (email, password_hash, kind, is_active)
      VALUES (${email}, ${passwordHash}, 'staff', true)
      RETURNING id
    ),
    role_link AS (
      INSERT INTO user_role (user_id, role_id)
      SELECT nu.id, r.id
      FROM new_user nu
      JOIN role r ON r.key = 'SALES_REP'
      ON CONFLICT DO NOTHING
      RETURNING user_id
    )
    SELECT (SELECT id FROM new_user) AS user_id
  `;

  const userId = (rows as any[])?.[0]?.user_id as string | undefined;
  if (!userId) {
    redirect(
      `/admin/agenti/nou?error=${encodeURIComponent("Eroare la creare utilizator.")}`
    );
  }

  // NOTE: fullName is currently not persisted (no staff/profile table in DB).
  // We still accept it in the form so UX stays consistent.
  void fullName;

  redirect(`/admin/agenti?ok=${encodeURIComponent("Agent creat cu succes.")}`);
}

function safeDecode(v?: string) {
  if (!v) return null;
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

export default async function AgentNouPage({ searchParams }: PageProps) {
  const me = await getSessionUser();
  if (!me) redirect("/login?next=/admin/agenti/nou");
  if (me.kind !== "staff" || !me.roles.includes("ADMIN")) redirect("/admin");

  const sp = await Promise.resolve(searchParams as any);
  const error = safeDecode(sp?.error);
  const ok = safeDecode(sp?.ok);

  return (
    <div className="max-w-xl">
      <h1 className="text-lg font-semibold text-slate-900">Adaugă agent de vânzări</h1>
      <p className="mt-2 text-sm text-slate-600">
        Creezi un cont de tip personal (staff) cu rol „Agent vânzări”. Doar
        administratorii au acces la această pagină.
      </p>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <form action={createAgent} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">Nume (opțional)</label>
            <input
              name="fullName"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#feab1f]"
            />
            <p className="text-xs text-slate-500">
              Notă: în această versiune numele nu este salvat încă în baza de date.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">Email</label>
            <input
              name="email"
              type="email"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#feab1f]"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">Parolă temporară</label>
            <input
              name="password"
              type="password"
              placeholder="minim 8 caractere"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#feab1f]"
              required
            />
            <p className="text-xs text-slate-500">
              Recomandat: agentul schimbă parola la prima autentificare (pas următor).
            </p>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {ok ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {ok}
            </div>
          ) : null}

          <button
            type="submit"
            className="w-full rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Creează agent
          </button>
        </form>
      </div>
    </div>
  );
}