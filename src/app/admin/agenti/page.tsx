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

  const meId = String((me as any)?.id ?? (me as any)?.userId ?? "").trim();
  if (meId && userId === meId) {
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

async function updateAgentAccessAction(formData: FormData) {
  "use server";

  const me = await getSessionUser();
  if (!me) redirect("/login?next=/admin/agenti");
  if (me.kind !== "staff" || !me.roles.includes("ADMIN")) redirect("/admin");

  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) redirect(`/admin/agenti?error=${encodeURIComponent("Lipsește userId.")}`);

  const roles = (formData.getAll("roles") as string[])
    .map((x) => String(x).trim())
    .filter(Boolean);

  const meId = String((me as any)?.id ?? (me as any)?.userId ?? "").trim();

  // Check if permissions tables exist; if not, we ignore permissions completely.
  const permSupportRows = (await sql`
    SELECT
      to_regclass('public.user_permission') AS user_permission_tbl,
      to_regclass('public.permission') AS permission_tbl
  `) as any[];
  const permsSupported = !!(
    permSupportRows?.[0]?.user_permission_tbl && permSupportRows?.[0]?.permission_tbl
  );

  const perms = permsSupported
    ? (formData.getAll("permissions") as string[])
        .map((x) => String(x).trim())
        .filter(Boolean)
    : [];

  // Prevent locking yourself out
  if (meId && userId === meId && !roles.includes("ADMIN")) {
    redirect(
      `/admin/agenti?error=${encodeURIComponent(
        "Nu îți poți scoate propriul rol ADMIN."
      )}`
    );
  }

  let nextUrl = `/admin/agenti?ok=${encodeURIComponent("Roluri/permisiuni salvate.")}`;

  try {
    if (permsSupported) {
      await sql`
        WITH target AS (
          SELECT id
          FROM app_user
          WHERE id = ${userId}
            AND kind = 'staff'
          LIMIT 1
        ),
        del_roles AS (
          DELETE FROM user_role ur
          WHERE ur.user_id = (SELECT id FROM target)
          RETURNING 1
        ),
        ins_roles AS (
          INSERT INTO user_role (user_id, role_id)
          SELECT (SELECT id FROM target), r.id
          FROM role r
          WHERE r.key = ANY(${roles}::text[])
          ON CONFLICT DO NOTHING
          RETURNING 1
        ),
        del_perms AS (
          DELETE FROM user_permission up
          WHERE up.user_id = (SELECT id FROM target)
          RETURNING 1
        ),
        ins_perms AS (
          INSERT INTO user_permission (user_id, permission_id)
          SELECT (SELECT id FROM target), p.id
          FROM permission p
          WHERE p.key = ANY(${perms}::text[])
          ON CONFLICT DO NOTHING
          RETURNING 1
        )
        SELECT (SELECT id FROM target) AS target_id
      `;
    } else {
      await sql`
        WITH target AS (
          SELECT id
          FROM app_user
          WHERE id = ${userId}
            AND kind = 'staff'
          LIMIT 1
        ),
        del_roles AS (
          DELETE FROM user_role ur
          WHERE ur.user_id = (SELECT id FROM target)
          RETURNING 1
        ),
        ins_roles AS (
          INSERT INTO user_role (user_id, role_id)
          SELECT (SELECT id FROM target), r.id
          FROM role r
          WHERE r.key = ANY(${roles}::text[])
          ON CONFLICT DO NOTHING
          RETURNING 1
        )
        SELECT (SELECT id FROM target) AS target_id
      `;
    }

    const stillThere = await sql`SELECT 1 FROM app_user WHERE id = ${userId} AND kind='staff' LIMIT 1`;
    const exists = Array.isArray(stillThere) && stillThere.length > 0;
    if (!exists) {
      nextUrl = `/admin/agenti?error=${encodeURIComponent("Agent inexistent.")}`;
    }
  } catch (e: any) {
    const msg =
      process.env.NODE_ENV !== "production"
        ? e?.detail || e?.message || "Eroare la salvare."
        : "Eroare la salvare.";
    nextUrl = `/admin/agenti?error=${encodeURIComponent(msg)}`;
  }

  redirect(nextUrl);
}

