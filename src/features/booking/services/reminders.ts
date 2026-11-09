/**
 * reminders.ts — recordatorios de cita por WhatsApp (llamado desde el cron).
 *
 * Para cada cita activa que entra en la ventana "X horas antes":
 *   - si la conversación tiene la ventana de 24 h abierta → texto libre
 *   - si no, y hay plantilla configurada → plantilla aprobada
 *   - si no hay forma legal de escribir → se omite (sin reintentos ruidosos)
 *
 * Cada cita se "reclama" con un UPDATE condicional antes de enviar, así dos
 * ejecuciones solapadas del cron nunca mandan el recordatorio dos veces.
 */

import { dispatchTemplate, dispatchText } from "@/features/inbox/services/dispatch";
import { bookingDb, loadBookingConfig } from "./booking-service";
import { formatDayLabel, localParts } from "../lib/time";
import type { AppointmentRow, BookingConfig } from "../types";

const MAX_LOOKAHEAD_HOURS = 168;
const MAX_PER_RUN = 50;

export interface ReminderRunResult {
  checked: number;
  sent: number;
  skipped: number;
  failed: number;
}

async function resolveConversation(
  appt: AppointmentRow,
): Promise<{ id: string; windowOpen: boolean } | null> {
  const sb = bookingDb();
  let contactId = appt.contact_id;

  // Citas creadas a mano: buscar el contacto por teléfono.
  if (!contactId && appt.customer_phone) {
    const phone = appt.customer_phone.replace(/[^\d+]/g, "");
    const { data } = await sb
      .from("contacts")
      .select("id")
      .eq("workspace_id", appt.workspace_id)
      .eq("phone", phone)
      .maybeSingle();
    contactId = (data?.id as string | undefined) ?? null;
  }

  let q = sb
    .from("conversations")
    .select("id, window_expires_at")
    .eq("workspace_id", appt.workspace_id);
  if (appt.conversation_id) q = q.eq("id", appt.conversation_id);
  else if (contactId) q = q.eq("contact_id", contactId);
  else return null;

  const { data } = await q
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const expires = data.window_expires_at as string | null;
  return {
    id: data.id as string,
    windowOpen: !!expires && Date.parse(expires) > Date.now(),
  };
}

function reminderText(appt: AppointmentRow, config: BookingConfig): string {
  const service = config.services.find((s) => s.id === appt.service_id);
  const staff = config.staff.find((s) => s.id === appt.staff_id);
  const p = localParts(new Date(appt.scheduled_at), config.timeZone);
  const name = appt.customer_name ? ` ${appt.customer_name.split(" ")[0]}` : "";
  return (
    `Hola${name}, te recordamos tu cita` +
    (service ? ` de *${service.name}*` : "") +
    ` el *${formatDayLabel(p.date)}* a las *${p.time}*` +
    (staff ? ` con ${staff.name}` : "") +
    ". Si no puedes venir, respóndenos por aquí y la cambiamos."
  );
}

export async function runAppointmentReminders(): Promise<ReminderRunResult> {
  const sb = bookingDb();
  const now = Date.now();
  const result: ReminderRunResult = { checked: 0, sent: 0, skipped: 0, failed: 0 };

  const { data } = await sb
    .from("appointments")
    .select("*")
    .in("status", ["booked", "confirmed"])
    .is("reminder_sent_at", null)
    .not("ends_at", "is", null)
    .gt("scheduled_at", new Date(now).toISOString())
    .lte("scheduled_at", new Date(now + MAX_LOOKAHEAD_HOURS * 3600000).toISOString())
    .order("scheduled_at")
    .limit(MAX_PER_RUN * 4);

  const rows = (data ?? []) as AppointmentRow[];
  const configs = new Map<string, BookingConfig>();

  for (const appt of rows) {
    if (result.sent + result.failed >= MAX_PER_RUN) break;

    let config = configs.get(appt.workspace_id);
    if (!config) {
      config = await loadBookingConfig(sb, appt.workspace_id);
      configs.set(appt.workspace_id, config);
    }
    const s = config.settings;
    if (!s.reminders_enabled) continue;

    const startMs = Date.parse(appt.scheduled_at);
    const windowMs = s.reminder_hours_before * 3600000;
    if (startMs - now > windowMs) continue; // aún no toca
    result.checked++;

    // Si se reservó ya dentro de la ventana, el cliente lo tiene reciente: no molestar.
    if (startMs - Date.parse(appt.created_at) < windowMs) {
      await sb
        .from("appointments")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", appt.id)
        .is("reminder_sent_at", null);
      result.skipped++;
      continue;
    }

    const conv = await resolveConversation(appt);
    if (!conv || (!conv.windowOpen && !s.reminder_template_name)) {
      result.skipped++;
      continue;
    }

    // Reclamar la cita (evita envíos dobles entre ejecuciones solapadas).
    const { data: claimed } = await sb
      .from("appointments")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", appt.id)
      .is("reminder_sent_at", null)
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    let ok = false;
    try {
      if (conv.windowOpen) {
        const res = await dispatchText({
          workspaceId: appt.workspace_id,
          conversationId: conv.id,
          body: reminderText(appt, config),
        });
        ok = res.ok;
      } else {
        const service = config.services.find((x) => x.id === appt.service_id);
        const p = localParts(new Date(appt.scheduled_at), config.timeZone);
        const res = await dispatchTemplate({
          workspaceId: appt.workspace_id,
          conversationId: conv.id,
          templateName: s.reminder_template_name!,
          templateLanguage: s.reminder_template_language || "es",
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: appt.customer_name?.split(" ")[0] || "cliente" },
                { type: "text", text: service?.name ?? "tu cita" },
                { type: "text", text: formatDayLabel(p.date) },
                { type: "text", text: p.time },
              ],
            },
          ],
        });
        ok = res.ok;
      }
    } catch (e) {
      console.error("[reminders] send failed:", e);
      ok = false;
    }

    if (ok) {
      result.sent++;
    } else {
      // Un solo intento: no reintentamos cada minuto (opt-out, plantilla
      // rechazada…). Queda registrado para verlo en observabilidad.
      result.failed++;
      await sb.from("events").insert({
        type: "appointment_reminder_failed",
        level: "warn",
        workspace_id: appt.workspace_id,
        conversation_id: conv.id,
        payload: { appointment_id: appt.id },
      });
    }
  }

  return result;
}
