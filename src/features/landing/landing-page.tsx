import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  CalendarCheck,
  CalendarDays,
  Check,
  Clock,
  Hand,
  Link2,
  MessageCircle,
  MoonStar,
  Scissors,
  Smartphone,
  UserRoundX,
  type LucideIcon,
} from "lucide-react";

/**
 * Portada de holacitaya.app. Página estática (sin JavaScript en el cliente):
 * todo es HTML + CSS para que cargue al instante desde un anuncio en el móvil.
 */

const PANEL_URL = process.env.PANEL_URL ?? "https://panel.holacitaya.app";
const DEMO_WHATSAPP = process.env.NEXT_PUBLIC_DEMO_WHATSAPP ?? "34613086985";
const DEMO_SLUG = process.env.NEXT_PUBLIC_DEMO_SLUG ?? "demo";

const wa = (text: string) =>
  `https://wa.me/${DEMO_WHATSAPP}?text=${encodeURIComponent(text)}`;

const WA_TRY = wa("Hola, ¿tenéis hueco esta semana para un corte?");
const WA_TRIAL = wa("Hola, quiero probar Citaya 14 días en mi negocio");
const WA_INFO = wa("Hola, quiero saber más de Citaya");

// ── Piezas pequeñas ───────────────────────────────────────────────────────────

function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
        <CalendarCheck className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <span className="font-display text-xl font-semibold tracking-tight text-foreground">
        Citaya
      </span>
    </span>
  );
}

function PrimaryCta({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="inline-flex h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-foreground px-6 font-semibold text-background transition-transform hover:-translate-y-0.5"
    >
      {children}
    </a>
  );
}

function SecondaryCta({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="inline-flex h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-border bg-card px-6 font-medium text-foreground transition-colors hover:bg-muted"
    >
      {children}
    </a>
  );
}

function SectionTitle({
  kicker,
  title,
  intro,
}: {
  kicker: string;
  title: string;
  intro?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {kicker}
      </p>
      <h2 className="mt-2 font-display text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
        {title}
      </h2>
      {intro && <p className="mt-4 text-lg text-muted-foreground">{intro}</p>}
    </div>
  );
}

// ── Maqueta del chat (hero) ───────────────────────────────────────────────────

function Bubble({
  from,
  children,
  time,
}: {
  from: "client" | "citaya";
  children: React.ReactNode;
  time: string;
}) {
  const mine = from === "citaya";
  return (
    <div className={mine ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          mine
            ? "max-w-[82%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-[13px] leading-snug text-primary-foreground"
            : "max-w-[82%] rounded-2xl rounded-bl-md bg-card px-3.5 py-2 text-[13px] leading-snug text-foreground shadow-sm ring-1 ring-border"
        }
      >
        {children}
        <span className="ml-2 align-bottom text-[10px] opacity-60">{time}</span>
      </div>
    </div>
  );
}

function ChatMock() {
  return (
    <div className="relative mx-auto w-full max-w-[340px]">
      <div className="rounded-[2.2rem] border border-border bg-foreground p-2.5 shadow-2xl shadow-foreground/20">
        <div className="overflow-hidden rounded-[1.7rem] bg-muted">
          <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground">
              <Scissors className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Barbería del Centro</p>
              <p className="text-[11px] text-muted-foreground">en línea</p>
            </div>
          </div>
          <div className="space-y-2.5 px-3 pb-24 pt-4">
            <Bubble from="client" time="23:14">
              Buenas! ¿Tenéis hueco mañana para corte y barba?
            </Bubble>
            <Bubble from="citaya" time="23:14">
              ¡Hola! Mañana tengo libre a las 10:30, 12:00 y 17:15. ¿Cuál te viene mejor?
            </Bubble>
            <Bubble from="client" time="23:15">
              A las 12 perfecto. Soy Javi
            </Bubble>
            <Bubble from="citaya" time="23:15">
              Hecho, Javi: mañana a las 12:00, corte y barba. Te mando un recordatorio
              antes. ¡Hasta mañana!
            </Bubble>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-5 -left-3 w-56 rounded-2xl border border-border bg-card p-3 shadow-xl sm:-left-12">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-success/15 text-success">
            <CalendarCheck className="h-4 w-4" aria-hidden="true" />
          </span>
          <p className="text-xs font-semibold text-foreground">Nueva cita en tu agenda</p>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Mañana · 12:00 – 12:45 · Corte y barba · Javi
        </p>
      </div>
    </div>
  );
}

