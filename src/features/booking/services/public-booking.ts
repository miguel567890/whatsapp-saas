/**
 * public-booking.ts — lógica de la página de reservas pública (servidor).
 *
 * Expone solo lo imprescindible de un negocio con la página activada:
 * nombre, servicios activos, nombres de profesionales y huecos libres.
 * Nunca devuelve citas, contactos ni nada de otros negocios.
 */

import { after } from "next/server";
import { sendBookingConfirmation } from "./booking-notify";
import {
  bookingDb,
  createAppointment,
  findSlots,
  loadBookingConfig,
  staffForService,
} from "./booking-service";
import { summarizeSlots } from "../lib/availability";
import {
  addDays,
  formatDayLabel,
  formatHuman,
  localParts,
  parseStart,
} from "../lib/time";
import { ACTIVE_STATUSES, type BookingConfig } from "../types";
import { SLUG_RE, normalizePhone } from "../lib/public-slug";

export interface PublicService {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  price: number | null;
  staff: { id: string; name: string }[];
}

export interface PublicBusiness {
  workspaceId: string;
  slug: string;
  name: string;
  intro: string | null;
  timeZone: string;
  whatsapp: string | null;
  services: PublicService[];
}

interface LoadedBusiness {
  business: PublicBusiness;
  config: BookingConfig;
}

async function loadBySlug(slug: string): Promise<LoadedBusiness | null> {
  if (!SLUG_RE.test(slug)) return null;
  const sb = bookingDb();
  const { data: row } = await sb
    .from("booking_settings")
    .select("workspace_id, public_intro")
    .eq("public_slug", slug)
    .eq("public_enabled", true)
    .maybeSingle();
  if (!row) return null;

  const workspaceId = row.workspace_id as string;
  const [config, bizRes, wsRes, integRes] = await Promise.all([
    loadBookingConfig(sb, workspaceId),
    sb
      .from("business_info")
      .select("structured")
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    sb
      .from("workspaces")
      .select("name, is_active")
      .eq("id", workspaceId)
      .maybeSingle(),
    sb
      .from("integrations")
      .select("config")
      .eq("workspace_id", workspaceId)
      .eq("provider", "ycloud")
      .eq("enabled", true)
      .maybeSingle(),
  ]);
  if (wsRes.data && wsRes.data.is_active === false) return null;

  const structuredName = (bizRes.data?.structured as { name?: string } | null)
    ?.name;
  const phone = (integRes.data?.config as { phone_number?: string } | null)
    ?.phone_number;

  const services: PublicService[] = config.services
    .filter((s) => s.active)
    .map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      durationMin: s.duration_min,
      price: s.price,
      staff: staffForService(config, s.id)
        .filter((m) => m.hours.length > 0)
        .map((m) => ({ id: m.id, name: m.name })),
    }))
    .filter((s) => s.staff.length > 0);

  return {
    config,
    business: {
      workspaceId,
      slug,
      name: structuredName || (wsRes.data?.name as string) || "Reservas",
      intro: (row.public_intro as string | null) ?? null,
      timeZone: config.timeZone,
      whatsapp: phone ?? null,
      services,
    },
  };
}

export async function getPublicBusiness(
  slug: string,
): Promise<PublicBusiness | null> {
  return (await loadBySlug(slug))?.business ?? null;
}

export interface PublicDay {
  date: string;
  label: string;
  times: string[];
}

/** Días con huecos libres en las próximas 2 semanas (o los días vista del negocio). */
export async function getPublicAvailability(
  slug: string,
  serviceId: string,
  staffId: string | null,
): Promise<PublicDay[] | null> {
  const loaded = await loadBySlug(slug);
  if (!loaded) return null;
  const { business, config } = loaded;
  const service = business.services.find((s) => s.id === serviceId);
  if (!service) return null;
  if (staffId && !service.staff.some((m) => m.id === staffId)) return null;

  const today = localParts(new Date(), config.timeZone).date;
  const span = Math.min(14, config.settings.max_days_ahead);
  const res = await findSlots({
    workspaceId: business.workspaceId,
    serviceId,
    dateFrom: today,
    dateTo: addDays(today, span - 1),
    staffId,
    config,
  });
  if (!res.ok) return [];

  return summarizeSlots(
    res.data.slots,
    res.data.staff.map((s) => ({ id: s.id, name: s.name, hours: [] })),
    config.timeZone,
  ).map((d) => ({
    date: d.date,
    label: formatDayLabel(d.date),
    times: d.times.map((t) => t.time),
  }));
}

