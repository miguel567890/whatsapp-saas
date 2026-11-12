/**
 * handoff.ts — la recepcionista pasa la conversación a una persona del negocio.
 *
 * La conversación queda en "Te necesitan" (handoff_pending): la IA deja de
 * contestar en ese chat y aparece en la pantalla Hoy del negocio. La propia
 * recepcionista se despide con su respuesta, así que aquí no se manda el aviso
 * automático genérico (evita dos mensajes seguidos al cliente).
 */

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../core/tool";

const schema = z.object({
  motivo: z
    .string()
    .max(300)
    .describe("En pocas palabras, por qué hace falta una persona (para el equipo)"),
});

export const humanHandoffTool: Tool<z.infer<typeof schema>> = {
  name: "pasar_a_persona",
  description:
    "Pasa la conversación a una persona del negocio. Úsalo cuando el cliente pida hablar con alguien, tenga una queja o pregunte algo que no está en la información del negocio. Después, despídete en una frase diciendo que alguien del equipo le contestará por aquí.",
  sensitivity: "write",
  schema,
  enabledFor: () => true,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    if (!ctx.conversationId) {
      // Playground: no hay conversación real que pasar.
      return {
        ok: true,
        output: "Prueba: en un chat real, la conversación pasaría al equipo.",
      };
    }
    try {
      const { applyTransition } = await import(
        "@/features/inbox/services/decision-engine"
      );
      await applyTransition(ctx.conversationId, "handoff_pending", {
        trigger: "agent_tool",
      });
      const { createClient } = await import("@supabase/supabase-js");
      await createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      )
        .from("events")
        .insert({
          type: "handoff_reason",
          level: "info",
          workspace_id: ctx.workspaceId,
          conversation_id: ctx.conversationId,
          payload: { motivo: args.motivo },
        });
      return {
        ok: true,
        output:
          "Hecho: la conversación ya está en manos del equipo. Despídete en una sola frase diciendo que alguien del equipo le contestará por aquí lo antes posible. No hagas más preguntas.",
      };
    } catch (e) {
      // Si ya estaba pasada a una persona, no es un error para el cliente.
      console.warn("[pasar_a_persona]", e instanceof Error ? e.message : e);
      return {
        ok: true,
        output: "La conversación ya está con el equipo. Dile que enseguida le contestan por aquí.",
      };
    }
  },
};
