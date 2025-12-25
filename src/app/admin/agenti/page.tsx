import Link from "next/link";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/server";

type PageProps = {
  searchParams?:
    | Promise<{ ok?: string; error?: string }>
    | { ok?: string; error?: string };
};

async function deleteAgentAction(formData: FormData) {
  "use server";

  const me = await getSessionUser();
  if (!me) redirect("/login?next=/admin/agenti");
  if (me.kind !== "staff" || !me.roles.includes("ADMIN")) redirect("/admin");

  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) redirect(`/admin/agenti?error=${encodeURIComponent("Lipsește userId.")}`);

  if ((me as any).id && userId === (me as any).id) {
    redirect(`/admin/agenti?error=${encodeURIComponent("Nu îți poți șterge propriul cont.")}`);
  }

  // IMPORTANT: redirect() must NOT be called inside try/catch (it throws NEXT_REDIRECT).
  let nextUrl = `/admin/agenti?ok=${encodeURIComponent("Agent șters cu succes.")}`;

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
      SELECT (SELECT id FROM target)   AS target_id,
             (SELECT id FROM del_user) AS user_id
    `;

    const targetId = (rows as any[])?.[0]?.target_id as string | undefined;
    const deletedId = (rows as any[])?.[0]?.user_id as string | undefined;

    // Idempotent: if target not found, check if already deleted => still success.
    if (!targetId) {
      const stillThere = await sql`SELECT 1 FROM app_user WHERE id = ${userId} LIMIT 1`;
      const exists = Array.isArray(stillThere) && stillThere.length > 0;

      if (exists) {
        nextUrl = `/admin/agenti?error=${encodeURIComponent(
          "Agentul nu a fost găsit (sau este administrator)."
        )}`;
      }
    } else if (!deletedId) {
      nextUrl = `/admin/agenti?error=${encodeURIComponent(
        "Ștergerea a fost blocată de baza de date."
      )}`;
    }
  } catch (e: any) {
    const msg =
      process.env.NODE_ENV !== "production"
        ? (e?.detail || e?.message || "Eroare la ștergere.")
        : "Eroare la ștergere.";
    nextUrl = `/admin/agenti?error=${encodeURIComponent(msg)}`;
  }

  redirect(nextUrl);
}

export default async function AgentiPage({ searchParams }: PageProps) {
  const me = await getSessionUser();
  if (!me) redirect("/login?next=/admin/agenti");
  if (me.kind !== "staff" || !me.roles.includes("ADMIN")) redirect("/admin");

  const rows = await sql`
    SELECT u.id, u.email
    FROM app_user u
    JOIN user_role ur ON ur.user_id = u.id
    JOIN role r ON r.id = ur.role_id
    WHERE u.kind = 'staff' AND r.key = 'SALES_REP'
    ORDER BY u.email
    LIMIT 200
  `;
  const agents = rows as { id: string; email: string }[];

  // Promise-safe searchParams
  const sp = await Promise.resolve(searchParams as any);

  const safeDecode = (v?: string) => {
    if (!v) return null;
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  };

  const error = safeDecode(sp?.error);
  const ok = safeDecode(sp?.ok);

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Agenți de vânzări</h1>
          <p className="mt-2 text-sm text-slate-600">
            Creează și gestionează conturile agenților.
          </p>
        </div>

        <Link
          href="/admin/agenti/nou"
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition"
        >
          Adaugă agent
        </Link>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {ok ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {ok}
        </div>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-700">Nume</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Email</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {agents.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-slate-600" colSpan={3}>
                  Nu există agenți.
                </td>
              </tr>
            ) : (
              agents.map((a) => (
                <tr key={a.id} className="border-t border-slate-200">
                  <td className="px-4 py-3 text-slate-900">{a.email.split("@")[0] || "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{a.email}</td>
                  <td className="px-4 py-3">
                    <form action={deleteAgentAction}>
                      <input type="hidden" name="userId" value={a.id} />
                      <button
                        type="submit"
                        className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
                      >
                        Șterge
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}