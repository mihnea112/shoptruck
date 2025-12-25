import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/server";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/account");
  if (user.kind !== "customer") redirect("/");
  return <>{children}</>;
}