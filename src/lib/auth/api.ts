// src/lib/auth/api.ts
import { getSessionUser } from "@/lib/auth/server";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type StaffRole = string;

function normalizeRoles(roles: unknown): string[] {
  if (!roles) return [];

  if (Array.isArray(roles)) {
    return roles
      .map((r) => String(r ?? "").trim().toLowerCase())
      .filter(Boolean);
  }

  if (typeof roles === "string") {
    return roles
      .split(/[\s,;|]+/g)
      .map((r) => r.trim().toLowerCase())
      .filter(Boolean);
  }

  return [];
}

/** Base: require any logged-in user (staff or customer). */
export async function requireAuth(_req: Request) {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "Neautorizat.");
  return { ...user, roles: normalizeRoles((user as any).roles) };
}

/** Require staff login. */
export async function requireAnyStaff(req: Request) {
  const user = await requireAuth(req);
  if (user.kind !== "staff") throw new ApiError(403, "Acces interzis.");
  return user;
}

/** Require staff with at least one allowed role. */
export async function requireStaff(
  req: Request,
  roles: StaffRole[] = ["admin", "sales_rep"]
) {
  const user = await requireAnyStaff(req);
  const r = normalizeRoles((user as any).roles);
  const wanted = (roles || []).map((x) => String(x ?? "").trim().toLowerCase()).filter(Boolean);
  const ok = wanted.length === 0 ? true : wanted.some((x) => r.includes(x));
  if (!ok) throw new ApiError(403, "Acces interzis.");
  return { ...user, roles: r };
}

/** Require admin-only. */
export async function requireAdmin(req: Request) {
  return requireStaff(req, ["admin"]);
}

/** Optional: require customer login. */
export async function requireCustomer(req: Request) {
  const user = await requireAuth(req);
  if (user.kind !== "customer") throw new ApiError(403, "Acces interzis.");
  return user;
}