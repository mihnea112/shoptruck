// src/app/admin/reduceri/page.tsx
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/server";
import DiscountsAdmin from "./ui";

export default async function ReduceriPage() {
  const me = await getSessionUser();
  if (!me) redirect("/login?next=/admin/reduceri");
  if (me.kind !== "staff") redirect("/");

  const isAdmin = me.roles?.includes("admin");
  if (!isAdmin) redirect("/");

  return <DiscountsAdmin />;
}
