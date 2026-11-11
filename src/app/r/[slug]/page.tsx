import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicBusiness } from "@/features/booking/services/public-booking";
import { PublicBookingFlow } from "@/features/booking/components/public-booking-flow";

// Siempre fresco: los huecos cambian constantemente.
export const dynamic = "force-dynamic";

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const business = await getPublicBusiness(slug);
  if (!business) return { title: "Reservas · Citaya" };
  return {
    title: `Reservar en ${business.name}`,
    description: business.intro ?? `Reserva tu cita en ${business.name} en un minuto.`,
  };
}

export default async function PublicBookingPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const business = await getPublicBusiness(slug);
  if (!business) notFound();
  return <PublicBookingFlow business={business} />;
}
