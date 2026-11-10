/**
 * agenda.ts — tools del calendario propio (sin HighLevel).
 *
 * Flujo previsto para el agente:
 *   agenda_services → agenda_slots → (el cliente confirma) → agenda_book
 *   agenda_my_appointments → agenda_cancel / agenda_reschedule
 *
 * Identidad: workspace y contacto vienen del ToolContext (servidor), nunca del
 * modelo, así que un cliente solo puede ver, cancelar o cambiar SUS citas.
 */

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../core/tool";
import {
  bookingDb,
  cancelAppointment,
  createAppointment,
  findSlots,
  listUpcomingForContact,
  loadBookingConfig,
  rescheduleAppointment,
  staffForService,
} from "@/features/booking/services/booking-service";
import { summarizeSlots } from "@/features/booking/lib/availability";
import {
  addDays,
  daysBetween,
  formatDayLabel,
  formatHuman,
  isDateString,
  localParts,
  parseStart,
  timeToMinutes,
  toLocalIso,
} from "@/features/booking/lib/time";
import type { AppointmentRow, BookingConfig } from "@/features/booking/types";

const MAX_DAYS_PER_QUERY = 14;
const MAX_TIMES_PER_DAY = 40;

function err(error: string): ToolResult {
  return { ok: false, output: null, error };
}