export interface PublicBookingInput {
  serviceId: string;
  staffId: string | null;
  date: string;
  time: string;
  name: string;
  phone: string;
  consent: boolean;
}

export type PublicBookingResult =
  | {
      ok: true;
      when: string;
      service: string;
      staff: string | null;
    }
  | { ok: false; error: string };

/** Máximo de citas futuras activas por teléfono y negocio (evita abusos). */
const MAX_ACTIVE_PER_PHONE = 3;

export async function bookPublic(
  slug: string,
  input: PublicBookingInput,
): Promise<PublicBookingResult> {
  const loaded = await loadBySlug(slug);
  if (!loaded) return { ok: false, error: "Esta página de reservas no está disponible." };
  const { business, config } = loaded;
  const sb = bookingDb();

  const service = business.services.find((s) => s.id === input.serviceId);
  if (!service) return { ok: false, error: "Elige un servicio." };
  if (input.staffId && !service.staff.some((m) => m.id === input.staffId)) {
    return { ok: false, error: "Ese profesional no está disponible." };
  }

  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) {
    return { ok: false, error: "Escribe tu nombre." };
  }
  const phone = normalizePhone(input.phone);
  if (!phone) {
    return { ok: false, error: "Escribe un teléfono válido (ej: 600 123 456)." };
  }

  const start = parseStart(`${input.date}T${input.time}`, config.timeZone);
  if (!start) return { ok: false, error: "Fecha u hora no válida." };

  // Límite de citas activas por teléfono.
  const { count } = await sb
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", business.workspaceId)
    .eq("customer_phone", phone)
    .in("status", ACTIVE_STATUSES)
    .gte("scheduled_at", new Date().toISOString());
  if ((count ?? 0) >= MAX_ACTIVE_PER_PHONE) {
    return {
      ok: false,
      error:
        "Ya tienes varias citas pendientes con este teléfono. Si necesitas otra, escríbenos por WhatsApp.",
    };
  }

  // Contacto: lo reutilizamos si ya existe (mismo teléfono en este negocio).
  let contactId: string | null = null;
  const { data: existing } = await sb
    .from("contacts")
    .select("id, name, opt_in")
    .eq("workspace_id", business.workspaceId)
    .eq("phone", phone)
    .maybeSingle();
  if (existing) {
    contactId = existing.id as string;
    const patch: Record<string, unknown> = {};
    if (!existing.name) patch.name = name;
    if (input.consent && !existing.opt_in) {
      patch.opt_in = true;
      patch.opt_in_at = new Date().toISOString();
    }
    if (Object.keys(patch).length) {
      await sb.from("contacts").update(patch).eq("id", contactId);
    }
  } else {
    const { data: created } = await sb
      .from("contacts")
      .insert({
        workspace_id: business.workspaceId,
        phone,
        name,
        source: "web",
        opt_in: input.consent,
        opt_in_at: input.consent ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    contactId = (created?.id as string | undefined) ?? null;
  }

  const res = await createAppointment({
    workspaceId: business.workspaceId,
    serviceId: service.id,
    staffId: input.staffId,
    start,
    contactId,
    customerName: name,
    customerPhone: phone,
    source: "web",
  });
  if (!res.ok) {
    return {
      ok: false,
      error:
        res.code === "slot_unavailable"
          ? "Esa hora se acaba de ocupar. Elige otra, por favor."
          : "No se pudo hacer la reserva. Inténtalo de nuevo.",
    };
  }

  // Confirmación por WhatsApp después de responder (no retrasa la página).
  const appt = res.data;
  after(() => sendBookingConfirmation(appt, config, business.name));

  const staff = config.staff.find((m) => m.id === res.data.staff_id);
  return {
    ok: true,
    when: formatHuman(new Date(res.data.scheduled_at), config.timeZone),
    service: service.name,
    staff: staff?.name ?? null,
  };
}
