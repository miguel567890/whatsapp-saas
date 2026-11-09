"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  cancelAppointmentFromPanel,
  createManualAppointment,
  moveAppointmentFromPanel,
  setAppointmentStatus,
} from "../services/booking-actions";
import { addDays, formatDayLabel, localParts } from "../lib/time";
import type { AppointmentRow, AppointmentStatus, BookingConfig } from "../types";

interface Props {
  workspaceId: string;
  role: string;
  config: BookingConfig;
  weekStart: string;
  today: string;
  appointments: AppointmentRow[];
}

const STATUS_META: Record<AppointmentStatus, { label: string; className: string }> = {
  booked: { label: "Reservada", className: "bg-info/10 text-info" },
  confirmed: { label: "Confirmada", className: "bg-success/10 text-success" },
  completed: { label: "Hecha", className: "bg-muted text-muted-foreground" },
  no_show: { label: "No vino", className: "bg-warning/10 text-warning" },
  cancelled: { label: "Cancelada", className: "bg-destructive/10 text-destructive" },
};

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm";

// ── Formulario de nueva cita ──────────────────────────────────────────────────

function NewAppointmentForm({
  workspaceId,
  config,
  defaultDate,
  onDone,
}: {
  workspaceId: string;
  config: BookingConfig;
  defaultDate: string;
  onDone: () => void;
}) {
  const services = config.services.filter((s) => s.active);
  const [form, setForm] = useState({
    service_id: services[0]?.id ?? "",
    staff_id: "",
    date: defaultDate,
    time: "10:00",
    customer_name: "",
    customer_phone: "",
    notes: "",
  });
  const [pending, start] = useTransition();
  const staff = config.staff.filter(
    (s) =>
      s.active &&
      (s.service_ids.length === 0 || s.service_ids.includes(form.service_id)),
  );

  function submit() {
    start(async () => {
      const res = await createManualAppointment(workspaceId, {
        ...form,
        staff_id: form.staff_id || null,
      });
      if (res.ok) {
        toast.success("Cita creada");
        onDone();
      } else toast.error(res.error);
    });
  }

  if (services.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
        Primero crea servicios y profesionales en{" "}
        <Link href="/settings" className="underline">
          Configuración → Agenda
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="grid gap-4 rounded-lg border border-border/60 bg-card p-4 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor="na-service">Servicio</Label>
        <select
          id="na-service"
          className={selectClass}
          value={form.service_id}
          onChange={(e) => setForm({ ...form, service_id: e.target.value })}
        >
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.duration_min} min)
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="na-staff">Profesional</Label>
        <select
          id="na-staff"
          className={selectClass}
          value={form.staff_id}
          onChange={(e) => setForm({ ...form, staff_id: e.target.value })}
        >
          <option value="">El primero libre</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="na-date">Día</Label>
          <Input
            id="na-date"
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="na-time">Hora</Label>
          <Input
            id="na-time"
            type="time"
            step={300}
            value={form.time}
            onChange={(e) => setForm({ ...form, time: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="na-name">Cliente</Label>
        <Input
          id="na-name"
          value={form.customer_name}
          onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
          placeholder="Nombre"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="na-phone">Teléfono</Label>
        <Input
          id="na-phone"
          inputMode="tel"
          value={form.customer_phone}
          onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
          placeholder="Opcional"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="na-notes">Nota</Label>
        <Input
          id="na-notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Opcional"
        />
      </div>
      <div className="flex justify-end gap-2 sm:col-span-3">
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={pending || !form.customer_name}>
          Guardar cita
        </Button>
      </div>
    </div>
  );
}

// ── Tarjeta de cita ───────────────────────────────────────────────────────────

function AppointmentCard({
  appt,
  workspaceId,
  config,
}: {
  appt: AppointmentRow;
  workspaceId: string;
  config: BookingConfig;
}) {
  const [pending, start] = useTransition();
  const [moving, setMoving] = useState(false);
  const startLocal = localParts(new Date(appt.scheduled_at), config.timeZone);
  const endLocal = appt.ends_at
    ? localParts(new Date(appt.ends_at), config.timeZone)
    : null;
  const [move, setMove] = useState({ date: startLocal.date, time: startLocal.time });

  const service = config.services.find((s) => s.id === appt.service_id);
  const staff = config.staff.find((s) => s.id === appt.staff_id);
  const meta = STATUS_META[appt.status];
  const active = appt.status === "booked" || appt.status === "confirmed";

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    start(async () => {
      const res = await fn();
      if (res.ok) toast.success(okMsg);
      else toast.error(res.error ?? "Error");
    });
  }

  return (
    <li
      className={cn(
        "space-y-2 rounded-lg border border-border/60 bg-card p-3",
        !active && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm">
            {startLocal.time}
            {endLocal ? `–${endLocal.time}` : ""}
          </p>
          <p className="truncate text-sm font-medium">
            {appt.customer_name ?? "Sin nombre"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {service?.name ?? "Servicio"}
            {staff ? ` · ${staff.name}` : ""}
            {appt.source === "agent" ? " · por WhatsApp" : ""}
          </p>
          {appt.notes && (
            <p className="mt-1 text-xs text-muted-foreground">“{appt.notes}”</p>
          )}
        </div>
        <span
          className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs", meta.className)}
        >
          {meta.label}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {appt.customer_phone && (
          <a
            href={`tel:${appt.customer_phone}`}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-xs text-muted-foreground hover:text-foreground"
          >
            <Phone className="h-3 w-3" aria-hidden="true" />
            {appt.customer_phone}
          </a>
        )}
        {appt.conversation_id && (
          <Link
            href={`/inbox/${appt.conversation_id}`}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <MessageCircle className="h-3 w-3" aria-hidden="true" />
            Chat
          </Link>
        )}
      </div>

      {active && (
        <div className="flex flex-wrap gap-1">
          {appt.status === "booked" && (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                run(
                  () => setAppointmentStatus(workspaceId, appt.id, "confirmed"),
                  "Cita confirmada",
                )
              }
            >
              Confirmar
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              run(
                () => setAppointmentStatus(workspaceId, appt.id, "completed"),
                "Marcada como hecha",
              )
            }
          >
            Hecha
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              run(
                () => setAppointmentStatus(workspaceId, appt.id, "no_show"),
                "Marcada como no presentada",
              )
            }
          >
            No vino
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => setMoving((v) => !v)}
          >
            Mover
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            disabled={pending}
            onClick={() => {
              if (!confirm("¿Cancelar esta cita?")) return;
              run(
                () => cancelAppointmentFromPanel(workspaceId, appt.id),
                "Cita cancelada",
              );
            }}
          >
            Cancelar
          </Button>
        </div>
      )}

      {active && moving && (
        <div className="flex flex-wrap items-end gap-2 border-t border-border/60 pt-2">
          <Input
            type="date"
            className="h-8 w-auto"
            value={move.date}
            onChange={(e) => setMove({ ...move, date: e.target.value })}
            aria-label="Nuevo día"
          />
          <Input
            type="time"
            step={300}
            className="h-8 w-auto"
            value={move.time}
            onChange={(e) => setMove({ ...move, time: e.target.value })}
            aria-label="Nueva hora"
          />
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const res = await moveAppointmentFromPanel(workspaceId, appt.id, move);
                if (res.ok) setMoving(false);
                return res;
              }, "Cita movida")
            }
          >
            Guardar
          </Button>
        </div>
      )}
    </li>
  );
}

