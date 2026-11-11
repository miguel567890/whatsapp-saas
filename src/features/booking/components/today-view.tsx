"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CalendarPlus,
  Check,
  Copy,
  ExternalLink,
  MessageCircle,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AppointmentCard, NewAppointmentForm } from "./agenda-board";
import { formatDayLabel, localParts } from "../lib/time";
import type { AppointmentRow, BookingConfig } from "../types";

export interface PendingChat {
  id: string;
  state: string;
  unread: number;
  lastAt: string | null;
  name: string | null;
  phone: string | null;
}

interface Props {
  workspaceId: string;
  businessName: string;
  config: BookingConfig;
  today: string;
  nowIso: string;
  appointments: AppointmentRow[];
  tomorrowCount: number;
  pendingChats: PendingChat[];
  publicUrl: string | null;
}

function greeting(hour: number) {
  if (hour < 6) return "Buenas noches";
  if (hour < 14) return "Buenos días";
  if (hour < 21) return "Buenas tardes";
  return "Buenas noches";
}

function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "attention";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4",
        tone === "attention" ? "border-warning/50" : "border-border/60",
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-display text-2xl font-semibold text-foreground">
        {value}
      </p>
      {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function PublicLinkCard({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const display = url.replace(/^https?:\/\//, "");

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Enlace copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Reserva tu cita", url });
        return;
      } catch {
        // El usuario cerró el menú de compartir: no es un error.
        return;
      }
    }
    await copy();
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium">Tu página de reservas</p>
        <p className="truncate font-mono text-xs text-muted-foreground">{display}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="outline" onClick={copy}>
          {copied ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4" aria-hidden="true" />
          )}
          Copiar
        </Button>
        <Button size="sm" variant="outline" onClick={share}>
          <Share2 className="h-4 w-4" aria-hidden="true" />
          Compartir
        </Button>
        <a href={url} target="_blank" rel="noreferrer">
          <Button size="sm" variant="ghost" aria-label="Abrir la página">
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </Button>
        </a>
      </div>
    </div>
  );
}

export function TodayView({
  workspaceId,
  businessName,
  config,
  today,
  nowIso,
  appointments,
  tomorrowCount,
  pendingChats,
  publicUrl,
}: Props) {
  const [creating, setCreating] = useState(false);
  const now = new Date(nowIso);
  const nowLocal = localParts(now, config.timeZone);
  const hour = Number(nowLocal.time.slice(0, 2));

  const active = appointments.filter(
    (a) => a.status === "booked" || a.status === "confirmed",
  );
  const visible = appointments.filter((a) => a.status !== "cancelled");
  const next = active.find((a) => new Date(a.ends_at ?? a.scheduled_at) > now);
  const nextLocal = next ? localParts(new Date(next.scheduled_at), config.timeZone) : null;
  const remaining = active.filter((a) => new Date(a.scheduled_at) > now).length;
  const configured = config.services.length > 0 && config.staff.length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground first-letter:uppercase">
            {formatDayLabel(today)}
          </p>
          <h1 className="truncate font-display text-2xl font-semibold text-foreground">
            {greeting(hour)}, {businessName}
          </h1>
        </div>
        <Button onClick={() => setCreating((v) => !v)} className="sm:w-auto">
          <CalendarPlus className="h-4 w-4" aria-hidden="true" />
          Nueva cita
        </Button>
      </div>

      {creating && (
        <NewAppointmentForm
          workspaceId={workspaceId}
          config={config}
          defaultDate={today}
          onDone={() => setCreating(false)}
        />
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Citas hoy"
          value={String(active.length)}
          hint={active.length ? `${remaining} por llegar` : "Día libre de momento"}
        />
        <Stat
          label="Siguiente"
          value={nextLocal ? nextLocal.time : "—"}
          hint={next ? (next.customer_name ?? "Sin nombre") : "No quedan citas hoy"}
        />
        <Stat
          label="Mensajes por atender"
          value={String(pendingChats.length)}
          hint={pendingChats.length ? "Te necesitan" : "Todo al día"}
          tone={pendingChats.length ? "attention" : "default"}
        />
        <Stat label="Mañana" value={String(tomorrowCount)} hint="citas reservadas" />
      </div>

      {pendingChats.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Clientes esperando respuesta</h2>
          <ul className="divide-y divide-border/60 rounded-lg border border-warning/40 bg-card">
            {pendingChats.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/inbox/${c.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <MessageCircle
                      className="h-4 w-4 shrink-0 text-warning"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {c.name ?? c.phone ?? "Cliente"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.state === "handoff_pending"
                          ? "La recepcionista te ha pasado la conversación"
                          : `${c.unread} mensaje(s) sin leer`}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-primary">Responder</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Citas de hoy</h2>
          <Link
            href="/agenda"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            Ver la semana
          </Link>
        </div>
        {!configured ? (
          <div className="rounded-lg border border-dashed border-border/60 p-6 text-center">
            <p className="text-sm font-medium">Tu agenda aún no está configurada</p>
            <p className="mb-3 text-sm text-muted-foreground">
              Añade tus servicios, profesionales y horario para empezar a recibir citas.
            </p>
            <Link href="/negocio">
              <Button size="sm">Configurar mi negocio</Button>
            </Link>
          </div>
        ) : visible.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
            Hoy no tienes citas todavía.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((a) => (
              <AppointmentCard
                key={a.id}
                appt={a}
                workspaceId={workspaceId}
                config={config}
              />
            ))}
          </ul>
        )}
      </section>

      {publicUrl ? (
        <PublicLinkCard url={publicUrl} />
      ) : (
        configured && (
          <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Activa tu página de reservas para que tus clientes pidan cita solos.
            </p>
            <Link href="/negocio">
              <Button size="sm" variant="outline">
                Activarla
              </Button>
            </Link>
          </div>
        )
      )}
    </div>
  );
}