// ── Contenido ─────────────────────────────────────────────────────────────────

const PAINS: { Icon: LucideIcon; title: string; text: string }[] = [
  {
    Icon: Hand,
    title: "Con las manos ocupadas",
    text: "Estás cortando y el móvil no para de vibrar. O lo dejas sonar, o haces esperar al que tienes en la silla.",
  },
  {
    Icon: MoonStar,
    title: "Mensajes a deshoras",
    text: "Muchos piden cita por la noche o el domingo. Si contestas tarde, reservan en otro sitio.",
  },
  {
    Icon: UserRoundX,
    title: "Huecos que se pierden",
    text: "Gente que se olvida de su cita y una hora vacía que nadie aprovecha.",
  },
];

const STEPS: { title: string; text: string }[] = [
  {
    title: "Te lo dejamos montado",
    text: "Nos das tus servicios, precios, horarios y quién trabaja cada día. Lo configuramos por ti, sin que toques nada técnico.",
  },
  {
    title: "Tus clientes piden cita",
    text: "Escriben por WhatsApp o entran en tu enlace de reservas. Citaya les ofrece huecos libres de verdad y apunta la cita.",
  },
  {
    title: "Tú solo miras tu agenda",
    text: "Desde el móvil ves las citas del día, quién viene después y los mensajes que necesitan tu respuesta.",
  },
];

const FEATURES: { Icon: LucideIcon; title: string; text: string }[] = [
  {
    Icon: MessageCircle,
    title: "Contesta al momento",
    text: "Responde en segundos, a cualquier hora, con un trato cercano y en español de aquí.",
  },
  {
    Icon: CalendarDays,
    title: "Da cita sola",
    text: "Mira tu agenda real: respeta horarios, descansos, vacaciones y la duración de cada servicio. Nunca dobla una cita.",
  },
  {
    Icon: Link2,
    title: "Tu página de reservas",
    text: "Un enlace propio (holacitaya.app/tu-negocio) para Instagram, Google Maps o un código QR en el mostrador.",
  },
  {
    Icon: BellRing,
    title: "Recordatorios",
    text: "Avisa a tus clientes antes de la cita para que no se les olvide.",
  },
  {
    Icon: Clock,
    title: "Te avisa cuando hace falta",
    text: "Si alguien pregunta algo que no sabe responder, te pasa la conversación para que contestes tú.",
  },
  {
    Icon: Smartphone,
    title: "Tu agenda en el bolsillo",
    text: "Un panel sencillo para el móvil: hoy, la semana, nueva cita y mensajes. Nada más.",
  },
];

const INCLUDED = [
  "Recepcionista de WhatsApp con IA",
  "Agenda online y página de reservas",
  "Recordatorios de cita",
  "Panel para el móvil",
  "Configuración inicial hecha por nosotros",
  "Soporte directo por WhatsApp",
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "¿Tengo que saber de tecnología?",
    a: "No. Nosotros lo dejamos todo configurado con tus servicios y horarios. Tú solo usas el panel desde el móvil, como cualquier app.",
  },
  {
    q: "¿Mis clientes tienen que descargarse algo?",
    a: "No. Te escriben por WhatsApp como siempre, o abren tu enlace de reservas en el navegador.",
  },
  {
    q: "¿Y si un cliente pregunta algo raro?",
    a: "Citaya responde con la información de tu negocio. Si no lo sabe, no se lo inventa: te pasa la conversación y la verás marcada en tu panel.",
  },
  {
    q: "¿Puedo apuntar yo las citas que me llegan por teléfono?",
    a: "Sí. Con el botón «Nueva cita» las añades en segundos y Citaya ya cuenta con ese hueco ocupado.",
  },
  {
    q: "¿Qué pasa cuando terminan los 14 días de prueba?",
    a: "Decides tú. Si te convence, sigues con el plan mensual o anual. Si no, lo dejamos ahí y no pagas nada.",
  },
  {
    q: "¿Solo sirve para peluquerías y barberías?",
    a: "Está pensado para ellas, pero funciona en cualquier negocio con cita previa: estética, uñas, fisioterapia, tatuajes…",
  },
];

