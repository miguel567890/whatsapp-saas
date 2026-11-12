import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { LEGAL_UPDATED } from "./owner";

/** Bloques de texto de las páginas legales (sin dependencias de estilos extra). */
export type LegalBlock =
  | { type: "p"; text: React.ReactNode }
  | { type: "ul"; items: React.ReactNode[] };

export interface LegalSection {
  title: string;
  blocks: LegalBlock[];
}

const LINKS = [
  { href: "/legal/aviso-legal", label: "Aviso legal" },
  { href: "/legal/privacidad", label: "Privacidad y cookies" },
  { href: "/legal/encargo-tratamiento", label: "Contrato de encargo (negocios)" },
];

export function LegalPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro?: React.ReactNode;
  sections: LegalSection[];
}) {
  return (
    <div className="public-light min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-2" aria-label="Citaya, inicio">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <CalendarCheck className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <span className="font-display text-xl font-semibold tracking-tight">Citaya</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última actualización: {LEGAL_UPDATED}</p>
        {intro && <div className="mt-6 text-base leading-relaxed text-muted-foreground">{intro}</div>}

        <div className="mt-10 space-y-10">
          {sections.map((s, i) => (
            <section key={s.title} aria-labelledby={`s${i}`}>
              <h2 id={`s${i}`} className="text-lg font-semibold">
                {i + 1}. {s.title}
              </h2>
              <div className="mt-3 space-y-3 leading-relaxed text-muted-foreground">
                {s.blocks.map((b, j) =>
                  b.type === "p" ? (
                    <p key={j}>{b.text}</p>
                  ) : (
                    <ul key={j} className="list-disc space-y-1.5 pl-5">
                      {b.items.map((it, k) => (
                        <li key={k}>{it}</li>
                      ))}
                    </ul>
                  ),
                )}
              </div>
            </section>
          ))}
        </div>
      </main>

      <footer className="border-t border-border">
        <nav
          aria-label="Páginas legales"
          className="mx-auto flex max-w-3xl flex-wrap gap-x-6 gap-y-2 px-4 py-8 text-sm text-muted-foreground sm:px-6"
        >
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-foreground">
              {l.label}
            </Link>
          ))}
          <Link href="/" className="hover:text-foreground">
            Volver a Citaya
          </Link>
        </nav>
      </footer>
    </div>
  );
}

/** Pie con enlaces legales para la portada y las páginas de reservas. */
export function LegalLinks({ className }: { className?: string }) {
  return (
    <span className={className}>
      <Link href="/legal/aviso-legal" className="hover:text-foreground">
        Aviso legal
      </Link>
      {" · "}
      <Link href="/legal/privacidad" className="hover:text-foreground">
        Privacidad
      </Link>
    </span>
  );
}