/** Normaliza para comparar nombres: minúsculas y sin tildes. */
function norm(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Los modelos a veces pasan el nombre ("Miguel", "Corte") en vez del ID.
 * Aceptamos ambos para que una reserva no falle por eso.
 */
function resolveServiceId(config: BookingConfig, value: string): string {
  const active = config.services.filter((s) => s.active);
  if (active.some((s) => s.id === value)) return value;
  const byName = active.find((s) => norm(s.name) === norm(value));
  if (byName) return byName.id;
  // Con un solo servicio activo no hay ambigüedad posible.
  return active.length === 1 ? active[0].id : value;
}

function resolveStaffId(
  config: BookingConfig,
  value: string | undefined,
): string | undefined {
  if (!value) return undefined;
  if (config.staff.some((s) => s.id === value)) return value;
  const byName = config.staff.find((s) => norm(s.name) === norm(value));
  // Si no se reconoce, mejor no filtrar por profesional que fallar.
  return byName?.id;
}

function describeAppointment(a: AppointmentRow, config: BookingConfig) {
  const service = config.services.find((s) => s.id === a.service_id);
  const staff = config.staff.find((s) => s.id === a.staff_id);
  const start = new Date(a.scheduled_at);
  return {
    appointment_id: a.id,
    cuando: formatHuman(start, config.timeZone),
    inicio_iso: toLocalIso(start, config.timeZone),
    servicio: service?.name ?? null,
    duracion_min: service?.duration_min ?? null,
    profesional: staff?.name ?? null,
    estado: a.status,
  };
}

// ── agenda_services ───────────────────────────────────────────────────────────

const servicesSchema = z.object({});

async function runServices(
  _args: z.infer<typeof servicesSchema>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const config = await loadBookingConfig(bookingDb(), ctx.workspaceId);
  const services = config.services.filter((s) => s.active);
  if (services.length === 0) {
    return err("La agenda todavía no tiene servicios configurados");
  }
  return {
    ok: true,
    output: {
      zona_horaria: config.timeZone,
      servicios: services.map((s) => ({
        service_id: s.id,
        nombre: s.name,
        duracion_min: s.duration_min,
        precio: s.price,
        descripcion: s.description,
        profesionales: staffForService(config, s.id).map((p) => ({
          staff_id: p.id,
          nombre: p.name,
        })),
      })),
    },
  };
}

export const agendaServicesTool: Tool<z.infer<typeof servicesSchema>> = {
  name: "agenda_services",
  description:
    "Lista los servicios que se pueden reservar (con duración, precio y qué profesionales los hacen). Úsala antes de buscar huecos para obtener el service_id correcto.",
  sensitivity: "read",
  schema: servicesSchema,
  enabledFor: () => true,
  run: runServices,
};

// ── agenda_slots ──────────────────────────────────────────────────────────────

const slotsSchema = z.object({
  service_id: z.string().describe("ID del servicio (de agenda_services)"),
  date_from: z
    .string()
    .describe("Primer día a consultar, formato YYYY-MM-DD (hora local del negocio)"),
  date_to: z
    .string()
    .optional()
    .describe("Último día a consultar (YYYY-MM-DD, inclusive). Por defecto, 3 días."),
  staff_id: z
    .string()
    .optional()
    .describe("Solo si el cliente pide un profesional concreto"),
  from_time: z
    .string()
    .optional()
    .describe('Filtra desde esta hora local "HH:MM" (ej: "16:00" si pide por la tarde)'),
  to_time: z
    .string()
    .optional()
    .describe('Filtra hasta esta hora local "HH:MM"'),
});

async function runSlots(
  args: z.infer<typeof slotsSchema>,
  ctx: ToolContext,
): Promise<ToolResult> {
  if (!isDateString(args.date_from)) {
    return err("date_from debe tener formato YYYY-MM-DD");
  }
  const sb = bookingDb();
  const config = await loadBookingConfig(sb, ctx.workspaceId);
  const today = localParts(new Date(), config.timeZone).date;

  const dateFrom = args.date_from < today ? today : args.date_from;
  let dateTo =
    args.date_to && isDateString(args.date_to)
      ? args.date_to
      : addDays(dateFrom, 2);
  if (dateTo < dateFrom) dateTo = dateFrom;
  if (daysBetween(dateFrom, dateTo) >= MAX_DAYS_PER_QUERY) {
    dateTo = addDays(dateFrom, MAX_DAYS_PER_QUERY - 1);
  }

  const res = await findSlots({
    workspaceId: ctx.workspaceId,
    serviceId: resolveServiceId(config, args.service_id),
    dateFrom,
    dateTo,
    staffId: resolveStaffId(config, args.staff_id),
    sb,
    config,
  });
  if (!res.ok) return err(res.error);

  const fromMin = args.from_time ? timeToMinutes(args.from_time) : null;
  const toMin = args.to_time ? timeToMinutes(args.to_time) : null;
  const filtered = res.data.slots.filter((s) => {
    const m = localParts(s.start, config.timeZone).minutes;
    return (fromMin === null || m >= fromMin) && (toMin === null || m <= toMin);
  });

  const isoByKey = new Map<string, string>();
  for (const s of filtered) {
    const p = localParts(s.start, config.timeZone);
    const key = `${p.date} ${p.time}`;
    if (!isoByKey.has(key)) isoByKey.set(key, toLocalIso(s.start, config.timeZone));
  }

  const days = summarizeSlots(
    filtered,
    res.data.staff.map((s) => ({ id: s.id, name: s.name, hours: [] })),
    config.timeZone,
  ).map((d) => ({
    fecha: d.date,
    dia: formatDayLabel(d.date),
    horas: d.times.slice(0, MAX_TIMES_PER_DAY).map((t) => ({
      hora: t.time,
      inicio_iso: isoByKey.get(`${d.date} ${t.time}`),
      profesionales_libres: t.staff,
    })),
  }));

  return {
    ok: true,
    output: {
      servicio: res.data.service.name,
      duracion_min: res.data.service.duration_min,
      rango: { desde: dateFrom, hasta: dateTo },
      dias_con_huecos: days,
      nota:
        days.length === 0
          ? "No hay huecos en ese rango. Prueba otros días o pregunta otra preferencia."
          : "Ofrece al cliente 2 o 3 opciones, no la lista entera. Para reservar usa inicio_iso.",
    },
  };
}

export const agendaSlotsTool: Tool<z.infer<typeof slotsSchema>> = {
  name: "agenda_slots",
  description:
    "Devuelve los huecos libres REALES de la agenda para un servicio en un rango de días. Nunca inventes horas: ofrece solo las que devuelve esta herramienta.",
  sensitivity: "read",
  schema: slotsSchema,
  enabledFor: () => true,
  run: runSlots,
};

// ── agenda_book ───────────────────────────────────────────────────────────────

const bookSchema = z.object({
  service_id: z.string().describe("ID del servicio"),
  start: z
    .string()
    .describe(
      "Inicio de la cita: el inicio_iso de agenda_slots (ej: 2026-11-10T17:30:00+01:00)",
    ),
  staff_id: z
    .string()
    .optional()
    .describe("Profesional elegido (si el cliente pidió uno)"),
  customer_name: z
    .string()
    .optional()
    .describe("Nombre del cliente para la cita"),
  notes: z.string().max(500).optional().describe("Nota breve para el negocio"),
});

async function runBook(
  args: z.infer<typeof bookSchema>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const sb = bookingDb();
  const config = await loadBookingConfig(sb, ctx.workspaceId);
  const start = parseStart(args.start, config.timeZone);
  if (!start) return err("start no es una fecha-hora válida");

  if (!ctx.contactId && !args.customer_name) {
    return err("Falta el nombre del cliente para la cita");
  }

  const res = await createAppointment({
    workspaceId: ctx.workspaceId,
    serviceId: resolveServiceId(config, args.service_id),
    start,
    staffId: resolveStaffId(config, args.staff_id),
    contactId: ctx.contactId || null,
    conversationId: ctx.conversationId || null,
    customerName: args.customer_name,
    notes: args.notes,
    source: "agent",
  });
  if (!res.ok) return err(res.error);

  return {
    ok: true,
    output: {
      reservada: true,
      ...describeAppointment(res.data, config),
      nota: "Confirma al cliente el día, la hora, el servicio y el profesional.",
    },
  };
}

export const agendaBookTool: Tool<z.infer<typeof bookSchema>> = {
  name: "agenda_book",
  description:
    "Reserva la cita en la agenda. Úsala SOLO cuando el cliente haya confirmado servicio, día y hora, usando un inicio_iso devuelto por agenda_slots.",
  sensitivity: "write",
  schema: bookSchema,
  enabledFor: () => true,
  run: runBook,
};

// ── agenda_my_appointments ────────────────────────────────────────────────────

const mineSchema = z.object({});

async function runMine(
  _args: z.infer<typeof mineSchema>,
  ctx: ToolContext,
): Promise<ToolResult> {
  if (!ctx.contactId) {
    return { ok: true, output: { citas: [] } };
  }
  const sb = bookingDb();
  const [config, rows] = await Promise.all([
    loadBookingConfig(sb, ctx.workspaceId),
    listUpcomingForContact(ctx.workspaceId, ctx.contactId),
  ]);
  return {
    ok: true,
    output: { citas: rows.map((r) => describeAppointment(r, config)) },
  };
}

export const agendaMyAppointmentsTool: Tool<z.infer<typeof mineSchema>> = {
  name: "agenda_my_appointments",
  description:
    "Lista las próximas citas del cliente de esta conversación. Úsala antes de cancelar o cambiar una cita para obtener su appointment_id.",
  sensitivity: "read",
  schema: mineSchema,
  enabledFor: () => true,
  run: runMine,
};

// ── agenda_cancel ─────────────────────────────────────────────────────────────

const cancelSchema = z.object({
  appointment_id: z.string().describe("ID de la cita (de agenda_my_appointments)"),
});

async function runCancel(
  args: z.infer<typeof cancelSchema>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const res = await cancelAppointment({
    workspaceId: ctx.workspaceId,
    appointmentId: args.appointment_id,
    contactId: ctx.contactId || null,
  });
  if (!res.ok) return err(res.error);
  const config = await loadBookingConfig(bookingDb(), ctx.workspaceId);
  return {
    ok: true,
    output: { cancelada: true, ...describeAppointment(res.data, config) },
  };
}

export const agendaCancelTool: Tool<z.infer<typeof cancelSchema>> = {
  name: "agenda_cancel",
  description:
    "Cancela una cita del propio cliente. Confirma antes con el cliente qué cita quiere cancelar.",
  sensitivity: "write",
  schema: cancelSchema,
  enabledFor: () => true,
  run: runCancel,
};

// ── agenda_reschedule ─────────────────────────────────────────────────────────

const rescheduleSchema = z.object({
  appointment_id: z.string().describe("ID de la cita a mover"),
  new_start: z
    .string()
    .describe("Nuevo inicio: un inicio_iso devuelto por agenda_slots"),
  staff_id: z.string().optional().describe("Solo si cambia de profesional"),
});

async function runReschedule(
  args: z.infer<typeof rescheduleSchema>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const sb = bookingDb();
  const config = await loadBookingConfig(sb, ctx.workspaceId);
  const newStart = parseStart(args.new_start, config.timeZone);
  if (!newStart) return err("new_start no es una fecha-hora válida");

  const res = await rescheduleAppointment({
    workspaceId: ctx.workspaceId,
    appointmentId: args.appointment_id,
    newStart,
    staffId: resolveStaffId(config, args.staff_id),
    contactId: ctx.contactId || null,
  });
  if (!res.ok) return err(res.error);
  return {
    ok: true,
    output: { cambiada: true, ...describeAppointment(res.data, config) },
  };
}

export const agendaRescheduleTool: Tool<z.infer<typeof rescheduleSchema>> = {
  name: "agenda_reschedule",
  description:
    "Cambia una cita del propio cliente a otro hueco libre. Consulta antes agenda_slots con el service_id de la cita.",
  sensitivity: "write",
  schema: rescheduleSchema,
  enabledFor: () => true,
  run: runReschedule,
};
