/**
 * booking-service.ts — lógica de reservas del calendario propio (servidor).
 *
 * Usa el cliente service-role: quien llama (tool del agente, server action del
 * panel o cron) ya ha validado la identidad y el workspace. Todas las consultas
 * filtran por workspace_id explícitamente.
 */

import {
  createClient as createSbClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import {
  computeSlots,
  type BusyBlock,
  type Slot,
  type StaffAvailabilityInput,
} from "../lib/availability";
import {
  addDays,
  localParts,
  safeTimeZone,
} from "../lib/time";
import {
  ACTIVE_STATUSES,
  DEFAULT_BOOKING_SETTINGS,
  type AppointmentRow,
  type BookingConfig,
  type BookingService,
  type BookingSettings,
  type BookingStaff,
  type BookingTimeOff,
} from "../types";

export function bookingDb(): SupabaseClient {
  return createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export type BookingErrorCode =
  | "not_configured"
  | "service_not_found"
  | "staff_not_found"
  | "invalid_date"
  | "slot_unavailable"
  | "not_found"
  | "already_cancelled"
  | "db_error";

export type BookingResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: BookingErrorCode; error: string };

function fail<T>(code: BookingErrorCode, error: string): BookingResult<T> {
  return { ok: false, code, error };
}

// ── Carga de configuración ────────────────────────────────────────────────────

export async function getWorkspaceTimeZone(
  sb: SupabaseClient,
  workspaceId: string,
): Promise<string> {
  const { data } = await sb
    .from("business_info")
    .select("structured")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  const tz = (data?.structured as { timezone?: string } | null)?.timezone;
  return safeTimeZone(tz);
}

export async function loadBookingConfig(
  sb: SupabaseClient,
  workspaceId: string,
): Promise<BookingConfig> {
  const [settingsRes, servicesRes, staffRes, linksRes, hoursRes, offRes, bizRes] =
    await Promise.all([
      sb
        .from("booking_settings")
        .select("*")
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
      sb
        .from("booking_services")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("sort_order")
        .order("name"),
      sb
        .from("booking_staff")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("sort_order")
        .order("name"),
      sb
        .from("booking_staff_services")
        .select("staff_id, service_id")
        .eq("workspace_id", workspaceId),
      sb
        .from("booking_hours")
        .select("id, staff_id, weekday, start_time, end_time")
        .eq("workspace_id", workspaceId)
        .order("weekday")
        .order("start_time"),
      sb
        .from("booking_time_off")
        .select("*")
        .eq("workspace_id", workspaceId)
        .gte("ends_at", new Date(Date.now() - 86400000).toISOString())
        .order("starts_at"),
      sb
        .from("business_info")
        .select("structured")
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
    ]);

  const rawTz = (bizRes.data?.structured as { timezone?: string } | null)
    ?.timezone;
  const tz = safeTimeZone(rawTz);

  const settings: BookingSettings = {
    workspace_id: workspaceId,
    ...DEFAULT_BOOKING_SETTINGS,
    ...((settingsRes.data as Partial<BookingSettings> | null) ?? {}),
  };

  const links = (linksRes.data ?? []) as {
    staff_id: string;
    service_id: string;
  }[];
  const hours = (hoursRes.data ?? []) as BookingStaff["hours"];

  const staff: BookingStaff[] = (
    (staffRes.data ?? []) as Omit<BookingStaff, "service_ids" | "hours">[]
  ).map((s) => ({
    ...s,
    service_ids: links.filter((l) => l.staff_id === s.id).map((l) => l.service_id),
    hours: hours
      .filter((h) => h.staff_id === s.id)
      .map((h) => ({
        ...h,
        start_time: h.start_time.slice(0, 5),
        end_time: h.end_time.slice(0, 5),
      })),
  }));

  const services = ((servicesRes.data ?? []) as BookingService[]).map((s) => ({
    ...s,
    price: s.price === null ? null : Number(s.price),
  }));

  return {
    settings,
    services,
    staff,
    timeOff: (offRes.data ?? []) as BookingTimeOff[],
    timeZone: tz,
    timeZoneSet: !!rawTz && rawTz === tz,
  };
}

/** Profesionales activos que hacen el servicio. Si nadie está asignado, todos los activos. */
export function staffForService(
  config: BookingConfig,
  serviceId: string,
): BookingStaff[] {
  const active = config.staff.filter((s) => s.active);
  const assigned = active.filter((s) => s.service_ids.includes(serviceId));
  return assigned.length > 0 ? assigned : active;
}

async function loadBusy(
  sb: SupabaseClient,
  workspaceId: string,
  from: Date,
  to: Date,
  timeOff: BookingTimeOff[],
  excludeAppointmentId?: string,
): Promise<BusyBlock[]> {
  let q = sb
    .from("appointments")
    .select("id, staff_id, scheduled_at, ends_at")
    .eq("workspace_id", workspaceId)
    .in("status", ACTIVE_STATUSES)
    .not("staff_id", "is", null)
    .lt("scheduled_at", to.toISOString())
    .gt("ends_at", from.toISOString());
  if (excludeAppointmentId) q = q.neq("id", excludeAppointmentId);
  const { data } = await q;

  const busy: BusyBlock[] = (
    (data ?? []) as { staff_id: string; scheduled_at: string; ends_at: string }[]
  ).map((a) => ({
    staffId: a.staff_id,
    start: new Date(a.scheduled_at),
    end: new Date(a.ends_at),
  }));

  for (const t of timeOff) {
    busy.push({
      staffId: t.staff_id,
      start: new Date(t.starts_at),
      end: new Date(t.ends_at),
    });
  }
  return busy;
}

function toAvailabilityStaff(staff: BookingStaff[]): StaffAvailabilityInput[] {
  return staff.map((s) => ({
    id: s.id,
    name: s.name,
    hours: s.hours.map((h) => ({
      weekday: h.weekday,
      start: h.start_time,
      end: h.end_time,
    })),
  }));
}

// ── Huecos libres ─────────────────────────────────────────────────────────────

export interface FindSlotsParams {
  workspaceId: string;
  serviceId: string;
  dateFrom: string;
  dateTo: string;
  staffId?: string | null;
  excludeAppointmentId?: string;
  /** false en el panel: el dueño puede reservar sin antelación mínima ni límite de días. */
  enforceBookingWindow?: boolean;
  /**
   * Margen (min) que se descuenta de la antelación mínima. Al reservar se usa
   * para que una hora ofrecida hace unos minutos no "caduque" mientras el
   * cliente contesta.
   */
  noticeGraceMin?: number;
  sb?: SupabaseClient;
  config?: BookingConfig;
}

export interface FindSlotsResult {
  config: BookingConfig;
  service: BookingService;
  staff: BookingStaff[];
  slots: Slot[];
}

export async function findSlots(
  p: FindSlotsParams,
): Promise<BookingResult<FindSlotsResult>> {
  const sb = p.sb ?? bookingDb();
  const config = p.config ?? (await loadBookingConfig(sb, p.workspaceId));

  const service = config.services.find((s) => s.id === p.serviceId && s.active);
  if (!service) {
    return fail("service_not_found", "Ese servicio no existe o no está activo");
  }

  let staff = staffForService(config, service.id);
  if (p.staffId) {
    staff = staff.filter((s) => s.id === p.staffId);
    if (staff.length === 0) {
      return fail(
        "staff_not_found",
        "Ese profesional no existe, no está activo o no hace este servicio",
      );
    }
  }
  if (staff.length === 0) {
    return fail(
      "not_configured",
      "La agenda no tiene profesionales activos con horario configurado",
    );
  }

  const enforce = p.enforceBookingWindow ?? true;
  const now = Date.now();
  const noticeMin = Math.max(
    0,
    config.settings.min_notice_min - (p.noticeGraceMin ?? 0),
  );
  const notBefore = enforce ? new Date(now + noticeMin * 60000) : new Date(0);
  const notAfter = enforce
    ? new Date(now + config.settings.max_days_ahead * 86400000)
    : new Date(8.64e15);

  // Ventana amplia (±1 día) para cubrir citas que cruzan medianoche y offsets.
  const from = new Date(Date.parse(`${addDays(p.dateFrom, -1)}T00:00:00Z`));
  const to = new Date(Date.parse(`${addDays(p.dateTo, 2)}T00:00:00Z`));
  const busy = await loadBusy(
    sb,
    p.workspaceId,
    from,
    to,
    config.timeOff,
    p.excludeAppointmentId,
  );

  const slots = computeSlots({
    timeZone: config.timeZone,
    dateFrom: p.dateFrom,
    dateTo: p.dateTo,
    durationMin: service.duration_min,
    stepMin: config.settings.slot_step_min,
    notBefore,
    notAfter,
    staff: toAvailabilityStaff(staff),
    busy,
  });

  return { ok: true, data: { config, service, staff, slots } };
}

// ── Crear cita ────────────────────────────────────────────────────────────────

export interface CreateAppointmentParams {
  workspaceId: string;
  serviceId: string;
  start: Date;
  staffId?: string | null;
  contactId?: string | null;
  conversationId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
  source: "agent" | "manual";
  /**
   * true (agente): la hora debe ser un hueco libre dentro del horario.
   * false (panel): solo se exige que el profesional no tenga otra cita a esa hora.
   */
  enforceHours?: boolean;
}

const EXCLUSION_VIOLATION = "23P01";

/** Minutos de margen sobre la antelación mínima al confirmar una reserva. */
const BOOKING_NOTICE_GRACE_MIN = 30;

export async function createAppointment(
  p: CreateAppointmentParams,
): Promise<BookingResult<AppointmentRow>> {
  const sb = bookingDb();
  const config = await loadBookingConfig(sb, p.workspaceId);
  const service = config.services.find((s) => s.id === p.serviceId && s.active);
  if (!service) {
    return fail("service_not_found", "Ese servicio no existe o no está activo");
  }
  if (Number.isNaN(p.start.getTime())) {
    return fail("invalid_date", "Fecha u hora no válida");
  }

  const startMs = p.start.getTime();
  const end = new Date(startMs + service.duration_min * 60000);

  // Idempotencia: si este contacto ya tiene esa misma cita, devolverla
  // (el registro de tools reintenta tras un timeout).
  if (p.contactId) {
    const { data: dup } = await sb
      .from("appointments")
      .select("*")
      .eq("workspace_id", p.workspaceId)
      .eq("contact_id", p.contactId)
      .eq("service_id", service.id)
      .eq("scheduled_at", p.start.toISOString())
      .in("status", ACTIVE_STATUSES)
      .maybeSingle();
    if (dup) return { ok: true, data: dup as AppointmentRow };
  }

  let staffId: string | null = null;
  const enforce = p.enforceHours ?? true;

  if (enforce) {
    const day = localParts(p.start, config.timeZone).date;
    const res = await findSlots({
      workspaceId: p.workspaceId,
      serviceId: service.id,
      dateFrom: day,
      dateTo: day,
      staffId: p.staffId,
      sb,
      config,
      noticeGraceMin: BOOKING_NOTICE_GRACE_MIN,
    });
    if (!res.ok) return res;
    const match = res.data.slots.filter((s) => s.start.getTime() === startMs);
    if (match.length === 0) {
      return fail(
        "slot_unavailable",
        "Esa hora no está libre. Consulta los huecos disponibles y ofrece otra.",
      );
    }
    staffId = match[0].staffId;
  } else {
    const candidates = p.staffId
      ? config.staff.filter((s) => s.id === p.staffId)
      : staffForService(config, service.id);
    if (candidates.length === 0) {
      return fail("staff_not_found", "No hay profesional disponible");
    }
    const busy = await loadBusy(
      sb,
      p.workspaceId,
      new Date(startMs - 86400000),
      new Date(startMs + 86400000),
      [],
    );
    const free = candidates.find(
      (c) =>
        !busy.some(
          (b) =>
            b.staffId === c.id &&
            b.start.getTime() < end.getTime() &&
            startMs < b.end.getTime(),
        ),
    );
    if (!free) {
      return fail(
        "slot_unavailable",
        "Ese profesional ya tiene una cita que se solapa con esa hora",
      );
    }
    staffId = free.id;
  }

  // Nombre y teléfono desde el contacto si no vienen dados.
  let customerName = p.customerName?.trim() || null;
  let customerPhone = p.customerPhone?.trim() || null;
  if (p.contactId) {
    const { data: contact } = await sb
      .from("contacts")
      .select("name, phone")
      .eq("id", p.contactId)
      .eq("workspace_id", p.workspaceId)
      .maybeSingle();
    const c = contact as { name: string | null; phone: string } | null;
    if (c) {
      customerPhone = customerPhone ?? c.phone;
      if (!c.name && customerName) {
        await sb
          .from("contacts")
          .update({ name: customerName })
          .eq("id", p.contactId)
          .eq("workspace_id", p.workspaceId);
      }
      customerName = customerName ?? c.name;
    }
  }

  const { data, error } = await sb
    .from("appointments")
    .insert({
      workspace_id: p.workspaceId,
      contact_id: p.contactId || null,
      conversation_id: p.conversationId || null,
      service_id: service.id,
      staff_id: staffId,
      scheduled_at: p.start.toISOString(),
      ends_at: end.toISOString(),
      status: "booked",
      customer_name: customerName,
      customer_phone: customerPhone,
      notes: p.notes?.trim() || null,
      source: p.source,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === EXCLUSION_VIOLATION) {
      return fail(
        "slot_unavailable",
        "Alguien acaba de reservar esa hora. Ofrece otro hueco.",
      );
    }
    console.error("[booking] insert failed:", error.message);
    return fail("db_error", "No se pudo guardar la cita");
  }
  return { ok: true, data: data as AppointmentRow };
}

// ── Consultar / cancelar / cambiar ────────────────────────────────────────────

export async function listUpcomingForContact(
  workspaceId: string,
  contactId: string,
): Promise<AppointmentRow[]> {
  const { data } = await bookingDb()
    .from("appointments")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("contact_id", contactId)
    .in("status", ACTIVE_STATUSES)
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at")
    .limit(10);
  return (data ?? []) as AppointmentRow[];
}

async function loadOwnAppointment(
  sb: SupabaseClient,
  workspaceId: string,
  appointmentId: string,
  contactId: string | null | undefined,
): Promise<AppointmentRow | null> {
  let q = sb
    .from("appointments")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", appointmentId);
  // Desde el agente solo se tocan las citas del propio contacto.
  if (contactId !== undefined) q = q.eq("contact_id", contactId ?? "");
  const { data } = await q.maybeSingle();
  return (data as AppointmentRow | null) ?? null;
}

export async function cancelAppointment(p: {
  workspaceId: string;
  appointmentId: string;
  /** Pasar desde el agente para limitar a las citas del contacto. */
  contactId?: string | null;
}): Promise<BookingResult<AppointmentRow>> {
  const sb = bookingDb();
  const appt = await loadOwnAppointment(
    sb,
    p.workspaceId,
    p.appointmentId,
    p.contactId,
  );
  if (!appt) return fail("not_found", "No encuentro esa cita");
  if (!ACTIVE_STATUSES.includes(appt.status)) {
    return fail("already_cancelled", "Esa cita ya no está activa");
  }
  const { data, error } = await sb
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", appt.id)
    .eq("workspace_id", p.workspaceId)
    .select("*")
    .single();
  if (error) return fail("db_error", "No se pudo cancelar la cita");
  return { ok: true, data: data as AppointmentRow };
}

export async function rescheduleAppointment(p: {
  workspaceId: string;
  appointmentId: string;
  newStart: Date;
  staffId?: string | null;
  contactId?: string | null;
  enforceHours?: boolean;
}): Promise<BookingResult<AppointmentRow>> {
  const sb = bookingDb();
  const appt = await loadOwnAppointment(
    sb,
    p.workspaceId,
    p.appointmentId,
    p.contactId,
  );
  if (!appt) return fail("not_found", "No encuentro esa cita");
  if (!ACTIVE_STATUSES.includes(appt.status)) {
    return fail("already_cancelled", "Esa cita ya no está activa");
  }
  if (!appt.service_id) {
    return fail("service_not_found", "La cita no tiene servicio asociado");
  }
  if (Number.isNaN(p.newStart.getTime())) {
    return fail("invalid_date", "Fecha u hora no válida");
  }

  const config = await loadBookingConfig(sb, p.workspaceId);
  const service = config.services.find((s) => s.id === appt.service_id);
  if (!service) return fail("service_not_found", "El servicio ya no existe");

  const startMs = p.newStart.getTime();
  const end = new Date(startMs + service.duration_min * 60000);
  let staffId: string | null = p.staffId ?? null;

  if (p.enforceHours ?? true) {
    const day = localParts(p.newStart, config.timeZone).date;
    const res = await findSlots({
      workspaceId: p.workspaceId,
      serviceId: service.id,
      dateFrom: day,
      dateTo: day,
      staffId: p.staffId,
      excludeAppointmentId: appt.id,
      sb,
      config,
      noticeGraceMin: BOOKING_NOTICE_GRACE_MIN,
    });
    if (!res.ok) return res;
    const match = res.data.slots.filter((s) => s.start.getTime() === startMs);
    if (match.length === 0) {
      return fail(
        "slot_unavailable",
        "Esa hora no está libre. Consulta los huecos disponibles y ofrece otra.",
      );
    }
    // Mantener al mismo profesional si sigue libre.
    staffId =
      match.find((m) => m.staffId === appt.staff_id)?.staffId ??
      match[0].staffId;
  } else {
    staffId = staffId ?? appt.staff_id;
  }

  const { data, error } = await sb
    .from("appointments")
    .update({
      scheduled_at: p.newStart.toISOString(),
      ends_at: end.toISOString(),
      staff_id: staffId,
      status: "booked",
      reminder_sent_at: null,
    })
    .eq("id", appt.id)
    .eq("workspace_id", p.workspaceId)
    .select("*")
    .single();

  if (error) {
    if (error.code === EXCLUSION_VIOLATION) {
      return fail("slot_unavailable", "Esa hora acaba de ocuparse");
    }
    return fail("db_error", "No se pudo cambiar la cita");
  }
  return { ok: true, data: data as AppointmentRow };
}

export async function listAppointmentsBetween(
  workspaceId: string,
  from: Date,
  to: Date,
): Promise<AppointmentRow[]> {
  const { data } = await bookingDb()
    .from("appointments")
    .select("*")
    .eq("workspace_id", workspaceId)
    .gte("scheduled_at", from.toISOString())
    .lt("scheduled_at", to.toISOString())
    .order("scheduled_at");
  return (data ?? []) as AppointmentRow[];
}
