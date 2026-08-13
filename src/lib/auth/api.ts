// src/lib/auth/api.ts
import { getSessionUser } from "@/lib/auth/server";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Staff roles:
 *   admin      – full access to everything
 *   sales      – offers, orders, invoices, products (view), categories
 *   marketing  – email campaigns, email contacts
 *   warehouse  – warehouses, stock, transfers, stock movements, receptions, suppliers, PDF goods intake
 */
export type StaffRole = "admin" | "sales" | "marketing" | "warehouse" | (string & {});

export const ALL_STAFF_ROLES: StaffRole[] = ["admin", "sales", "marketing", "warehouse"];

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
  roles: StaffRole[] = ["admin", "sales"]
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

/** Require sales role (or admin). */
export async function requireSales(req: Request) {
  return requireStaff(req, ["admin", "sales"]);
}

/** Require marketing role (or admin). */
export async function requireMarketing(req: Request) {
  return requireStaff(req, ["admin", "marketing"]);
}

/** Require warehouse role (or admin). */
export async function requireWarehouse(req: Request) {
  return requireStaff(req, ["admin", "warehouse"]);
}

/** Optional: require customer login. */
export async function requireCustomer(req: Request) {
  const user = await requireAuth(req);
  if (user.kind !== "customer") throw new ApiError(403, "Acces interzis.");
  return user;
}