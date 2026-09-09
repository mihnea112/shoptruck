import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/server";
import PartnersUI from "./ui";

export default async function ParteneriPage() {
  const me = await getSessionUser();
  if (!me) redirect("/login?next=/admin/parteneri");
  if (me.kind !== "staff") redirect("/");

  const isAdmin = me.roles?.includes("admin") || me.roles?.includes("ADMIN");
  const isSales = me.roles?.includes("sales") || me.roles?.includes("SALES");
  if (!isAdmin && !isSales) redirect("/admin");

  return <PartnersUI />;
}