export default async function AgentiPage({ searchParams }: PageProps) {
  const me = await getSessionUser();
  if (!me) redirect("/login?next=/admin/agenti");
  if (me.kind !== "staff" || !me.roles.includes("ADMIN")) redirect("/admin");

  const permSupportRows = (await sql`
    SELECT
      to_regclass('public.user_permission') AS user_permission_tbl,
      to_regclass('public.permission') AS permission_tbl
  `) as any[];
  const permsSupported = !!(
    permSupportRows?.[0]?.user_permission_tbl && permSupportRows?.[0]?.permission_tbl
  );

  const usersRows = permsSupported
    ? await sql`
        WITH roles AS (
          SELECT u.id AS user_id, COALESCE(array_agg(DISTINCT r.key ORDER BY r.key), ARRAY[]::text[]) AS roles
          FROM app_user u
          LEFT JOIN user_role ur ON ur.user_id = u.id
          LEFT JOIN role r ON r.id = ur.role_id
          WHERE u.kind = 'staff'
          GROUP BY u.id
        ),
        perms AS (
          SELECT u.id AS user_id, COALESCE(array_agg(DISTINCT p.key ORDER BY p.key), ARRAY[]::text[]) AS permissions
          FROM app_user u
          LEFT JOIN user_permission up ON up.user_id = u.id
          LEFT JOIN permission p ON p.id = up.permission_id
          WHERE u.kind = 'staff'
          GROUP BY u.id
        )
        SELECT u.id, u.email,
               COALESCE(r.roles, ARRAY[]::text[]) AS roles,
               COALESCE(pp.permissions, ARRAY[]::text[]) AS permissions
        FROM app_user u
        LEFT JOIN roles r ON r.user_id = u.id
        LEFT JOIN perms pp ON pp.user_id = u.id
        WHERE u.kind = 'staff'
          AND NOT EXISTS (
            SELECT 1
            FROM user_role urx
            JOIN role rx ON rx.id = urx.role_id
            WHERE urx.user_id = u.id
              AND rx.key = 'ADMIN'
          )
        ORDER BY u.email
        LIMIT 200
      `
    : await sql`
        WITH roles AS (
          SELECT u.id AS user_id, COALESCE(array_agg(DISTINCT r.key ORDER BY r.key), ARRAY[]::text[]) AS roles
          FROM app_user u
          LEFT JOIN user_role ur ON ur.user_id = u.id
          LEFT JOIN role r ON r.id = ur.role_id
          WHERE u.kind = 'staff'
          GROUP BY u.id
        )
        SELECT u.id, u.email,
               COALESCE(r.roles, ARRAY[]::text[]) AS roles,
               ARRAY[]::text[] AS permissions
        FROM app_user u
        LEFT JOIN roles r ON r.user_id = u.id
        WHERE u.kind = 'staff'
          AND NOT EXISTS (
            SELECT 1
            FROM user_role urx
            JOIN role rx ON rx.id = urx.role_id
            WHERE urx.user_id = u.id
              AND rx.key = 'ADMIN'
          )
        ORDER BY u.email
        LIMIT 200
      `;

  const roleRows = await sql`SELECT key, COALESCE(name, key) AS name FROM role ORDER BY key`;
  const permRows = permsSupported
    ? await sql`SELECT key, COALESCE(name, key) AS name FROM permission ORDER BY key`
    : [];

  const agents = usersRows as { id: string; email: string; roles: string[]; permissions: string[] }[];
  const allRoles = roleRows as { key: string; name: string }[];
  const allPerms = permRows as { key: string; name: string }[];

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
              <th className="px-4 py-3 font-semibold text-slate-700">Roluri & permisiuni</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {agents.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-slate-600" colSpan={4}>
                  Nu există agenți.
                </td>
              </tr>
            ) : (
              agents.map((a) => (
                <tr key={a.id} className="border-t border-slate-200 align-top">
                  <td className="px-4 py-3 text-slate-900">
                    {a.email.split("@")[0] || "—"}
                  </td>

                  <td className="px-4 py-3 text-slate-700">{a.email}</td>

                  <td className="px-4 py-3">
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs font-semibold text-slate-600">Curent</div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {(a.roles?.length ? a.roles : ["— fără roluri —"]).map((r, idx) => (
                            <span
                              key={`r-${idx}`}
                              className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
                            >
                              {r}
                            </span>
                          ))}
                          {(a.permissions?.length ? a.permissions : []).map((p, idx) => (
                            <span
                              key={`p-${idx}`}
                              className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="text-xs font-semibold text-slate-700">Setează roluri & permisiuni</div>

                        <form action={updateAgentAccessAction} className="mt-3 space-y-3">
                          <input type="hidden" name="userId" value={a.id} />

                          <div>
                            <div className="text-[11px] font-semibold text-slate-600">Roluri</div>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              {allRoles.map((r) => {
                                const checked = Array.isArray(a.roles) && a.roles.includes(r.key);
                                return (
                                  <label key={r.key} className="flex items-center gap-2 text-xs text-slate-700">
                                    <input
                                      type="checkbox"
                                      name="roles"
                                      value={r.key}
                                      defaultChecked={checked}
                                    />
                                    <span>{r.name}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>

                          {permsSupported ? (
                            <div>
                              <div className="text-[11px] font-semibold text-slate-600">Permisiuni</div>
                              <div className="mt-2 grid grid-cols-2 gap-2">
                                {allPerms.map((p) => {
                                  const checked = Array.isArray(a.permissions) && a.permissions.includes(p.key);
                                  return (
                                    <label key={p.key} className="flex items-center gap-2 text-xs text-slate-700">
                                      <input
                                        type="checkbox"
                                        name="permissions"
                                        value={p.key}
                                        defaultChecked={checked}
                                      />
                                      <span>{p.name}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                              Permisiunile nu sunt configurate în DB (lipsește tabelul <span className="font-mono">user_permission</span> sau <span className="font-mono">permission</span>). Se pot seta doar rolurile.
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                            <button
                              type="submit"
                              className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
                            >
                              Salvează acces
                            </button>
                            <div className="text-[11px] text-slate-500">Salvarea rescrie setările (roluri/permisiuni) pentru acest utilizator.</div>
                          </div>
                        </form>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <form action={deleteAgentAction}>
                        <input type="hidden" name="userId" value={a.id} />
                        <button
                          type="submit"
                          className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
                        >
                          Șterge
                        </button>
                      </form>
                    </div>
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