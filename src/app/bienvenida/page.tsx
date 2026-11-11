import type { Metadata } from "next";
import { LandingPage } from "@/features/landing/landing-page";

// Portada de holacitaya.app (app/page.tsx la muestra en el dominio público).
export const metadata: Metadata = {
  title: "Citaya · Tu recepcionista de WhatsApp para peluquerías y barberías",
  description:
    "Citaya contesta a tus clientes por WhatsApp al momento y les da cita en tu agenda. Página de reservas, recordatorios y panel en el móvil. 14 días gratis.",
  openGraph: {
    title: "Citaya · Tu recepcionista de WhatsApp",
    description:
      "Contesta a tus clientes y les da cita mientras tú trabajas. Para peluquerías y barberías.",
    url: "https://holacitaya.app",
    siteName: "Citaya",
    locale: "es_ES",
    type: "website",
  },
};

export default function WelcomePage() {
  return <LandingPage />;
}
