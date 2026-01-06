// src/lib/auth/api.ts
import { getSessionUser } from "@/lib/auth/server";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireAdmin(_req: Request) {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "Neautorizat.");
  if (user.kind !== "staff") throw new ApiError(403, "Acces interzis.");
  if (!user.roles.includes("ADMIN")) throw new ApiError(403, "Acces interzis.");
  return user;
}

export async function requireStaff(
  _req: Request,
  roles: Array<"ADMIN" | "SALES_REP"> = ["ADMIN", "SALES_REP"]
) {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "Neautorizat.");
  if (user.kind !== "staff") throw new ApiError(403, "Acces interzis.");
  const ok = roles.some((r) => user.roles.includes(r));
  if (!ok) throw new ApiError(403, "Acces interzis.");
  return user;
}