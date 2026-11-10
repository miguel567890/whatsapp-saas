"use server";

/**
 * booking-actions.ts — server actions del panel (configuración y agenda).
 *
 * Cada acción verifica que el usuario es miembro activo del workspace y su rol:
 *   configurar la agenda  → admin / manager
 *   gestionar citas       → admin / manager / agent
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  bookingDb,
  cancelAppointment,
  createAppointment,
  getWorkspaceTimeZone,
  rescheduleAppointment,
} from "./booking-service";
import { addDays, parseStart, zonedToUtc } from "../lib/time";

type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

const CONFIG_ROLES = ["admin", "manager"];
const APPOINTMENT_ROLES = ["admin", "manager", "agent"];

async function assertRole(
  workspaceId: string,
  roles: string[],
): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "No autenticado";

  const { data: member } = await supabase
    .from("memberships")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!member) return "Sin acceso a este workspace";
  if (!roles.includes(member.role as string)) return "Permisos insuficientes";
  return null;
}

function revalidate() {
  revalidatePath("/settings");
  revalidatePath("/agenda");
}

const uuid = z.string().uuid();
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora HH:MM");

// ── Ajustes ───────────────────────────────────────────────────────────────────

const settingsSchema = z.object({
  slot_step_min: z.coerce.number().int().min(5).max(120),
  min_notice_min: z.coerce.number().int().min(0).max(10080),
  max_days_ahead: z.coerce.number().int().min(1).max(365),
  reminders_enabled: z.boolean(),
  reminder_hours_before: z.coerce.number().int().min(1).max(168),
  reminder_template_name: z
    .string()
    .trim()
    .max(512)
    .nullable()
    .transform((v) => (v ? v : null)),
  reminder_template_language: z.string().trim().min(2).max(10).default("es"),
});

export async function saveBookingSettings(
  workspaceId: string,
  input: unknown,
): Promise<ActionResult> {
  const denied = await assertRole(workspaceId, CONFIG_ROLES);
  if (denied) return { ok: false, error: denied };
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { error } = await bookingDb()
    .from("booking_settings")
    .upsert({ workspace_id: workspaceId, ...parsed.data });
  if (error) return { ok: false, error: "No se pudieron guardar los ajustes" };
  revalidate();
  return { ok: true, data: null };
}

// ── Servicios ─────────────────────────────────────────────────────────────────

const serviceSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1, "Pon un nombre").max(120),
  description: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  duration_min: z.coerce.number().int().min(5).max(600),
  price: z
    .union([z.coerce.number().min(0).max(100000), z.null()])
    .optional()
    .transform((v) => (v === undefined ? null : v)),
  active: z.boolean().default(true),
  sort_order: z.coerce.number().int().default(0),
});

export async function upsertService(
  workspaceId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const denied = await assertRole(workspaceId, CONFIG_ROLES);
  if (denied) return { ok: false, error: denied };
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { id, ...fields } = parsed.data;
  const sb = bookingDb();
  const query = id
    ? sb
        .from("booking_services")
        .update(fields)
        .eq("id", id)
        .eq("workspace_id", workspaceId)
        .select("id")
        .single()
    : sb
        .from("booking_services")
        .insert({ workspace_id: workspaceId, ...fields })
        .select("id")
        .single();
  const { data, error } = await query;
  if (error || !data) return { ok: false, error: "No se pudo guardar el servicio" };
  revalidate();
  return { ok: true, data: { id: data.id as string } };
}

export async function deleteService(
  workspaceId: string,
  serviceId: string,
): Promise<ActionResult> {
  const denied = await assertRole(workspaceId, CONFIG_ROLES);
  if (denied) return { ok: false, error: denied };
  if (!uuid.safeParse(serviceId).success) return { ok: false, error: "ID no válido" };
  const { error } = await bookingDb()
    .from("booking_services")
    .delete()
    .eq("id", serviceId)
    .eq("workspace_id", workspaceId);
  if (error) return { ok: false, error: "No se pudo borrar el servicio" };
  revalidate();
  return { ok: true, data: null };
}

// ── Profesionales ─────────────────────────────────────────────────────────────

const staffSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1, "Pon un nombre").max(80),
  active: z.boolean().default(true),
  sort_order: z.coerce.number().int().default(0),
  service_ids: z.array(uuid).max(200).default([]),
  hours: z
    .array(
      z
        .object({
          weekday: z.coerce.number().int().min(0).max(6),
          start_time: hhmm,
          end_time: hhmm,
        })
        .refine((h) => h.end_time > h.start_time, {
          message: "La hora de fin debe ser posterior a la de inicio",
        }),
    )
    .max(42)
    .default([]),
});

export async function upsertStaff(
  workspaceId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const denied = await assertRole(workspaceId, CONFIG_ROLES);
  if (denied) return { ok: false, error: denied };
  const parsed = staffSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { id, service_ids, hours, ...fields } = parsed.data;
  const sb = bookingDb();

  let staffId = id;
  if (staffId) {
    const { error } = await sb
      .from("booking_staff")
      .update(fields)
      .eq("id", staffId)
      .eq("workspace_id", workspaceId);
    if (error) return { ok: false, error: "No se pudo guardar el profesional" };
  } else {
    const { data, error } = await sb
      .from("booking_staff")
      .insert({ workspace_id: workspaceId, ...fields })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: "No se pudo crear el profesional" };
    staffId = data.id as string;
  }

  // Solo servicios de este workspace.
  const { data: validServices } = await sb
    .from("booking_services")
    .select("id")
    .eq("workspace_id", workspaceId)
    .in("id", service_ids.length ? service_ids : ["00000000-0000-0000-0000-000000000000"]);
  const allowed = new Set((validServices ?? []).map((s) => s.id as string));

  await sb
    .from("booking_staff_services")
    .delete()
    .eq("staff_id", staffId)
    .eq("workspace_id", workspaceId);
  const links = service_ids
    .filter((s) => allowed.has(s))
    .map((service_id) => ({ workspace_id: workspaceId, staff_id: staffId, service_id }));
  if (links.length) {
    const { error } = await sb.from("booking_staff_services").insert(links);
    if (error) return { ok: false, error: "No se pudieron guardar los servicios" };
  }

  await sb
    .from("booking_hours")
    .delete()
    .eq("staff_id", staffId)
    .eq("workspace_id", workspaceId);
  if (hours.length) {
    const { error } = await sb.from("booking_hours").insert(
      hours.map((h) => ({ ...h, workspace_id: workspaceId, staff_id: staffId })),
    );
    if (error) return { ok: false, error: "No se pudo guardar el horario" };
  }

  revalidate();
  return { ok: true, data: { id: staffId } };
}

export async function deleteStaff(
  workspaceId: string,
  staffId: string,
): Promise<ActionResult> {
  const denied = await assertRole(workspaceId, CONFIG_ROLES);
  if (denied) return { ok: false, error: denied };
  if (!uuid.safeParse(staffId).success) return { ok: false, error: "ID no válido" };
  const { error } = await bookingDb()
    .from("booking_staff")
    .delete()
    .eq("id", staffId)
    .eq("workspace_id", workspaceId);
  if (error) return { ok: false, error: "No se pudo borrar el profesional" };
  revalidate();
  return { ok: true, data: null };
}

// ── Cierres / vacaciones ──────────────────────────────────────────────────────

const timeOffSchema = z.object({
  staff_id: uuid.nullable(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z
    .string()
    .trim()
    .max(200)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
});

/** Cierre de días completos (hora local del negocio), ambos inclusive. */
export async function addTimeOff(
  workspaceId: string,
  input: unknown,
): Promise<ActionResult> {
  const denied = await assertRole(workspaceId, CONFIG_ROLES);
  if (denied) return { ok: false, error: denied };
  const parsed = timeOffSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { staff_id, date_from, date_to, reason } = parsed.data;
  if (date_to < date_from) {
    return { ok: false, error: "La fecha final es anterior a la inicial" };
  }

  const sb = bookingDb();
  const tz = await getWorkspaceTimeZone(sb, workspaceId);
  const { error } = await sb.from("booking_time_off").insert({
    workspace_id: workspaceId,
    staff_id,
    starts_at: zonedToUtc(date_from, 0, tz).toISOString(),
    ends_at: zonedToUtc(addDays(date_to, 1), 0, tz).toISOString(),
    reason,
  });
  if (error) return { ok: false, error: "No se pudo guardar el cierre" };
  revalidate();
  return { ok: true, data: null };
}

