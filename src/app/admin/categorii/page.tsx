import { redirect } from "next/navigation";
import CategoriesAdmin from "./ui";
import { getSessionUser } from "@/lib/auth/server";

export default async function CategoriiPage() {
  const me = await getSessionUser();
  if (!me) redirect("/login?next=/admin/categorii");
  if (me.kind !== "staff") redirect("/");

  const isAdmin = me.roles.includes("ADMIN");
  const canView = isAdmin || me.roles.includes("SALES_REP");
  if (!canView) redirect("/");

  return <CategoriesAdmin isAdmin={isAdmin} />;
}