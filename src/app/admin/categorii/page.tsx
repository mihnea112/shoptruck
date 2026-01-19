import { redirect } from "next/navigation";
import CategoriesAdmin from "./ui";
import { getSessionUser } from "@/lib/auth/server";

function normalizeRoles(input: unknown): string[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input
      .map((r) => String(r ?? "").trim())
      .filter(Boolean)
      .map((r) => r.toLowerCase());
  }
  if (typeof input === "string") {
    return input
      .split(/[\s,;|]+/g)
      .map((r) => r.trim())
      .filter(Boolean)
      .map((r) => r.toLowerCase());
  }
  return [];
}

export default async function CategoriiPage() {
  const me = await getSessionUser();
  if (!me) redirect("/login?next=/admin/categorii");

  // Backward-compatible guard: older sessions may include `kind`, newer ones may not.
  const kind = (me as any).kind as string | undefined;
  if (kind && kind !== "staff") redirect("/");

  const roles = normalizeRoles((me as any).roles);

  // New DB convention: roles are stored as slugs (e.g. "admin", "sales_rep").
  const isAdmin = roles.includes("admin");
  const canView =
    isAdmin ||
    roles.includes("sales_rep") ||
    roles.includes("sales-rep") ||
    roles.includes("salesrep") ||
    roles.includes("sales");

  if (!canView) redirect("/");

  return <CategoriesAdmin isAdmin={isAdmin} />;
}