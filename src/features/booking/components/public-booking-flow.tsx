"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  CalendarDays,
  Check,
  CircleCheck,
  Clock,
  Loader2,
  MessageCircle,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchAvailability,
  submitPublicBooking,
} from "../services/public-actions";
import type { PublicBusiness, PublicDay } from "../services/public-booking";

interface Props {
  business: PublicBusiness;
}

type Done = { when: string; service: string; staff: string | null; consent: boolean };

const ANY = "any";

function formatPrice(price: number | null): string | null {
  if (price === null || price === 0) return null;
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: price % 1 === 0 ? 0 : 2,
  }).format(price);
}

function shortDay(date: string): { weekday: string; day: string; month: string } {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  const f = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", ...o }).format(dt);
  return {
    weekday: f({ weekday: "short" }).replace(".", ""),
    day: f({ day: "numeric" }),
    month: f({ month: "short" }).replace(".", ""),
  };
}

function waLink(phone: string, text: string): string {
  return `https://wa.me/${phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(text)}`;
}

function StepTitle({
  n,
  children,
  done,
}: {
  n: number;
  children: React.ReactNode;
  done?: boolean;
}) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs",
          done
            ? "bg-foreground text-background"
            : "border border-border text-muted-foreground",
        )}
        aria-hidden="true"
      >
        {done ? <Check className="h-3.5 w-3.5" /> : n}
      </span>
      {children}
    </h2>
  );
}

