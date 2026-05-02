import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/server";
import CampaignEditorUI from "./ui";

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user || user.kind !== "staff") {
    redirect("/login?next=/admin/email/campaigns");
  }

  return <CampaignEditorUI campaignId={id} isNew={false} />;
}
