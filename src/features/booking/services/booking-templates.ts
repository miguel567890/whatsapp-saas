/**
 * booking-templates.ts — plantillas de WhatsApp para los avisos de cita.
 *
 * WhatsApp solo deja que el negocio escriba primero (o pasadas 24 h desde el
 * último mensaje del cliente) con plantillas aprobadas por Meta. Cada negocio
 * tiene su propia cuenta de WhatsApp, así que cada uno necesita sus plantillas:
 * aquí se crean, se envían a aprobar y se consulta su estado con un clic.
 */

import { bookingDb } from "./booking-service";
import {
  createYCloudTemplate,
  fetchYCloudTemplates,
  resolveWabaId,
  YCloudError,
} from "@/features/inbox/services/ycloud-client";
import {
  buildYCloudPayload,
  createTemplateSchema,
  type CreateTemplateInput,
} from "@/features/settings/lib/template-form";
import { decryptCredentials } from "@/shared/lib/integration-secrets";

export const CONFIRMATION_TEMPLATE = "cita_confirmada";
export const REMINDER_TEMPLATE = "recordatorio_cita";

/**
 * Textos de las plantillas. El orden de las variables lo usan los envíos:
 *  - confirmación: {{1}} nombre, {{2}} servicio, {{3}} negocio, {{4}} día, {{5}} hora
 *  - recordatorio: {{1}} nombre, {{2}} servicio, {{3}} día, {{4}} hora
 */
export const BOOKING_TEMPLATES: CreateTemplateInput[] = [
  {
    name: CONFIRMATION_TEMPLATE,
    category: "utility",
    header_type: "none",
    header_text: "",
    body_template:
      "Hola {{1}}, tu cita de {{2}} en {{3}} está confirmada para el {{4}} a las {{5}}. Si necesitas cambiarla o cancelarla, responde a este mensaje.",
    body_variables: [
      { index: 1, example: "Javi" },
      { index: 2, example: "Corte y barba" },
      { index: 3, example: "Barbería del Centro" },
      { index: 4, example: "jueves, 12 de noviembre" },
      { index: 5, example: "12:00" },
    ],
    footer_text: "",
    buttons: [],
  },
  {
    name: REMINDER_TEMPLATE,
    category: "utility",
    header_type: "none",
    header_text: "",
    body_template:
      "Hola {{1}}, te recordamos tu cita de {{2}} el {{3}} a las {{4}}. Si no puedes venir, responde a este mensaje y la cambiamos.",
    body_variables: [
      { index: 1, example: "Javi" },
      { index: 2, example: "Corte y barba" },
      { index: 3, example: "jueves, 12 de noviembre" },
      { index: 4, example: "12:00" },
    ],
    footer_text: "",
    buttons: [],
  },
];

export type TemplateState = "missing" | "draft" | "submitted" | "approved" | "rejected" | "paused";

export interface BookingTemplatesStatus {
  confirmation: TemplateState;
  reminder: TemplateState;
}

async function loadYCloud(workspaceId: string) {
  const db = bookingDb();
  const { data: integration } = await db
    .from("integrations")
    .select("credentials, config")
    .eq("workspace_id", workspaceId)
    .eq("provider", "ycloud")
    .eq("enabled", true)
    .maybeSingle();
  if (!integration) return null;
  const credentials = await decryptCredentials(
    integration.credentials as Record<string, unknown> | null,
    workspaceId,
    "ycloud",
  );
  const apiKey = (credentials.ycloud_api_key as string | undefined) ?? "";
  const phone = ((integration.config ?? {}) as Record<string, unknown>).phone_number as
    | string
    | undefined;
  if (!apiKey || apiKey === "placeholder" || !phone) return null;
  return { apiKey, phone };
}

export async function getBookingTemplatesStatus(
  workspaceId: string,
): Promise<BookingTemplatesStatus> {
  const { data } = await bookingDb()
    .from("templates")
    .select("name, status")
    .eq("workspace_id", workspaceId)
    .in("name", [CONFIRMATION_TEMPLATE, REMINDER_TEMPLATE]);
  const by = new Map((data ?? []).map((r) => [r.name as string, r.status as TemplateState]));
  return {
    confirmation: by.get(CONFIRMATION_TEMPLATE) ?? "missing",
    reminder: by.get(REMINDER_TEMPLATE) ?? "missing",
  };
}

/**
 * Crea (o reenvía si fueron rechazadas) las dos plantillas y las manda a Meta.
 * Las que ya están enviadas o aprobadas no se tocan.
 */