export async function deleteTimeOff(
  workspaceId: string,
  timeOffId: string,
): Promise<ActionResult> {
  const denied = await assertRole(workspaceId, CONFIG_ROLES);
  if (denied) return { ok: false, error: denied };
  if (!uuid.safeParse(timeOffId).success) return { ok: false, error: "ID no válido" };
  const { error } = await bookingDb()
    .from("booking_time_off")
    .delete()
    .eq("id", timeOffId)
    .eq("workspace_id", workspaceId);
  if (error) return { ok: false, error: "No se pudo borrar el cierre" };
  revalidate();
  return { ok: true, data: null };
}

// ── Citas (panel) ─────────────────────────────────────────────────────────────

const manualSchema = z.object({
  service_id: uuid,
  staff_id: uuid.nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: hhmm,
  customer_name: z.string().trim().min(1, "Pon el nombre del cliente").max(120),
  customer_phone: z
    .string()
    .trim()
    .max(30)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  notes: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
});

export async function createManualAppointment(
  workspaceId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const denied = await assertRole(workspaceId, APPOINTMENT_ROLES);
  if (denied) return { ok: false, error: denied };
  const parsed = manualSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const p = parsed.data;
  const tz = await getWorkspaceTimeZone(bookingDb(), workspaceId);
  const start = parseStart(`${p.date}T${p.time}`, tz);
  if (!start) return { ok: false, error: "Fecha u hora no válida" };

  const res = await createAppointment({
    workspaceId,
    serviceId: p.service_id,
    staffId: p.staff_id ?? null,
    start,
    customerName: p.customer_name,
    customerPhone: p.customer_phone,
    notes: p.notes,
    source: "manual",
    enforceHours: false,
  });
  if (!res.ok) return { ok: false, error: res.error };
  revalidate();
  return { ok: true, data: { id: res.data.id } };
}

