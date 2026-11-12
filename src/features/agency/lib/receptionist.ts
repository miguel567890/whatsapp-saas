/**
 * receptionist.ts — la recepcionista de Citaya para un negocio con cita previa.
 *
 * Es la misma forma de trabajar que afinamos con el WhatsApp de Citaya
 * (reservar en el mismo mensaje, no repetir preguntas, explicar bien si una
 * hora se ocupa…), pero hablando en nombre de cada peluquería. Se aplica al
 * crear un negocio y se puede volver a aplicar desde Agencia.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PromptGuardrails } from "@/features/inbox/services/prompt-builder";

export const RECEPTIONIST_MODEL = "anthropic/claude-haiku-4.5";

export const RECEPTIONIST_TOOLS = [
  "agenda_services",
  "agenda_slots",
  "agenda_book",
  "agenda_my_appointments",
  "agenda_cancel",
  "agenda_reschedule",
  "pasar_a_persona",
] as const;

export const RECEPTIONIST_PROMPT = `IDENTIDAD
Eres la recepcionista de {{business_name}} por WhatsApp. Atiendes a los clientes en nombre del negocio, con su información y su agenda. Si te preguntan, dices con naturalidad que eres la asistente virtual del negocio. Hablas en español de España y tuteas (salvo que el cliente te trate de usted), con un tono cercano y amable, como alguien que trabaja ahí. Nada de lenguaje corporativo.

QUÉ HACES
- Das cita, la cambias o la cancelas con las herramientas de agenda.
- Respondes dudas sobre servicios, precios, horarios, dirección y formas de pago con la información del negocio.
- Si algo no está en esa información, no lo inventas: pasas la conversación al equipo con pasar_a_persona.

CÓMO DAR CITA
1. Averigua qué servicio quiere. Si no lo dice, pregúntale qué se va a hacer; si duda, usa agenda_services y ofrécele las opciones con su precio.
2. Solo si hay varios profesionales, pregunta si prefiere a alguien. Si le da igual, no insistas.
3. Busca huecos con agenda_slots para el día que pida (o los próximos) y ofrece como mucho tres horas.
4. Cuando elija hora, pide su nombre si aún no lo sabes y reserva con agenda_book en ese mismo mensaje.
5. Confirma servicio, día, hora y profesional, y despídete en una frase.

CAMBIOS Y CANCELACIONES
Busca su cita con agenda_my_appointments. Para cambiarla, ofrece huecos con agenda_slots y usa agenda_reschedule; para anularla, confirma cuál es y usa agenda_cancel. Si el negocio tiene una norma de aviso para cancelar, recuérdala con amabilidad.

CUÁNDO PASAR A UNA PERSONA
Usa pasar_a_persona si el cliente lo pide, si tiene una queja, si pregunta algo que no está en la información del negocio o si la conversación se complica. Después despídete en una frase diciendo que alguien del equipo le contestará por aquí.`;

export const RECEPTIONIST_GUARDRAILS: PromptGuardrails = {
  rules: [
    "Escribe mensajes cortos, de 1 a 3 frases",
    "Haz una sola pregunta por mensaje",
    "Ofrece solo horas que te haya devuelto agenda_slots",
    "Cuando el cliente elija una hora, llama a agenda_book en ese mismo turno; nunca digas que vas a reservar sin hacerlo",
    "No vuelvas a pedir datos que el cliente ya te ha dado (nombre, servicio, hora elegida)",
    "Si agenda_book falla, explica con claridad que esa hora se acaba de ocupar y ofrece las alternativas que te da la herramienta",
    "Antes de ofrecer huecos, revisa la conversación por si el cliente ya eligió hora",
    "Confirma siempre servicio, día y hora después de reservar",
  ],
  restrictions: [
    "No inventes precios, servicios, horarios ni promociones que no estén en la información del negocio",
    "No des consejos médicos ni diagnostiques problemas de piel, cuero cabelludo o alergias",
    "No hables mal de otros negocios",
    "No te hagas pasar por una persona si te preguntan",
    "No uses dobles asteriscos (**) ni encabezados",
  ],
};

export const RECEPTIONIST_CONFIG = {
  responseStyle: "concise",
  sleepOnManualMessage: true,
  autoTag: false,
  summarize: false,
};

/**
 * Deja el negocio listo con la recepcionista: instrucciones, modelo, tools de
 * agenda activadas y ajustes de España. No toca servicios ni horarios.
 * Usa el cliente service-role: llamar solo tras comprobar que es super admin.
 */
export async function applyReceptionist(
  db: SupabaseClient,
  workspaceId: string,
  userId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // 1. Agente de agendamiento (lo crea el alta de negocio).
  const { data: agent } = await db
    .from("agents")
    .select("id, prompt_id")
    .eq("workspace_id", workspaceId)
    .eq("type", "agendamiento")
    .maybeSingle();
  if (!agent) return { ok: false, error: "El negocio no tiene agente de agendamiento" };

  let promptId = agent.prompt_id as string | null;
  if (!promptId) {
    const { data: p } = await db
      .from("prompts")
      .insert({ workspace_id: workspaceId, scope: "mode", scope_ref: "agendamiento", name: "Agente agendamiento" })
      .select("id")
      .single();
    promptId = (p?.id as string | undefined) ?? null;
    if (!promptId) return { ok: false, error: "No se pudo crear el prompt" };
  }

  // 2. Nueva versión publicada con las instrucciones de la recepcionista.
  const { data: last } = await db
    .from("prompt_versions")
    .select("version")
    .eq("prompt_id", promptId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: version, error: vErr } = await db
    .from("prompt_versions")
    .insert({
      workspace_id: workspaceId,
      prompt_id: promptId,
      version: ((last?.version as number | undefined) ?? 0) + 1,
      state: "published",
      body: RECEPTIONIST_PROMPT,
      guardrails: RECEPTIONIST_GUARDRAILS,
      published_at: new Date().toISOString(),
      created_by: userId,
    })
    .select("id")
    .single();
  if (vErr || !version) return { ok: false, error: "No se pudo guardar la recepcionista" };
  await db.from("prompts").update({ active_version_id: version.id }).eq("id", promptId);

  // 3. Agente: nombre, modelo, ajustes y activo (solo uno activo por negocio).
  await db
    .from("agents")
    .update({
      name: "Recepcionista",
      model: RECEPTIONIST_MODEL,
      config: RECEPTIONIST_CONFIG,
      prompt_id: promptId,
    })
    .eq("id", agent.id);
  await db.rpc("set_active_agent", { p_workspace: workspaceId, p_agent: agent.id });

  // 4. Tools de agenda + pasar a persona.
  const { data: tools } = await db.from("tools").select("id, key").in("key", [...RECEPTIONIST_TOOLS]);
  if (tools?.length) {
    await db.from("tool_configs").upsert(
      tools.map((t) => ({ workspace_id: workspaceId, tool_id: t.id, enabled: true })),
      { onConflict: "workspace_id,tool_id" },
    );
  }

  // 5. España por defecto (sin pisar lo que ya esté puesto).
  const { data: bi } = await db
    .from("business_info")
    .select("structured")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  const structured = (bi?.structured as Record<string, unknown> | null) ?? {};
  await db
    .from("business_info")
    .update({
      structured: {
        ...structured,
        timezone: structured.timezone ?? "Europe/Madrid",
        default_country_code: structured.default_country_code ?? "34",
      },
    })
    .eq("workspace_id", workspaceId);

  await db
    .from("booking_settings")
    .upsert({ workspace_id: workspaceId }, { onConflict: "workspace_id", ignoreDuplicates: true });

  return { ok: true };
}
