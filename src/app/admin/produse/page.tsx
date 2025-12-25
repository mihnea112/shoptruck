import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/server";
import ProductsAdmin from "./ui";

export default async function ProdusePage() {
  const me = await getSessionUser();
  if (!me) redirect("/login?next=/admin/produse");
  if (me.kind !== "staff") redirect("/");

  const isAdmin = me.roles.includes("ADMIN");
  const canView = isAdmin || me.roles.includes("SALES_REP");
  if (!canView) redirect("/");

  return <ProductsAdmin isAdmin={isAdmin} />;
}