const statusSchema = z.enum(["booked", "confirmed", "completed", "no_show"]);

export async function setAppointmentStatus(
  workspaceId: string,
  appointmentId: string,
  status: unknown,
): Promise<ActionResult> {
  const denied = await assertRole(workspaceId, APPOINTMENT_ROLES);
  if (denied) return { ok: false, error: denied };
  const parsed = statusSchema.safeParse(status);
  if (!parsed.success || !uuid.safeParse(appointmentId).success) {
    return { ok: false, error: "Datos no válidos" };
  }
  const { error } = await bookingDb()
    .from("appointments")
    .update({ status: parsed.data })
    .eq("id", appointmentId)
    .eq("workspace_id", workspaceId);
  if (error) {
    return {
      ok: false,
      error:
        error.code === "23P01"
          ? "Esa hora ya está ocupada por otra cita"
          : "No se pudo cambiar el estado",
    };
  }
  revalidate();
  return { ok: true, data: null };
}

export async function cancelAppointmentFromPanel(
  workspaceId: string,
  appointmentId: string,
): Promise<ActionResult> {
  const denied = await assertRole(workspaceId, APPOINTMENT_ROLES);
  if (denied) return { ok: false, error: denied };
  if (!uuid.safeParse(appointmentId).success) return { ok: false, error: "ID no válido" };
  const res = await cancelAppointment({ workspaceId, appointmentId });
  if (!res.ok) return { ok: false, error: res.error };
  revalidate();
  return { ok: true, data: null };
}

const moveSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: hhmm,
  staff_id: uuid.nullable().optional(),
});

export async function moveAppointmentFromPanel(
  workspaceId: string,
  appointmentId: string,
  input: unknown,
): Promise<ActionResult> {
  const denied = await assertRole(workspaceId, APPOINTMENT_ROLES);
  if (denied) return { ok: false, error: denied };
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success || !uuid.safeParse(appointmentId).success) {
    return { ok: false, error: "Datos no válidos" };
  }
  const tz = await getWorkspaceTimeZone(bookingDb(), workspaceId);
  const start = parseStart(`${parsed.data.date}T${parsed.data.time}`, tz);
  if (!start) return { ok: false, error: "Fecha u hora no válida" };
  const res = await rescheduleAppointment({
    workspaceId,
    appointmentId,
    newStart: start,
    staffId: parsed.data.staff_id ?? null,
    enforceHours: false,
  });
  if (!res.ok) return { ok: false, error: res.error };
  revalidate();
  return { ok: true, data: null };
}
