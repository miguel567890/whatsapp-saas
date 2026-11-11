import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Dos formas de ver el panel:
 *  - "agency": el dueño de la plataforma (super admin) ve todo, incluida la
 *    configuración técnica del agente.
 *  - "business": el negocio cliente ve solo lo de su día a día
 *    (Hoy, Agenda, Mensajes y Mi negocio).
 */
export type PanelMode = "agency" | "business";

export async function getPanelMode(
  supabase: SupabaseClient,
  userId: string,
): Promise<PanelMode> {
  const { data } = await supabase
    .from("users")
    .select("is_super_admin")
    .eq("id", userId)
    .maybeSingle();
  return data?.is_super_admin ? "agency" : "business";
}
