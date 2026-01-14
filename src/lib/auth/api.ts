// src/lib/auth/api.ts
import { getSessionUser } from "@/lib/auth/server";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type StaffRole = "ADMIN" | "SALES_REP" | "ACCOUNTING" | "WAREHOUSE";

function normalizeRoles(roles: unknown): string[] {
  return Array.isArray(roles) ? roles.map(String) : [];
}

/** Base: require any logged-in user (staff or customer). */
export async function requireAuth(_req: Request) {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "Neautorizat.");
  return { ...user, roles: normalizeRoles((user as any).roles) };
}

/** Require staff login (any staff role, or even no roles if you want). */
export async function requireAnyStaff(_req: Request) {
  const user = await requireAuth(_req);
  if (user.kind !== "staff") throw new ApiError(403, "Acces interzis.");
  return user;
}

/** Require staff with at least one allowed role. */
export async function requireStaff(
  req: Request,
  roles: StaffRole[] = ["ADMIN", "SALES_REP"]
) {
  const user = await requireAnyStaff(req);
  const r = normalizeRoles((user as any).roles);
  const ok = roles.length === 0 ? true : roles.some((x) => r.includes(x));
  if (!ok) throw new ApiError(403, "Acces interzis.");
  return { ...user, roles: r };
}

/** Require admin-only. */
export async function requireAdmin(req: Request) {
  return requireStaff(req, ["ADMIN"]);
}

/** Optional: require customer login (portal). */
export async function requireCustomer(_req: Request) {
  const user = await requireAuth(_req);
  if (user.kind !== "customer") throw new ApiError(403, "Acces interzis.");
  return user;
}
