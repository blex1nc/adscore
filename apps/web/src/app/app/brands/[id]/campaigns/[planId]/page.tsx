import { redirect } from "next/navigation";

// Plan segmentinin kendi ekranı yok; plan detayı kurulum kitidir.
// Elle yazılan /campaigns/<planId> adresi 404 vermek yerine kite yönlenir.
export default async function PlanIndexPage({
  params,
}: {
  params: Promise<{ id: string; planId: string }>;
}) {
  const { id, planId } = await params;
  redirect(`/app/brands/${id}/campaigns/${planId}/kit`);
}
