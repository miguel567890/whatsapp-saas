/**
 * booking-notify.ts — mensaje de "cita confirmada" por WhatsApp.
 *
 * Se manda al reservar desde la página pública (por WhatsApp la recepcionista
 * ya lo confirma en el propio chat). Si el cliente escribió en las últimas
 * 24 h va como texto normal; si no, con la plantilla aprobada del negocio.
 * Nunca rompe la reserva: cualquier fallo queda registrado y ya está.
 */

import { dispatchTemplate, dispatchText } from "@/features/inbox/services/dispatch";
import { bookingDb } from "./booking-service";
import { formatDayLabel, localParts } from "../lib/time";
import type { AppointmentRow, BookingConfig } from "../types";

/** Conversación de WhatsApp del contacto (la crea si aún no existe). */
export async function ensureConversation(
  workspaceId: string,
  contactId: string,
): Promise<{ id: string; windowOpen: boolean } | null> {
  const sb = bookingDb();
  const { data: existing } = await sb
    .from("conversations")
    .select("id, window_expires_at")
    .eq("workspace_id", workspaceId)
    .eq("contact_id", contactId)
    .eq("channel", "whatsapp")
    .maybeSingle();
  if (existing) {
    const exp = existing.window_expires_at as string | null;
    return { id: existing.id as string, windowOpen: !!exp && Date.parse(exp) > Date.now() };
  }
  const { data: created, error } = await sb
    .from("conversations")
    .upsert(
      { workspace_id: workspaceId, contact_id: contactId, channel: "whatsapp" },
      { onConflict: "workspace_id,contact_id,channel", ignoreDuplicates: false },
    )
    .select("id, window_expires_at")
    .single();
  if (error || !created) {
    console.error("[booking-notify] conversation:", error?.message);
    return null;
  }
  const exp = created.window_expires_at as string | null;
  return { id: created.id as string, windowOpen: !!exp && Date.parse(exp) > Date.now() };
}

export async function sendBookingConfirmation(
  appt: AppointmentRow,
  config: BookingConfig,
  businessName: string,
): Promise<"sent" | "skipped" | "failed"> {
  try {
    if (!appt.contact_id) return "skipped";
    const sb = bookingDb();
    const { data: contact } = await sb
      .from("contacts")
      .select("opt_in")
      .eq("id", appt.contact_id)
      .maybeSingle();
    if (!contact?.opt_in) return "skipped"; // el cliente no quiso avisos

    const conv = await ensureConversation(appt.workspace_id, appt.contact_id);
    if (!conv) return "failed";

    const template = config.settings.confirmation_template_name;
    if (!conv.windowOpen && !template) return "skipped";

    const service = config.services.find((s) => s.id === appt.service_id)?.name ?? "tu cita";
    const staff = config.staff.find((s) => s.id === appt.staff_id)?.name;
    const p = localParts(new Date(appt.scheduled_at), config.timeZone);
    const day = formatDayLabel(p.date);
    const first = appt.customer_name?.split(" ")[0] || "";

    const res = conv.windowOpen
      ? await dispatchText({
          workspaceId: appt.workspace_id,
          conversationId: conv.id,
          body:
            `Hola${first ? ` ${first}` : ""}, tu cita de *${service}* en ${businessName} está confirmada ` +
            `para el *${day}* a las *${p.time}*${staff ? ` con ${staff}` : ""}. ` +
            "Si necesitas cambiarla o cancelarla, responde a este mensaje.",
        })
      : await dispatchTemplate({
          workspaceId: appt.workspace_id,
          conversationId: conv.id,
          templateName: template!,
          templateLanguage: config.settings.reminder_template_language || "es",
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: first || "cliente" },
                { type: "text", text: service },
                { type: "text", text: businessName },
                { type: "text", text: day },
                { type: "text", text: p.time },
              ],
            },
          ],
        });

    if (res.ok) {
      // Deja la cita enlazada a su chat (para el botón "Chat" del panel).
      if (!appt.conversation_id) {
        await sb.from("appointments").update({ conversation_id: conv.id }).eq("id", appt.id);
      }
      return "sent";
    }
    await sb.from("events").insert({
      type: "appointment_confirmation_failed",
      level: "warn",
      workspace_id: appt.workspace_id,
      conversation_id: conv.id,
      payload: { appointment_id: appt.id, error: res.error ?? null },
    });
    return "failed";
  } catch (e) {
    console.error("[booking-notify] confirmation failed:", e);
    return "failed";
  }
}
