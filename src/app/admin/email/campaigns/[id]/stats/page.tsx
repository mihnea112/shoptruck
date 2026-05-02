import StatsUI from "./ui";

export default async function StatsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StatsUI campaignId={id} />;
}
