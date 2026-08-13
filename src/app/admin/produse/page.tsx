import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/server";
import ProductsAdmin from "./ui";

function normalizeRoles(input: any): string[] {
  if (!input) return [];
  if (Array.isArray(input)) return input.filter(Boolean).map(String);
  if (typeof input === "string") {
    // support "ADMIN,SALES_REP" or "ADMIN SALES_REP"
    return input
      .split(/[, ]+/g)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export default async function ProdusePage() {
  const me = await getSessionUser();
  if (!me) redirect("/login?next=/admin/produse");
  if (me.kind !== "staff") redirect("/");

  const roles = normalizeRoles((me as any).roles);

  const isAdmin = me.roles.includes("admin");
  const canView = isAdmin || me.roles.includes("sales_rep") || me.roles.includes("sales") || me.roles.includes("warehouse") || me.roles.includes("warehouse_op");

  if (!canView) redirect("/");

  return <ProductsAdmin isAdmin={isAdmin} />;
}
