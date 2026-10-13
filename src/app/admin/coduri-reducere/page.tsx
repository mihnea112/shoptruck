import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/server";
import DiscountCodesAdmin from "./ui";

export default async function CoduriReducerePage() {
  const me = await getSessionUser();
  if (!me) redirect("/login?next=/admin/coduri-reducere");
  if (me.kind !== "staff") redirect("/");
  if (!me.roles?.includes("admin")) redirect("/");
  return <DiscountCodesAdmin />;
}
