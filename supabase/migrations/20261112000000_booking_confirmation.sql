-- ============================================================
-- Migration: 20261112000000_booking_confirmation
-- Mensaje de "cita confirmada" por WhatsApp al reservar desde la web.
--
--   booking_settings.confirmation_template_name → plantilla aprobada que se usa
--     cuando el cliente no ha escrito en las últimas 24 h.
--   Recordatorio por defecto: 1 hora antes (antes 24 h).
-- Idempotente.
-- ============================================================

ALTER TABLE public.booking_settings
  ADD COLUMN IF NOT EXISTS confirmation_template_name TEXT;

ALTER TABLE public.booking_settings
  ALTER COLUMN reminder_hours_before SET DEFAULT 1;

-- ============================================================
-- End of migration: 20261112000000_booking_confirmation
-- ============================================================
