-- ============================================================
-- Migration: 20261113000000_human_handoff_tool
-- 1) Tool "pasar_a_persona": la recepcionista pasa la conversación al equipo
--    (queda en "Te necesitan" y la IA deja de contestar en ese chat).
-- 2) Coexistencia: guardar los mensajes enviados desde la app del negocio.
-- Idempotente.
-- ============================================================

INSERT INTO public.tools (key, name, description, schema, sensitivity) VALUES
  ('pasar_a_persona', 'Pasar a una persona',
   'La recepcionista pasa la conversación al equipo cuando el cliente lo pide, tiene una queja o pregunta algo que no sabe.',
   '{"type":"object","properties":{"motivo":{"type":"string"}},"required":["motivo"]}', 'write')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  schema = EXCLUDED.schema,
  sensitivity = EXCLUDED.sensitivity;

-- Coexistencia: los mensajes que el negocio escribe desde su app de WhatsApp
-- Business son legales siempre (la ventana de 24 h solo limita a la API), así
-- que el guardián de la ventana los deja pasar cuando se guardan en el historial.
CREATE OR REPLACE FUNCTION public.check_outbound_24h_window()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  conv_window_expires_at TIMESTAMPTZ;
  conv_workspace_id UUID;
BEGIN
  -- Only enforce on outbound non-template messages
  IF NEW.direction <> 'out' OR NEW.type = 'template' THEN
    RETURN NEW;
  END IF;

  -- Enviado desde la app del negocio (coexistencia): ya salió por WhatsApp.
  IF NEW.meta ->> 'source' = 'business_app' THEN
    RETURN NEW;
  END IF;

  SELECT window_expires_at, workspace_id
    INTO conv_window_expires_at, conv_workspace_id
    FROM public.conversations
   WHERE id = NEW.conversation_id;

  IF conv_window_expires_at IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOW() <= conv_window_expires_at THEN
    RETURN NEW;
  END IF;

  IF (NEW.meta ->> 'override_admin')::boolean IS TRUE THEN
    INSERT INTO public.events (workspace_id, conversation_id, type, level, payload)
    VALUES (
      conv_workspace_id,
      NEW.conversation_id,
      'WINDOW_OVERRIDE',
      'warn',
      jsonb_build_object('sender_user_id', NEW.sender_user_id, 'body_preview', left(COALESCE(NEW.body,''), 40))
    );
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'WINDOW_EXPIRED: free text outside 24h window. Use an approved template.';
END;
$$;

-- ============================================================
-- End of migration: 20261113000000_human_handoff_tool
-- ============================================================
