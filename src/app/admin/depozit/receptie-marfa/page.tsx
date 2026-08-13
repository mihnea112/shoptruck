// src/app/admin/depozit/receptie-marfa/page.tsx
import { redirect } from "next/navigation";
import { getSessionUser, hasAnyRole } from "@/lib/auth/server";
import { ReceptieMarfaClient } from "./ui";

export const metadata = {
  title: "Recepție marfă – ShopTruck Admin",
};

export default async function ReceptieMarfaPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin/depozit/receptie-marfa");
  if (!hasAnyRole(user, ["admin", "warehouse", "warehouse_op"]))
    redirect("/admin");

  return <ReceptieMarfaClient />;
}