export function PublicBookingFlow({ business }: Props) {
  const [serviceId, setServiceId] = useState<string | null>(
    business.services.length === 1 ? business.services[0].id : null,
  );
  const [staffId, setStaffId] = useState<string>(ANY);
  const [days, setDays] = useState<PublicDay[] | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(true);
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [loadingDays, startLoadingDays] = useTransition();
  const [submitting, startSubmit] = useTransition();

  const service = business.services.find((s) => s.id === serviceId) ?? null;
  const showStaff = (service?.staff.length ?? 0) > 1;
  const selectedDay = useMemo(
    () => days?.find((d) => d.date === date) ?? null,
    [days, date],
  );

  function fetchDays(svc: string, staff: string) {
    startLoadingDays(async () => {
      const result = await fetchAvailability(
        business.slug,
        svc,
        staff === ANY ? null : staff,
      );
      setDays(result);
      setDate(result.length > 0 ? result[0].date : null);
    });
  }

  function loadDays(svc: string, staff: string) {
    setDays(null);
    setDate(null);
    setTime(null);
    fetchDays(svc, staff);
  }

  // Con un solo servicio ya viene elegido: cargar sus huecos al abrir.
  useEffect(() => {
    if (business.services.length === 1) {
      fetchDays(business.services[0].id, ANY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit() {
    if (!serviceId || !date || !time) return;
    setError(null);
    startSubmit(async () => {
      const res = await submitPublicBooking(business.slug, {
        serviceId,
        staffId: staffId === ANY ? null : staffId,
        date,
        time,
        name,
        phone,
        consent,
        website,
      });
      if (res.ok) {
        setDone({ when: res.when, service: res.service, staff: res.staff, consent });
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setError(res.error);
        if (/ocupar/.test(res.error)) loadDays(serviceId, staffId);
      }
    });
  }

  const header = (
    <header className="mb-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-lg font-semibold text-background">
        {business.name.charAt(0).toUpperCase()}
      </div>
      <h1 className="font-display text-2xl font-semibold text-foreground">
        {business.name}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {business.intro ?? "Reserva tu cita en menos de un minuto."}
      </p>
    </header>
  );

  const footer = (
    <footer className="mt-12 pb-8 text-center text-xs text-muted-foreground">
      Reservas con{" "}
      <a href="https://holacitaya.app" className="font-medium text-foreground underline-offset-2 hover:underline">
        Citaya
      </a>
      {" · "}
      <a href="https://holacitaya.app/legal/privacidad" className="underline-offset-2 hover:underline">
        Privacidad
      </a>
      {" · "}
      <a href="https://holacitaya.app/legal/aviso-legal" className="underline-offset-2 hover:underline">
        Aviso legal
      </a>
    </footer>
  );

  if (done) {
    return (
      <main className="public-light min-h-screen bg-background">
        <div className="mx-auto max-w-lg px-4 py-10">
          {header}
          <section className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
            <CircleCheck className="mx-auto mb-3 h-12 w-12 text-success" aria-hidden="true" />
            <h2 className="text-xl font-semibold text-foreground">¡Cita reservada!</h2>
            <p className="mt-3 text-base text-foreground first-letter:uppercase">{done.when}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {done.service}
              {done.staff ? ` · con ${done.staff}` : ""}
            </p>
            {done.consent && (
              <p className="mt-4 text-sm text-muted-foreground">
                Te enviaremos la confirmación y un recordatorio por WhatsApp.
              </p>
            )}
            {business.whatsapp && (
              <a
                href={waLink(business.whatsapp, `Hola, quiero cambiar o cancelar mi cita del ${done.when}`)}
                className="mt-6 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Cambiar o cancelar por WhatsApp
              </a>
            )}
          </section>
          {footer}
        </div>
      </main>
    );
  }

  return (
    <main className="public-light min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-10">
        {header}

        {business.services.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Ahora mismo no hay servicios disponibles para reservar.
          </p>
        ) : (
          <div className="space-y-8">
            {/* 1. Servicio */}
            <section>
              <StepTitle n={1} done={!!service}>
                Elige el servicio
              </StepTitle>
              <div className="grid gap-2">
                {business.services.map((s) => {
                  const price = formatPrice(s.price);
                  const active = s.id === serviceId;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setServiceId(s.id);
                        setStaffId(ANY);
                        loadDays(s.id, ANY);
                      }}
                      aria-pressed={active}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-xl border bg-card p-4 text-left transition-colors",
                        active
                          ? "border-foreground ring-1 ring-foreground"
                          : "border-border hover:border-foreground/40",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block font-medium text-foreground">{s.name}</span>
                        <span className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                          {s.durationMin} min
                          {s.description ? ` · ${s.description}` : ""}
                        </span>
                      </span>
                      {price && (
                        <span className="shrink-0 font-semibold text-foreground">{price}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 2. Profesional */}
            {service && showStaff && (
              <section>
                <StepTitle n={2} done>
                  ¿Con quién?
                </StepTitle>
                <div className="flex flex-wrap gap-2">
                  {[{ id: ANY, name: "Me da igual" }, ...service.staff].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setStaffId(m.id);
                        if (serviceId) loadDays(serviceId, m.id);
                      }}
                      aria-pressed={staffId === m.id}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-colors",
                        staffId === m.id
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-card text-foreground hover:border-foreground/40",
                      )}
                    >
                      <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
                      {m.name}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* 3. Día y hora */}
            {service && (
              <section>
                <StepTitle n={showStaff ? 3 : 2} done={!!time}>
                  Día y hora
                </StepTitle>

                {loadingDays || days === null ? (
                  <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Buscando huecos libres…
                  </div>
                ) : days.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                    <CalendarDays className="mx-auto mb-2 h-5 w-5" aria-hidden="true" />
                    No quedan huecos libres en los próximos días.
                    {business.whatsapp && (
                      <>
                        {" "}
                        <a
                          className="font-medium text-foreground underline"
                          href={waLink(business.whatsapp, `Hola, quería reservar ${service.name}`)}
                        >
                          Escríbenos por WhatsApp
                        </a>
                        .
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    <div
                      className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1"
                      role="listbox"
                      aria-label="Días disponibles"
                    >
                      {days.map((d) => {
                        const s = shortDay(d.date);
                        const active = d.date === date;
                        return (
                          <button
                            key={d.date}
                            type="button"
                            role="option"
                            aria-selected={active}
                            aria-label={d.label}
                            onClick={() => {
                              setDate(d.date);
                              setTime(null);
                            }}
                            className={cn(
                              "flex w-16 shrink-0 flex-col items-center rounded-xl border py-2 transition-colors",
                              active
                                ? "border-foreground bg-foreground text-background"
                                : "border-border bg-card text-foreground hover:border-foreground/40",
                            )}
                          >
                            <span className="text-xs capitalize opacity-80">{s.weekday}</span>
                            <span className="text-lg font-semibold leading-tight">{s.day}</span>
                            <span className="text-xs capitalize opacity-80">{s.month}</span>
                          </button>
                        );
                      })}
                    </div>

                    {selectedDay && (
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                        {selectedDay.times.map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setTime(t)}
                            aria-pressed={time === t}
                            className={cn(
                              "rounded-lg border py-2.5 font-mono text-sm transition-colors",
                              time === t
                                ? "border-foreground bg-foreground text-background"
                                : "border-border bg-card text-foreground hover:border-foreground/40",
                            )}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>
            )}

            {/* 4. Datos */}
            {service && time && selectedDay && (
              <section>
                <StepTitle n={showStaff ? 4 : 3}>Tus datos</StepTitle>
                <form
                  className="space-y-3 rounded-2xl border border-border bg-card p-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                  }}
                >
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground first-letter:uppercase">
                      {selectedDay.label}, {time}
                    </span>{" "}
                    · {service.name}
                  </p>
                  <div>
                    <label htmlFor="pb-name" className="mb-1 block text-sm font-medium text-foreground">
                      Nombre
                    </label>
                    <input
                      id="pb-name"
                      required
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground outline-none focus:border-foreground"
                      placeholder="Tu nombre"
                    />
                  </div>
                  <div>
                    <label htmlFor="pb-phone" className="mb-1 block text-sm font-medium text-foreground">
                      Teléfono (WhatsApp)
                    </label>
                    <input
                      id="pb-phone"
                      required
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground outline-none focus:border-foreground"
                      placeholder="600 123 456"
                    />
                  </div>
                  {/* Campo trampa para bots, invisible para personas */}
                  <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="hidden"
                    aria-hidden="true"
                    name="website"
                  />
                  <label className="flex items-start gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-foreground"
                    />
                    <span>
                      Quiero recibir la confirmación y el recordatorio de mi cita por WhatsApp.{" "}
                      <a
                        href="https://holacitaya.app/legal/privacidad"
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-2"
                      >
                        Cómo usamos tus datos
                      </a>
                    </span>
                  </label>

                  {error && (
                    <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-base font-semibold text-background transition-opacity disabled:opacity-60"
                  >
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    Reservar cita
                  </button>
                </form>
              </section>
            )}
          </div>
        )}

        {footer}
      </div>
    </main>
  );
}
