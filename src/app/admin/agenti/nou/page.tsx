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

  const newRoleKeyRaw = String(formData.get("newRoleKey") ?? "").trim();
  const newRoleKey = newRoleKeyRaw
    ? newRoleKeyRaw
        .toUpperCase()
        .replace(/\s+/g, "_")
        .replace(/[^A-Z0-9_]/g, "")
    : "";

  const roleKeys = (formData.getAll("roleKey") as string[])
    .map((x) => String(x || "").trim())
    .filter(Boolean);

  const permissionKeys = (formData.getAll("permissionKey") as string[])
    .map((x) => String(x || "").trim())
    .filter(Boolean);

  // Roles are optional in UI. If none selected, default to SALES_REP.
  // IMPORTANT: if the role row doesn't exist yet, we attempt to create it (best-effort)
  // so new users never end up with 0 roles.
  const DEFAULT_ROLE = "SALES_REP";

  const effectiveRoleKeys: string[] = roleKeys.length > 0 ? [...roleKeys] : [DEFAULT_ROLE];

  // Optionally create a new role (best-effort). If the role table has extra NOT NULL columns,
  // this insert may fail; we ignore and continue so the user can still be created.
  if (newRoleKey) {
    try {
      await sql`
        INSERT INTO role (key)
        VALUES (${newRoleKey})
        ON CONFLICT DO NOTHING
      `;
    } catch {
      // ignore (schema may require additional fields)
    }

    if (!effectiveRoleKeys.includes(newRoleKey)) {
      effectiveRoleKeys.push(newRoleKey);
    }
  }

  // Ensure all roles we intend to assign exist (best-effort).
  for (const rk of effectiveRoleKeys) {
    try {
      await sql`
        INSERT INTO role (key)
        VALUES (${rk})
        ON CONFLICT DO NOTHING
      `;
    } catch {
      // ignore
    }
  }

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

  const created = await sql`
    INSERT INTO app_user (email, password_hash, kind, is_active)
    VALUES (${email}, ${passwordHash}, 'staff', true)
    RETURNING id
  `;

  const userId = (created as any[])?.[0]?.id as string | undefined;
  if (!userId) {
    redirect(
      `/admin/agenti/nou?error=${encodeURIComponent("Eroare la creare utilizator.")}`
    );
  }

  // Assign selected roles
  for (const rk of effectiveRoleKeys) {
    await sql`
      INSERT INTO user_role (user_id, role_id)
      SELECT ${userId}::uuid, r.id
      FROM role r
      WHERE r.key = ${rk}
      ON CONFLICT DO NOTHING
    `;
  }

  // Safety: if, for any reason, no role was assigned (e.g., role schema prevented inserts),
  // try to assign DEFAULT_ROLE so the staff user can access staff pages.
  const assigned = await sql`
    SELECT 1
    FROM user_role ur
    WHERE ur.user_id = ${userId}::uuid
    LIMIT 1
  `;

  if (!Array.isArray(assigned) || assigned.length === 0) {
    try {
      await sql`
        INSERT INTO role (key)
        VALUES (${DEFAULT_ROLE})
        ON CONFLICT DO NOTHING
      `;
    } catch {
      // ignore
    }

    await sql`
      INSERT INTO user_role (user_id, role_id)
      SELECT ${userId}::uuid, r.id
      FROM role r
      WHERE r.key = ${DEFAULT_ROLE}
      ON CONFLICT DO NOTHING
    `;
  }

  // Assign selected permissions ONLY if tables exist
  const permTables = await sql`
    SELECT
      to_regclass('public.permission') AS permission_table,
      to_regclass('public.user_permission') AS user_permission_table
  `;
  const hasPermTables =
    Array.isArray(permTables) &&
    permTables.length > 0 &&
    !!(permTables as any[])[0]?.permission_table &&
    !!(permTables as any[])[0]?.user_permission_table;

  if (hasPermTables && permissionKeys.length > 0) {
    for (const pk of permissionKeys) {
      await sql`
        INSERT INTO user_permission (user_id, permission_id)
        SELECT ${userId}::uuid, p.id
        FROM permission p
        WHERE p.key = ${pk}
        ON CONFLICT DO NOTHING
      `;
    }
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

  const roleRows = (await sql`SELECT key FROM role ORDER BY key`) as any[];
  const roles = (roleRows || []).map((r) => String(r.key));

  const permTables = await sql`
    SELECT
      to_regclass('public.permission') AS permission_table,
      to_regclass('public.user_permission') AS user_permission_table
  `;
  const hasPermTables =
    Array.isArray(permTables) &&
    permTables.length > 0 &&
    !!(permTables as any[])[0]?.permission_table &&
    !!(permTables as any[])[0]?.user_permission_table;

  const permRows = hasPermTables
    ? (((await sql`SELECT key FROM permission ORDER BY key`) as any[]) || [])
    : [];
  const permissions = permRows.map((p) => String(p.key));

  return (
    <div className="max-w-xl">
      <h1 className="text-lg font-semibold text-slate-900">Adaugă agent de vânzări</h1>
      <p className="mt-2 text-sm text-slate-600">
        Creezi un cont de tip personal (staff) și poți alege rolurile. Doar
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

          {/* Roles section */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-600">Roluri</div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {roles.length === 0 ? (
                  <div className="text-xs text-slate-500">Nu există roluri definite în tabela <code className="font-mono">role</code>.</div>
                ) : (
                  roles.map((rk) => (
                    <label key={rk} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        name="roleKey"
                        value={rk}
                        defaultChecked={rk === "SALES_REP"}
                      />
                      <span className="font-medium">{rk.replaceAll("_", " ")}</span>
                    </label>
                  ))
                )}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Rolurile sunt opționale. Dacă nu selectezi nimic, noul agent primește automat rolul SALES_REP. Dacă rolul nu există încă în baza de date, îl creăm automat (best-effort).
              </div>
            </div>
          </div>

          {/* New role section (optional) */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-600">Rol nou (opțional)</div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <label className="block text-xs font-semibold text-slate-600">Cheie rol (ROLE_KEY)</label>
              <input
                name="newRoleKey"
                placeholder="ex: SERVICE_MANAGER"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#feab1f]"
              />
              <div className="mt-2 text-xs text-slate-500">
                Dacă completezi, încercăm să creăm rolul în tabela <code className="font-mono">role</code> și îl atribuim automat utilizatorului.
                Dacă schema DB cere câmpuri suplimentare, crearea poate fi ignorată fără să blocheze crearea utilizatorului.
              </div>
            </div>
          </div>

          {/* Permissions section */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-600">Permisiuni (opțional)</div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {!hasPermTables ? (
                <div className="text-xs text-slate-500">
                  Modulul de permisiuni nu este activ (lipsește tabela <code className="font-mono">permission</code> sau <code className="font-mono">user_permission</code>). Poți seta doar roluri.
                </div>
              ) : permissions.length === 0 ? (
                <div className="text-xs text-slate-500">Nu există permisiuni definite în tabela <code className="font-mono">permission</code>.</div>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {permissions.map((pk) => (
                    <label key={pk} className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" name="permissionKey" value={pk} />
                      <span className="font-medium">{pk.replaceAll("_", " ")}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
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