export async function submitBookingTemplates(
  workspaceId: string,
): Promise<{ ok: true; status: BookingTemplatesStatus } | { ok: false; error: string }> {
  const yc = await loadYCloud(workspaceId);
  if (!yc) {
    return { ok: false, error: "Primero conecta el WhatsApp del negocio (YCloud)." };
  }
  const db = bookingDb();
  const current = await getBookingTemplatesStatus(workspaceId);

  let wabaId: string;
  try {
    wabaId = await resolveWabaId(yc.apiKey, yc.phone);
  } catch (e) {
    console.error("[booking-templates] wabaId:", e);
    return { ok: false, error: "No se encontró la cuenta de WhatsApp en YCloud." };
  }

  for (const tpl of BOOKING_TEMPLATES) {
    const state = tpl.name === CONFIRMATION_TEMPLATE ? current.confirmation : current.reminder;
    if (state === "submitted" || state === "approved" || state === "paused") continue;

    const input = createTemplateSchema.parse(tpl);
    const row = {
      workspace_id: workspaceId,
      name: input.name,
      language: "es",
      category: input.category,
      header_type: input.header_type,
      header_text: input.header_text || null,
      body_template: input.body_template,
      variables: input.body_variables,
      footer_text: input.footer_text || null,
      buttons: input.buttons,
      updated_at: new Date().toISOString(),
    };
    await db.from("templates").upsert(row, { onConflict: "workspace_id,name,language" });

    try {
      const result = await createYCloudTemplate(yc.apiKey, buildYCloudPayload(wabaId, input));
      await db
        .from("templates")
        .update({
          status: "submitted",
          provider_template_id: result.id || null,
          rejection_reason: null,
          submitted_at: new Date().toISOString(),
        })
        .eq("workspace_id", workspaceId)
        .eq("name", input.name)
        .eq("language", "es");
    } catch (e) {
      const msg = e instanceof YCloudError ? e.message : String(e);
      // Si ya existe en Meta (p. ej. creada a mano), lo resolvemos al consultar el estado.
      if (!/exist/i.test(msg)) {
        console.error("[booking-templates] submit:", msg);
        return { ok: false, error: `WhatsApp no aceptó la plantilla ${input.name}: ${msg}` };
      }
    }
  }

  // Usar estas plantillas en los avisos de este negocio.
  await db.from("booking_settings").upsert(
    {
      workspace_id: workspaceId,
      confirmation_template_name: CONFIRMATION_TEMPLATE,
      reminder_template_name: REMINDER_TEMPLATE,
      reminder_template_language: "es",
    },
    { onConflict: "workspace_id" },
  );

  return { ok: true, status: await refreshBookingTemplatesStatus(workspaceId) };
}

/** Pregunta a YCloud cómo van las dos plantillas y guarda el estado. */
export async function refreshBookingTemplatesStatus(
  workspaceId: string,
): Promise<BookingTemplatesStatus> {
  const yc = await loadYCloud(workspaceId);
  if (yc) {
    try {
      const [records, wabaId] = await Promise.all([
        fetchYCloudTemplates(yc.apiKey),
        resolveWabaId(yc.apiKey, yc.phone).catch(() => null),
      ]);
      const MAP: Record<string, TemplateState> = {
        APPROVED: "approved",
        PENDING: "submitted",
        IN_APPEAL: "submitted",
        REJECTED: "rejected",
        PAUSED: "paused",
        DISABLED: "paused",
      };
      for (const raw of records as Array<Record<string, unknown>>) {
        const name = raw.name as string | undefined;
        if (name !== CONFIRMATION_TEMPLATE && name !== REMINDER_TEMPLATE) continue;
        if (raw.language && raw.language !== "es") continue;
        if (wabaId && raw.wabaId && raw.wabaId !== wabaId) continue;
        const status = MAP[String(raw.status ?? "").toUpperCase()] ?? "submitted";
        await bookingDb()
          .from("templates")
          .update({
            status,
            rejection_reason:
              status === "rejected" ? ((raw.reason as string | undefined) ?? null) : null,
            ...(status === "approved" ? { approved_at: new Date().toISOString() } : {}),
          })
          .eq("workspace_id", workspaceId)
          .eq("name", name)
          .eq("language", "es");
      }
    } catch (e) {
      console.error("[booking-templates] refresh:", e);
    }
  }
  return getBookingTemplatesStatus(workspaceId);
}