// ── Página ────────────────────────────────────────────────────────────────────

export function LandingPage() {
  return (
    <div className="public-light min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="Citaya, inicio">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#como-funciona" className="hover:text-foreground">
              Cómo funciona
            </a>
            <a href="#precio" className="hover:text-foreground">
              Precio
            </a>
            <a href="#preguntas" className="hover:text-foreground">
              Preguntas
            </a>
          </nav>
          <a
            href={`${PANEL_URL}/login`}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Acceso negocios
          </a>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-primary/25 blur-3xl"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-4 pb-24 pt-14 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-sm text-muted-foreground">
                <Scissors className="h-3.5 w-3.5" aria-hidden="true" />
                Para peluquerías y barberías
              </p>
              <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
                Tus clientes piden cita por WhatsApp.{" "}
                <span className="relative whitespace-nowrap">
                  <span className="relative z-10">Citaya contesta</span>
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-1 z-0 h-3 rounded bg-primary sm:h-4"
                  />
                </span>{" "}
                por ti.
              </h1>
              <p className="mt-6 max-w-xl text-lg text-muted-foreground">
                Una recepcionista que responde al momento, a cualquier hora, y apunta la
                cita en tu agenda mientras tú sigues con las tijeras.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <PrimaryCta href={WA_TRY}>
                  <MessageCircle className="h-5 w-5" aria-hidden="true" />
                  Pruébala por WhatsApp
                </PrimaryCta>
                <SecondaryCta href={`/${DEMO_SLUG}`}>
                  Ver una página de reservas
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </SecondaryCta>
              </div>
              <p className="mt-5 text-sm text-muted-foreground">
                14 días de prueba gratis · Sin coste de alta · Te lo dejamos montado
              </p>
            </div>
            <ChatMock />
          </div>
        </section>

        {/* Problemas */}
        <section className="border-y border-border bg-muted/50 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionTitle kicker="¿Te suena?" title="El WhatsApp del negocio no espera" />
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {PAINS.map(({ Icon, title, text }) => (
                <div key={title} className="rounded-2xl border border-border bg-card p-6">
                  <Icon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                  <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Cómo funciona */}
        <section id="como-funciona" className="scroll-mt-20 py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionTitle
              kicker="Cómo funciona"
              title="Lo montamos nosotros, tú solo lo usas"
            />
            <ol className="mt-14 grid gap-8 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary font-display text-lg font-semibold text-primary-foreground">
                    {i + 1}
                  </span>
                  <h3 className="mt-5 text-xl font-semibold">{s.title}</h3>
                  <p className="mt-2 text-muted-foreground">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Funciones */}
        <section className="bg-foreground py-24 text-background">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-wider text-primary">
                Qué hace por ti
              </p>
              <h2 className="mt-2 font-display text-3xl font-semibold leading-tight sm:text-4xl">
                Todo lo que haría una recepcionista, sin horario
              </h2>
            </div>
            <div className="mt-14 grid gap-px overflow-hidden rounded-2xl bg-background/10 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ Icon, title, text }) => (
                <div key={title} className="bg-foreground p-7">
                  <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
                  <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-background/70">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pruébalo */}
        <section className="py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionTitle
              kicker="Pruébalo tú mismo"
              title="Ponte en el lugar de tu cliente"
              intro="No te lo contamos: escríbele o reserva una cita de prueba y mira cómo responde."
            />
            <div className="mt-12 grid gap-4 md:grid-cols-2">
              <a
                href={WA_TRY}
                className="group rounded-2xl border border-border bg-card p-7 transition-shadow hover:shadow-lg"
              >
                <MessageCircle className="h-7 w-7" aria-hidden="true" />
                <h3 className="mt-4 text-xl font-semibold">Escríbele por WhatsApp</h3>
                <p className="mt-2 text-muted-foreground">
                  Pide cita, pregunta un precio o cambia de hora. Te contesta la
                  recepcionista de Citaya.
                </p>
                <span className="mt-5 inline-flex items-center gap-1 font-medium">
                  Abrir WhatsApp
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </span>
              </a>
              <Link
                href={`/${DEMO_SLUG}`}
                className="group rounded-2xl border border-border bg-card p-7 transition-shadow hover:shadow-lg"
              >
                <CalendarCheck className="h-7 w-7" aria-hidden="true" />
                <h3 className="mt-4 text-xl font-semibold">Abre una página de reservas</h3>
                <p className="mt-2 text-muted-foreground">
                  Así la verán tus clientes: eligen servicio, profesional, día y hora en
                  menos de un minuto.
                </p>
                <span className="mt-5 inline-flex items-center gap-1 font-medium">
                  holacitaya.app/{DEMO_SLUG}
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </span>
              </Link>
            </div>
          </div>
        </section>

        {/* Precio */}
        <section id="precio" className="scroll-mt-20 border-y border-border bg-muted/50 py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionTitle
              kicker="Precio"
              title="Un precio claro, sin sorpresas"
              intro="Menos de lo que pierdes con un par de citas que no vienen al mes."
            />
            <div className="mx-auto mt-12 max-w-xl overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
              <div className="p-8">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-display text-6xl font-semibold tracking-tight">49 €</span>
                  <span className="text-lg text-muted-foreground">/ mes</span>
                </div>
                <p className="mt-2 text-muted-foreground">
                  Hasta 2 profesionales. Cada profesional más, +10 €/mes.
                </p>
                <p className="mt-1 text-muted-foreground">
                  O <strong className="text-foreground">490 € al año</strong> (dos meses
                  gratis).
                </p>
                <ul className="mt-7 space-y-3">
                  {INCLUDED.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-8 flex flex-col">
                  <PrimaryCta href={WA_TRIAL}>Empezar los 14 días gratis</PrimaryCta>
                </div>
                <p className="mt-3 text-center text-sm text-muted-foreground">
                  Sin coste de alta. Sin tarjeta para la prueba.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Preguntas */}
        <section id="preguntas" className="scroll-mt-20 py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <SectionTitle kicker="Preguntas" title="Lo que suelen preguntarnos" />
            <div className="mt-12 divide-y divide-border rounded-2xl border border-border bg-card">
              {FAQ.map(({ q, a }) => (
                <details key={q} className="group px-6 py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                    {q}
                    <span
                      aria-hidden="true"
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-muted-foreground">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Llamada final */}
        <section className="px-4 pb-24 sm:px-6">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-foreground px-6 py-16 text-center text-background sm:px-12">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-32 left-1/2 h-72 w-[38rem] -translate-x-1/2 rounded-full bg-primary/30 blur-3xl"
            />
            <h2 className="relative font-display text-3xl font-semibold leading-tight sm:text-4xl">
              Deja de contestar WhatsApps entre corte y corte
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-lg text-background/70">
              Pruébalo 14 días en tu negocio. Te lo dejamos funcionando y tú decides.
            </p>
            <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <a
                href={WA_TRIAL}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
              >
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
                Quiero probarlo
              </a>
              <a
                href={WA_INFO}
                className="inline-flex h-12 items-center justify-center rounded-xl border border-background/25 px-6 font-medium hover:bg-background/10"
              >
                Tengo una pregunta
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <Logo />
            <span>Hecho en Cádiz</span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <a href={WA_INFO} className="hover:text-foreground">
              Contacto
            </a>
            <a href={`${PANEL_URL}/login`} className="hover:text-foreground">
              Acceso negocios
            </a>
            <span>© {new Date().getFullYear()} Citaya</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
