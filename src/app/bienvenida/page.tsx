import type { Metadata } from "next";
import { CalendarCheck, MessageCircle } from "lucide-react";

// Portada provisional de holacitaya.app (la web completa llega en la fase 3).
export const metadata: Metadata = {
  title: "Citaya · Tu recepcionista de WhatsApp",
  description:
    "Citaya contesta a tus clientes por WhatsApp y les da cita automáticamente. Para peluquerías, barberías y negocios con cita previa.",
};

const PANEL_URL = process.env.PANEL_URL ?? "https://panel.holacitaya.app";
const DEMO_WHATSAPP = process.env.NEXT_PUBLIC_DEMO_WHATSAPP ?? "34613086985";

export default function WelcomePage() {
  const wa = `https://wa.me/${DEMO_WHATSAPP}?text=${encodeURIComponent("Hola, quiero saber más de Citaya")}`;
  return (
    <main className="public-light flex min-h-screen flex-col bg-background">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5">
        <span className="font-display text-xl font-semibold text-foreground">Citaya</span>
        <a
          href={`${PANEL_URL}/login`}
          className="rounded-full border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
        >
          Acceso negocios
        </a>
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <h1 className="font-display text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
          Tu recepcionista de WhatsApp
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          Contesta a tus clientes y les da cita mientras tú trabajas. Para
          peluquerías, barberías y negocios con cita previa.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            href={wa}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-foreground px-6 font-semibold text-background"
          >
            <MessageCircle className="h-5 w-5" aria-hidden="true" />
            Pruébalo por WhatsApp
          </a>
          <a
            href={`${PANEL_URL}/login`}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border px-6 font-medium text-foreground hover:bg-muted"
          >
            <CalendarCheck className="h-5 w-5" aria-hidden="true" />
            Ya soy cliente
          </a>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          49 €/mes · sin coste de alta · 14 días de prueba gratis
        </p>
      </section>
    </main>
  );
}
