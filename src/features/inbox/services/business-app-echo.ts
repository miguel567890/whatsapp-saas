/**
 * business-app-echo.ts — mensajes que el negocio escribe desde su propia app de
 * WhatsApp Business (modo coexistencia con YCloud).
 *
 * YCloud los avisa con el evento `whatsapp.smb.message.echoes`. Hacemos dos
 * cosas:
 *  1. Guardarlos en la conversación, para que el panel muestre el chat completo.
 *  2. Callar a la recepcionista en ese chat (pasa a "Atiendes tú"): si el
 *     peluquero está hablando con su cliente, la IA no debe pisarle.
 *     Vuelve sola pasado un rato sin que el peluquero escriba (ver decide()).
 */

import { createClient as createSbClient } from "@supabase/supabase-js";
import { normalizePhone } from "./normalizer";

function svc() {
  return createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export const BUSINESS_APP_ECHO_EVENT = "whatsapp.smb.message.echoes";

const MESSAGE_TYPES = new Set([
  "text",
  "audio",
  "image",
  "document",
  "video",
  "sticker",
  "location",
]);

export interface BusinessAppEcho {
  wamid: string;
  to: string;
  type: string;
  text: string | null;
  sentAt: string;
}

export function parseBusinessAppEcho(body: unknown): BusinessAppEcho | null {
  if (typeof body !== "object" || body === null) return null;
  const event = body as Record<string, unknown>;
  if (event.type !== BUSINESS_APP_ECHO_EVENT) return null;
  const m = event.whatsappMessage as Record<string, unknown> | undefined;
  if (!m || typeof m !== "object") return null;
  const wamid = typeof m.wamid === "string" ? m.wamid : null;
  const to = typeof m.to === "string" ? m.to : null;
  if (!wamid || !to) return null;
  const type = typeof m.type === "string" ? m.type : "text";
  const textObj = m.text as { body?: unknown } | undefined;
  const text =
    typeof textObj?.body === "string"
      ? textObj.body
      : (((m[type] as { caption?: unknown } | undefined)?.caption as string | undefined) ?? null);
  const sentAt =
    (typeof m.sendTime === "string" && m.sendTime) ||
    (typeof m.createTime === "string" && m.createTime) ||
    new Date().toISOString();
  return { wamid, to, type, text, sentAt };
}

export async function processBusinessAppEcho(
  workspaceId: string,
  echo: BusinessAppEcho,
): Promise<{ stored: boolean }> {
  const sb = svc();

  const { data: bi } = await sb
    .from("business_info")
    .select("structured")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  const cc =
    ((bi?.structured as { default_country_code?: string } | null)?.default_country_code as
      | string
      | undefined) ?? "34";
  const phone = normalizePhone(echo.to, cc);

  // Contacto (sin tocar su consentimiento: es el negocio quien escribe).
  let contactId: string | null = null;
  const { data: existing } = await sb
    .from("contacts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("phone", phone)
    .maybeSingle();
  if (existing) contactId = existing.id as string;
  else {
    const { data: created } = await sb
      .from("contacts")
      .insert({ workspace_id: workspaceId, phone, source: "whatsapp_app" })
      .select("id")
      .single();
    contactId = (created?.id as string | undefined) ?? null;
  }
  if (!contactId) return { stored: false };

  // Conversación (un mensaje del negocio no abre la ventana de 24 h).
  const { data: conv } = await sb
    .from("conversations")
    .upsert(
      { workspace_id: workspaceId, contact_id: contactId, channel: "whatsapp" },
      { onConflict: "workspace_id,contact_id,channel", ignoreDuplicates: false },
    )
    .select("id, state, ai_enabled")
    .single();
  if (!conv) return { stored: false };

  const { error } = await sb.from("messages").insert({
    workspace_id: workspaceId,
    conversation_id: conv.id,
    direction: "out",
    type: MESSAGE_TYPES.has(echo.type) ? echo.type : "text",
    body: echo.text ?? "[Multimedia]",
    wamid: echo.wamid,
    status: "sent",
    meta: { source: "business_app" },
    created_at: echo.sentAt,
  });
  // 23505 = ya lo teníamos (YCloud reintenta los webhooks).
  if (error) {
    if (error.code !== "23505") console.error("[business-app-echo] insert:", error.message);
    return { stored: false };
  }

  await sb
    .from("conversations")
    .update({ last_message_at: echo.sentAt })
    .eq("id", conv.id);

  // El peluquero está atendiendo: la recepcionista se calla en este chat.
  const state = conv.state as string;
  if (state === "ai_active" || state === "handoff_pending" || state === "waiting_reply") {
    try {
      const { applyTransition } = await import("./decision-engine");
      await applyTransition(conv.id as string, "human_active", { trigger: "business_app" });
    } catch (e) {
      console.warn("[business-app-echo] sleep skipped:", e instanceof Error ? e.message : e);
    }
  }
  return { stored: true };
}
