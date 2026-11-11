-- ============================================================
-- Migration: 20261111000000_public_booking
-- Página de reservas pública por negocio: holacitaya.app/<public_slug>
--
--   booking_settings.public_enabled → la página está visible
--   booking_settings.public_slug    → nombre del enlace (único, minúsculas)
--   booking_settings.public_intro   → texto corto opcional bajo el nombre
--   appointments.source             → nuevo origen 'web'
--
-- La página se sirve con el cliente service-role desde el servidor y solo
-- expone servicios, nombres de profesionales y huecos libres. Idempotente.
-- ============================================================

ALTER TABLE public.booking_settings
  ADD COLUMN IF NOT EXISTS public_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS public_slug TEXT,
  ADD COLUMN IF NOT EXISTS public_intro TEXT;

DO $$ BEGIN
  ALTER TABLE public.booking_settings
    ADD CONSTRAINT booking_settings_public_slug_format
    CHECK (public_slug IS NULL OR public_slug ~ '^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.booking_settings
    ADD CONSTRAINT booking_settings_public_intro_len
    CHECK (public_intro IS NULL OR char_length(public_intro) <= 300);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_booking_settings_public_slug
  ON public.booking_settings (public_slug)
  WHERE public_slug IS NOT NULL;

-- Nuevo origen de cita: reservada desde la página pública.
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_source_check;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_source_check
  CHECK (source IN ('agent', 'manual', 'highlevel', 'web'));

-- ============================================================
-- End of migration: 20261111000000_public_booking
-- ============================================================
