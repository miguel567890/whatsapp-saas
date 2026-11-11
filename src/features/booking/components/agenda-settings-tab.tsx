"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarOff,
  Clock,
  Copy,
  ExternalLink,
  Globe,
  Plus,
  Save,
  Scissors,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  addTimeOff,
  deleteService,
  savePublicPage,
  deleteStaff,
  deleteTimeOff,
  saveBookingSettings,
  upsertService,
  upsertStaff,
} from "../services/booking-actions";
import { PUBLIC_SITE_URL, slugify } from "../lib/public-slug";
import type {
  BookingConfig,
  BookingHoursRow,
  BookingService,
  BookingStaff,
} from "../types";

// Lunes primero, como se lee en España.
const WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

interface Props {
  workspaceId: string;
  initialConfig: BookingConfig;
  businessName?: string | null;
  /** Vista del negocio: oculta referencias a la configuración técnica. */
  simple?: boolean;
}

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-md bg-muted p-2">
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-display text-base font-semibold text-foreground">
            {title}
          </h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

// ── Ajustes generales ─────────────────────────────────────────────────────────

function SettingsForm({ workspaceId, initialConfig }: Props) {
  const s = initialConfig.settings;
  const [form, setForm] = useState({
    slot_step_min: String(s.slot_step_min),
    min_notice_min: String(s.min_notice_min),
    max_days_ahead: String(s.max_days_ahead),
    reminders_enabled: s.reminders_enabled,
    reminder_hours_before: String(s.reminder_hours_before),
    reminder_template_name: s.reminder_template_name ?? "",
    reminder_template_language: s.reminder_template_language,
  });
  const [pending, start] = useTransition();
  const router = useRouter();

  function save() {
    start(async () => {
      const res = await saveBookingSettings(workspaceId, {
        ...form,
        reminder_template_name: form.reminder_template_name || null,
      });
      if (res.ok) {
        toast.success("Ajustes de agenda guardados");
        router.refresh();
      }
      else toast.error(res.error);
    });
  }

  const field = (key: keyof typeof form, label: string, hint?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`bs-${key}`}>{label}</Label>
      <Input
        id={`bs-${key}`}
        inputMode="numeric"
        value={form[key] as string}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );

  return (
    <Section
      icon={Clock}
      title="Ajustes de la agenda"
      description={`Zona horaria: ${initialConfig.timeZone} (se cambia en la pestaña Negocio).`}
    >
      {initialConfig.timeZoneSet === false && (
        <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          No has elegido zona horaria en la pestaña <strong>Negocio</strong>. Hazlo
          antes de activar la agenda: si no, el agente puede calcular mal las horas.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        {field("slot_step_min", "Cada cuántos minutos", "Ej: 15 → 10:00, 10:15…")}
        {field("min_notice_min", "Antelación mínima (min)", "60 = no reservar con menos de 1 h")}
        {field("max_days_ahead", "Días vista", "Hasta cuántos días se puede reservar")}
      </div>

      <div className="space-y-4 rounded-lg border border-border/60 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Recordatorio por WhatsApp</p>
            <p className="text-xs text-muted-foreground">
              Se envía antes de cada cita. Si la conversación lleva más de 24 h
              sin mensajes, WhatsApp exige una plantilla aprobada.
            </p>
          </div>
          <Switch
            checked={form.reminders_enabled}
            onCheckedChange={(v) => setForm({ ...form, reminders_enabled: v })}
            aria-label="Activar recordatorios"
          />
        </div>
        {form.reminders_enabled && (
          <div className="grid gap-4 sm:grid-cols-3">
            {field("reminder_hours_before", "Horas antes")}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="bs-tpl">Plantilla (fuera de 24 h)</Label>
              <Input
                id="bs-tpl"
                placeholder="recordatorio_cita"
                value={form.reminder_template_name}
                onChange={(e) =>
                  setForm({ ...form, reminder_template_name: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Variables del cuerpo: {"{{1}}"} nombre, {"{{2}}"} servicio,{" "}
                {"{{3}}"} fecha, {"{{4}}"} hora.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={pending}>
          <Save className="h-4 w-4" aria-hidden="true" />
          Guardar ajustes
        </Button>
      </div>
    </Section>
  );
}

// ── Servicios ─────────────────────────────────────────────────────────────────

interface ServiceDraft {
  id?: string;
  name: string;
  duration_min: string;
  price: string;
  description: string;
  active: boolean;
}

function toDraft(s?: BookingService): ServiceDraft {
  return {
    id: s?.id,
    name: s?.name ?? "",
    duration_min: String(s?.duration_min ?? 30),
    price: s?.price === null || s?.price === undefined ? "" : String(s.price),
    description: s?.description ?? "",
    active: s?.active ?? true,
  };
}

function ServicesSection({
  workspaceId,
  services,
}: {
  workspaceId: string;
  services: BookingService[];
}) {
  const [draft, setDraft] = useState<ServiceDraft | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function save() {
    if (!draft) return;
    start(async () => {
      const res = await upsertService(workspaceId, {
        id: draft.id,
        name: draft.name,
        duration_min: draft.duration_min,
        price: draft.price.trim() === "" ? null : draft.price.replace(",", "."),
        description: draft.description || null,
        active: draft.active,
      });
      if (res.ok) {
        toast.success("Servicio guardado");
        setDraft(null);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function remove(id: string) {
    if (!confirm("¿Borrar este servicio? Las citas ya hechas se conservan.")) return;
    start(async () => {
      const res = await deleteService(workspaceId, id);
      if (res.ok) {
        toast.success("Servicio borrado");
        router.refresh();
      }
      else toast.error(res.error);
    });
  }

  return (
    <Section
      icon={Scissors}
      title="Servicios"
      description="Lo que se puede reservar. La duración decide cuánto ocupa en la agenda."
    >
      {services.length === 0 && !draft && (
        <p className="rounded-lg border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
          Aún no hay servicios. Añade el primero (por ejemplo: Corte de pelo, 30 min).
        </p>
      )}

      <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
        {services.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {s.name}{" "}
                {!s.active && (
                  <Badge variant="outline" className="ml-1 text-xs">
                    inactivo
                  </Badge>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {s.duration_min} min
                {s.price !== null ? ` · ${s.price.toFixed(2)} €` : ""}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button variant="ghost" size="sm" onClick={() => setDraft(toDraft(s))}>
                Editar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => remove(s.id)}
                aria-label={`Borrar ${s.name}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {draft ? (
        <div className="space-y-4 rounded-lg border border-border/60 p-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="svc-name">Nombre</Label>
              <Input
                id="svc-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Corte de pelo"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="svc-dur">Duración (min)</Label>
              <Input
                id="svc-dur"
                inputMode="numeric"
                value={draft.duration_min}
                onChange={(e) => setDraft({ ...draft, duration_min: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="svc-price">Precio (€)</Label>
              <Input
                id="svc-price"
                inputMode="decimal"
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                placeholder="Opcional"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="svc-desc">Descripción para el agente</Label>
            <Input
              id="svc-desc"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="Opcional: incluye lavado, no incluye peinado…"
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={draft.active}
                onCheckedChange={(v) => setDraft({ ...draft, active: v })}
              />
              Activo
            </label>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setDraft(null)}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={pending}>
                Guardar servicio
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setDraft(toDraft())}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Añadir servicio
        </Button>
      )}
    </Section>
  );
}

// ── Profesionales ─────────────────────────────────────────────────────────────

interface StaffDraft {
  id?: string;
  name: string;
  active: boolean;
  service_ids: string[];
  hours: Omit<BookingHoursRow, "staff_id" | "id">[];
}

const DEFAULT_HOURS: StaffDraft["hours"] = [1, 2, 3, 4, 5].flatMap((d) => [
  { weekday: d, start_time: "10:00", end_time: "14:00" },
  { weekday: d, start_time: "17:00", end_time: "20:30" },
]).concat([{ weekday: 6, start_time: "10:00", end_time: "14:00" }]);

function staffDraft(s?: BookingStaff): StaffDraft {
  return {
    id: s?.id,
    name: s?.name ?? "",
    active: s?.active ?? true,
    service_ids: s?.service_ids ?? [],
    hours: s
      ? s.hours.map((h) => ({
          weekday: h.weekday,
          start_time: h.start_time,
          end_time: h.end_time,
        }))
      : DEFAULT_HOURS,
  };
}

function HoursEditor({
  hours,
  onChange,
}: {
  hours: StaffDraft["hours"];
  onChange: (h: StaffDraft["hours"]) => void;
}) {
  function update(index: number, patch: Partial<StaffDraft["hours"][number]>) {
    onChange(hours.map((h, i) => (i === index ? { ...h, ...patch } : h)));
  }

  function copyMondayToWeekdays() {
    const monday = hours.filter((h) => h.weekday === 1);
    if (monday.length === 0) {
      toast.error("Primero pon el horario del lunes");
      return;
    }
    const rest = hours.filter((h) => h.weekday === 0 || h.weekday === 6);
    const copied = [1, 2, 3, 4, 5].flatMap((d) =>
      monday.map((m) => ({ ...m, weekday: d })),
    );
    onChange([...copied, ...rest]);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Horario semanal</Label>
        <Button variant="ghost" size="sm" onClick={copyMondayToWeekdays}>
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          Copiar lunes a L–V
        </Button>
      </div>
      <div className="divide-y divide-border/60 rounded-lg border border-border/60">
        {WEEKDAYS.map((day) => {
          const ranges = hours
            .map((h, i) => ({ ...h, i }))
            .filter((h) => h.weekday === day.value);
          return (
            <div
              key={day.value}
              className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center"
            >
              <span
                className={cn(
                  "w-24 shrink-0 text-sm",
                  ranges.length === 0 && "text-muted-foreground",
                )}
              >
                {day.label}
              </span>
              <div className="flex flex-1 flex-wrap items-center gap-2">
                {ranges.length === 0 && (
                  <span className="text-xs text-muted-foreground">Cerrado</span>
                )}
                {ranges.map((r) => (
                  <div key={r.i} className="flex items-center gap-1">
                    <Input
                      type="time"
                      className="h-8 w-[6.5rem]"
                      value={r.start_time}
                      onChange={(e) => update(r.i, { start_time: e.target.value })}
                      aria-label={`${day.label} inicio`}
                    />
                    <span className="text-xs text-muted-foreground">–</span>
                    <Input
                      type="time"
                      className="h-8 w-[6.5rem]"
                      value={r.end_time}
                      onChange={(e) => update(r.i, { end_time: e.target.value })}
                      aria-label={`${day.label} fin`}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onChange(hours.filter((_, i) => i !== r.i))}
                      aria-label={`Quitar tramo del ${day.label}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    onChange([
                      ...hours,
                      {
                        weekday: day.value,
                        start_time: ranges.length ? "17:00" : "10:00",
                        end_time: ranges.length ? "20:00" : "14:00",
                      },
                    ])
                  }
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Tramo
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StaffSection({
  workspaceId,
  staff,
  services,
}: {
  workspaceId: string;
  staff: BookingStaff[];
  services: BookingService[];
}) {
  const [draft, setDraft] = useState<StaffDraft | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function save() {
    if (!draft) return;
    start(async () => {
      const res = await upsertStaff(workspaceId, draft);
      if (res.ok) {
        toast.success("Profesional guardado");
        setDraft(null);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function remove(id: string) {
    if (!confirm("¿Borrar este profesional y su horario?")) return;
    start(async () => {
      const res = await deleteStaff(workspaceId, id);
      if (res.ok) {
        toast.success("Profesional borrado");
        router.refresh();
      }
      else toast.error(res.error);
    });
  }

  const summary = (s: BookingStaff) => {
    const days = WEEKDAYS.filter((d) => s.hours.some((h) => h.weekday === d.value))
      .map((d) => d.label.slice(0, 2))
      .join(" ");
    return days || "sin horario";
  };

  return (
    <Section
      icon={UserRound}
      title="Profesionales"
      description="Cada uno con su horario. Si no marcas servicios, hace todos."
    >
      {staff.length === 0 && !draft && (
        <p className="rounded-lg border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
          Añade al menos un profesional con horario; sin él el agente no puede
          ofrecer huecos. En un negocio de una persona, ponte a ti mismo.
        </p>
      )}

      <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
        {staff.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {s.name}{" "}
                {!s.active && (
                  <Badge variant="outline" className="ml-1 text-xs">
                    inactivo
                  </Badge>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {summary(s)} ·{" "}
                {s.service_ids.length === 0
                  ? "todos los servicios"
                  : `${s.service_ids.length} servicio(s)`}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button variant="ghost" size="sm" onClick={() => setDraft(staffDraft(s))}>
                Editar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => remove(s.id)}
                aria-label={`Borrar ${s.name}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {draft ? (
        <div className="space-y-4 rounded-lg border border-border/60 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="staff-name">Nombre</Label>
              <Input
                id="staff-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Ana"
              />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <Switch
                checked={draft.active}
                onCheckedChange={(v) => setDraft({ ...draft, active: v })}
              />
              Activo
            </label>
          </div>

          {services.length > 0 && (
            <div className="space-y-2">
              <Label>Servicios que hace</Label>
              <div className="flex flex-wrap gap-2">
                {services.map((svc) => {
                  const on = draft.service_ids.includes(svc.id);
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          service_ids: on
                            ? draft.service_ids.filter((x) => x !== svc.id)
                            : [...draft.service_ids, svc.id],
                        })
                      }
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition-colors",
                        on
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border/60 text-muted-foreground hover:text-foreground",
                      )}
                      aria-pressed={on}
                    >
                      {svc.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <HoursEditor
            hours={draft.hours}
            onChange={(hours) => setDraft({ ...draft, hours })}
          />

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={pending}>
              Guardar profesional
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setDraft(staffDraft())}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Añadir profesional
        </Button>
      )}
    </Section>
  );
}

// ── Cierres ───────────────────────────────────────────────────────────────────

function TimeOffSection({ workspaceId, initialConfig }: Props) {
  const [form, setForm] = useState({
    staff_id: "",
    date_from: "",
    date_to: "",
    reason: "",
  });
  const [pending, start] = useTransition();
  const router = useRouter();
  const staffName = useMemo(
    () => new Map(initialConfig.staff.map((s) => [s.id, s.name])),
    [initialConfig.staff],
  );
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("es-ES", {
      timeZone: initialConfig.timeZone,
      day: "numeric",
      month: "short",
    }).format(new Date(iso));

  function add() {
    start(async () => {
      const res = await addTimeOff(workspaceId, {
        staff_id: form.staff_id || null,
        date_from: form.date_from,
        date_to: form.date_to || form.date_from,
        reason: form.reason || null,
      });
      if (res.ok) {
        toast.success("Cierre añadido");
        router.refresh();
        setForm({ staff_id: "", date_from: "", date_to: "", reason: "" });
      } else toast.error(res.error);
    });
  }

  function remove(id: string) {
    start(async () => {
      const res = await deleteTimeOff(workspaceId, id);
      if (res.ok) {
        toast.success("Cierre borrado");
        router.refresh();
      }
      else toast.error(res.error);
    });
  }

  return (
    <Section
      icon={CalendarOff}
      title="Cierres y vacaciones"
      description="Días en que no se puede reservar: festivos, vacaciones o la baja de un profesional."
    >
      {initialConfig.timeOff.length > 0 && (
        <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
          {initialConfig.timeOff.map((t) => {
            const lastDay = new Date(new Date(t.ends_at).getTime() - 1);
            return (
              <li key={t.id} className="flex items-center justify-between gap-3 p-3">
                <div className="text-sm">
                  <span className="font-medium">
                    {fmt(t.starts_at)} – {fmt(lastDay.toISOString())}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    · {t.staff_id ? staffName.get(t.staff_id) ?? "Profesional" : "Todo el negocio"}
                    {t.reason ? ` · ${t.reason}` : ""}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(t.id)}
                  aria-label="Borrar cierre"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="grid gap-4 rounded-lg border border-border/60 p-4 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="off-from">Desde</Label>
          <Input
            id="off-from"
            type="date"
            value={form.date_from}
            onChange={(e) => setForm({ ...form, date_from: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="off-to">Hasta (incluido)</Label>
          <Input
            id="off-to"
            type="date"
            value={form.date_to}
            onChange={(e) => setForm({ ...form, date_to: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="off-staff">Quién</Label>
          <select
            id="off-staff"
            className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
            value={form.staff_id}
            onChange={(e) => setForm({ ...form, staff_id: e.target.value })}
          >
            <option value="">Todo el negocio</option>
            {initialConfig.staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="off-reason">Motivo</Label>
          <Input
            id="off-reason"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            placeholder="Opcional"
          />
        </div>
        <div className="sm:col-span-4 flex justify-end">
          <Button variant="outline" onClick={add} disabled={pending || !form.date_from}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Añadir cierre
          </Button>
        </div>
      </div>
    </Section>
  );
}

// ── Página de reservas pública ────────────────────────────────────────────────

function PublicPageSection({ workspaceId, initialConfig, businessName }: Props) {
  const s = initialConfig.settings;
  const [enabled, setEnabled] = useState(s.public_enabled);
  const [slug, setSlug] = useState(
    s.public_slug ?? (businessName ? slugify(businessName) : ""),
  );
  const [intro, setIntro] = useState(s.public_intro ?? "");
  const [pending, start] = useTransition();
  const router = useRouter();
  const savedUrl =
    s.public_enabled && s.public_slug ? `${PUBLIC_SITE_URL}/${s.public_slug}` : null;

  function save() {
    start(async () => {
      const res = await savePublicPage(workspaceId, {
        enabled,
        slug: slugify(slug),
        intro: intro || null,
      });
      if (res.ok) {
        toast.success(enabled ? "Página de reservas publicada" : "Página de reservas guardada");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <Section
      icon={Globe}
      title="Página de reservas"
      description="Un enlace para que tus clientes reserven solos, sin escribir a nadie. Ponlo en Instagram, Google Maps o en un QR."
    >
      {savedUrl && (
        <div className="flex flex-col gap-2 rounded-lg border border-success/40 bg-success/10 p-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="truncate font-mono text-sm">{savedUrl}</span>
          <div className="flex shrink-0 gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void navigator.clipboard?.writeText(savedUrl);
                toast.success("Enlace copiado");
              }}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              Copiar
            </Button>
            <a href={savedUrl} target="_blank" rel="noreferrer">
              <Button variant="ghost" size="sm">
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                Abrir
              </Button>
            </a>
          </div>
        </div>
      )}

      <div className="space-y-4 rounded-lg border border-border/60 p-4">
        <label className="flex items-center justify-between gap-4">
          <span>
            <span className="block text-sm font-medium">Página activa</span>
            <span className="text-xs text-muted-foreground">
              Si la desactivas, el enlace deja de funcionar.
            </span>
          </span>
          <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Activar página de reservas" />
        </label>

        <div className="space-y-1.5">
          <Label htmlFor="pp-slug">Enlace</Label>
          <div className="flex items-center overflow-hidden rounded-md border border-input">
            <span className="shrink-0 bg-muted px-3 py-2 text-sm text-muted-foreground">
              {PUBLIC_SITE_URL.replace(/^https?:\/\//, "")}/
            </span>
            <input
              id="pp-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              onBlur={() => setSlug(slugify(slug))}
              placeholder="barberia-juan"
              className="h-9 min-w-0 flex-1 bg-transparent px-2 text-sm outline-none"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Solo minúsculas, números y guiones. Ej: barberia-juan
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pp-intro">Texto de bienvenida (opcional)</Label>
          <Input
            id="pp-intro"
            value={intro}
            maxLength={300}
            onChange={(e) => setIntro(e.target.value)}
            placeholder="Barbería en el centro de Chiclana. ¡Te esperamos!"
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={pending}>
            <Save className="h-4 w-4" aria-hidden="true" />
            Guardar página
          </Button>
        </div>
      </div>
    </Section>
  );
}

// ── Pestaña completa ──────────────────────────────────────────────────────────

export function AgendaSettingsTab({
  workspaceId,
  initialConfig,
  businessName,
  simple = false,
}: Props) {
  const ready =
    initialConfig.services.some((s) => s.active) &&
    initialConfig.staff.some((s) => s.active && s.hours.length > 0);

  return (
    <div className="space-y-10">
      <div
        className={cn(
          "rounded-lg border p-4 text-sm",
          ready
            ? "border-success/40 bg-success/10"
            : "border-warning/40 bg-warning/10",
        )}
      >
        {ready && simple ? (
          <>La agenda está lista: tus clientes ya pueden pedir cita.</>
        ) : ready ? (
          <>
            La agenda está lista. Activa las tools <strong>Agenda</strong> en la
            pestaña Tools para que el agente pueda reservar.
          </>
        ) : (
          <>
            Para que el agente pueda reservar necesitas al menos{" "}
            <strong>un servicio</strong> y <strong>un profesional con horario</strong>.
          </>
        )}
      </div>

      <ServicesSection workspaceId={workspaceId} services={initialConfig.services} />
      <StaffSection
        workspaceId={workspaceId}
        staff={initialConfig.staff}
        services={initialConfig.services}
      />
      <PublicPageSection
        workspaceId={workspaceId}
        initialConfig={initialConfig}
        businessName={businessName}
      />
      <TimeOffSection workspaceId={workspaceId} initialConfig={initialConfig} />
      <SettingsForm workspaceId={workspaceId} initialConfig={initialConfig} />
    </div>
  );
}