// ── Tablero semanal ───────────────────────────────────────────────────────────

export function AgendaBoard({
  workspaceId,
  config,
  weekStart,
  today,
  appointments,
}: Props) {
  const [staffFilter, setStaffFilter] = useState("");
  const [showCancelled, setShowCancelled] = useState(false);
  const [creating, setCreating] = useState(false);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, AppointmentRow[]>();
    for (const a of appointments) {
      if (staffFilter && a.staff_id !== staffFilter) continue;
      if (!showCancelled && a.status === "cancelled") continue;
      const d = localParts(new Date(a.scheduled_at), config.timeZone).date;
      map.set(d, [...(map.get(d) ?? []), a]);
    }
    return map;
  }, [appointments, staffFilter, showCancelled, config.timeZone]);

  const activeCount = appointments.filter(
    (a) => a.status === "booked" || a.status === "confirmed",
  ).length;
  const rangeLabel = `${formatDayLabel(days[0])} – ${formatDayLabel(days[6])}`;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-foreground">
            Agenda
          </h1>
          <p className="text-sm text-muted-foreground">
            {rangeLabel} · {activeCount} cita(s) activas
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/agenda?date=${addDays(weekStart, -7)}`}>
            <Button variant="ghost" size="sm" aria-label="Semana anterior">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
          </Link>
          <Link href="/agenda">
            <Button variant="outline" size="sm">
              Hoy
            </Button>
          </Link>
          <Link href={`/agenda?date=${addDays(weekStart, 7)}`}>
            <Button variant="ghost" size="sm" aria-label="Semana siguiente">
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </Link>
          <Button size="sm" onClick={() => setCreating((v) => !v)}>
            <CalendarPlus className="h-4 w-4" aria-hidden="true" />
            Nueva cita
          </Button>
        </div>
      </div>

      {creating && (
        <NewAppointmentForm
          workspaceId={workspaceId}
          config={config}
          defaultDate={days.includes(today) ? today : weekStart}
          onDone={() => setCreating(false)}
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        {config.staff.length > 1 && (
          <select
            className={cn(selectClass, "w-auto")}
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            aria-label="Filtrar por profesional"
          >
            <option value="">Todos los profesionales</option>
            {config.staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={showCancelled}
            onChange={(e) => setShowCancelled(e.target.checked)}
          />
          Ver canceladas
        </label>
      </div>

      {config.staff.length === 0 && (
        <div className="rounded-lg border border-dashed border-border/60 p-6 text-center">
          <CalendarCheck
            className="mx-auto mb-2 h-6 w-6 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-sm font-medium">Tu agenda aún no está configurada</p>
          <p className="mb-3 text-sm text-muted-foreground">
            Añade servicios, profesionales y horario para empezar a recibir citas.
          </p>
          <Link href="/settings">
            <Button size="sm">Configurar agenda</Button>
          </Link>
        </div>
      )}

      <div className="space-y-6">
        {days.map((d) => {
          const list = byDay.get(d) ?? [];
          return (
            <section key={d} className="space-y-2">
              <h2
                className={cn(
                  "text-sm font-semibold first-letter:uppercase",
                  d === today ? "text-primary" : "text-foreground",
                )}
              >
                {formatDayLabel(d)}
                {d === today ? " · hoy" : ""}
              </h2>
              {list.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin citas</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((a) => (
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
          );
        })}
      </div>
    </div>
  );
}
