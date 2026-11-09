-- ============================================================
-- Migration: 20261109000000_native_calendar
-- Agente WhatsApp — calendario propio (sin HighLevel)
--
-- Añade un sistema de reservas nativo por workspace:
--   booking_settings        → ajustes de la agenda (paso, antelación, recordatorio)
--   booking_services        → servicios con duración y precio
--   booking_staff           → profesionales (sillas / peluqueros)
--   booking_staff_services  → qué servicios hace cada profesional
--   booking_hours           → horario semanal por profesional (admite turno partido)
--   booking_time_off        → vacaciones / cierres (de un profesional o de todo el negocio)
--   appointments (+cols)    → servicio, profesional, fin, nombre, recordatorio
--
-- Un constraint EXCLUDE impide que un mismo profesional tenga dos citas
-- activas solapadas, aunque dos conversaciones reserven a la vez.
-- La zona horaria se toma de business_info.structured.timezone (como el agente).
-- Idempotente.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

-- ── booking_settings ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.booking_settings (
  workspace_id UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  slot_step_min INT NOT NULL DEFAULT 15 CHECK (slot_step_min BETWEEN 5 AND 120),
  min_notice_min INT NOT NULL DEFAULT 60 CHECK (min_notice_min BETWEEN 0 AND 10080),
  max_days_ahead INT NOT NULL DEFAULT 30 CHECK (max_days_ahead BETWEEN 1 AND 365),
  reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  reminder_hours_before INT NOT NULL DEFAULT 24 CHECK (reminder_hours_before BETWEEN 1 AND 168),
  -- Plantilla aprobada por Meta para recordar fuera de la ventana de 24h.
  -- Variables del cuerpo, en orden: {{1}} nombre, {{2}} servicio, {{3}} fecha, {{4}} hora.
  reminder_template_name TEXT,
  reminder_template_language TEXT NOT NULL DEFAULT 'es',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_booking_settings_updated_at ON public.booking_settings;
CREATE TRIGGER trg_booking_settings_updated_at
  BEFORE UPDATE ON public.booking_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── booking_services ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.booking_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description TEXT,
  duration_min INT NOT NULL CHECK (duration_min BETWEEN 5 AND 600),
  price NUMERIC(10,2),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_booking_services_ws ON public.booking_services(workspace_id, active);

DROP TRIGGER IF EXISTS trg_booking_services_updated_at ON public.booking_services;
CREATE TRIGGER trg_booking_services_updated_at
  BEFORE UPDATE ON public.booking_services FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── booking_staff ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.booking_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_booking_staff_ws ON public.booking_staff(workspace_id, active);

DROP TRIGGER IF EXISTS trg_booking_staff_updated_at ON public.booking_staff;
CREATE TRIGGER trg_booking_staff_updated_at
  BEFORE UPDATE ON public.booking_staff FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── booking_staff_services ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.booking_staff_services (
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.booking_staff(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.booking_services(id) ON DELETE CASCADE,
  PRIMARY KEY (staff_id, service_id)
);
CREATE INDEX IF NOT EXISTS idx_booking_staff_services_ws ON public.booking_staff_services(workspace_id);

-- ── booking_hours ────────────────────────────────────────────
-- weekday: 0 = domingo … 6 = sábado. Varias filas por día = turno partido.
CREATE TABLE IF NOT EXISTS public.booking_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.booking_staff(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS idx_booking_hours_staff ON public.booking_hours(staff_id, weekday);
CREATE INDEX IF NOT EXISTS idx_booking_hours_ws ON public.booking_hours(workspace_id);

-- ── booking_time_off ─────────────────────────────────────────
-- staff_id NULL = cierre de todo el negocio (festivo, vacaciones).
CREATE TABLE IF NOT EXISTS public.booking_time_off (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES public.booking_staff(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_booking_time_off_ws ON public.booking_time_off(workspace_id, starts_at);

-- ── appointments: columnas del calendario propio ─────────────
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.booking_services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES public.booking_staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'agent',
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_source_check CHECK (source IN ('agent', 'manual', 'highlevel'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_ends_after_start CHECK (ends_at IS NULL OR ends_at > scheduled_at);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Sin solapes por profesional para citas activas.
DO $$ BEGIN
  ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_no_staff_overlap
    EXCLUDE USING gist (
      staff_id WITH =,
      tstzrange(scheduled_at, ends_at, '[)') WITH &&
    )
    WHERE (staff_id IS NOT NULL AND ends_at IS NOT NULL AND status IN ('booked', 'confirmed'));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_appointments_staff ON public.appointments(staff_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appointments_reminder
  ON public.appointments(scheduled_at)
  WHERE reminder_sent_at IS NULL AND status IN ('booked', 'confirmed');

-- ── RLS ──────────────────────────────────────────────────────
-- Lectura: miembros del workspace. Escritura: admin / manager.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'booking_settings', 'booking_services', 'booking_staff',
    'booking_staff_services', 'booking_hours', 'booking_time_off'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_write', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (workspace_id IN (SELECT public.auth_workspace_ids()))',
      t || '_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (public.auth_has_role(workspace_id, ARRAY[''admin'',''manager'']::public.workspace_role[])) WITH CHECK (public.auth_has_role(workspace_id, ARRAY[''admin'',''manager'']::public.workspace_role[]))',
      t || '_write', t);
  END LOOP;
END $$;

-- ── Catálogo de tools del agente ─────────────────────────────
INSERT INTO public.tools (key, name, description, schema, sensitivity) VALUES
  ('agenda_services', 'Agenda: servicios',
   'Lists the bookable services (duration, price) and which professionals do each one',
   '{"type":"object","properties":{}}', 'read'),
  ('agenda_slots', 'Agenda: huecos libres',
   'Returns real free slots from the native calendar for a service and date range',
   '{"type":"object","properties":{"service_id":{"type":"string"},"date_from":{"type":"string"},"date_to":{"type":"string"},"staff_id":{"type":"string"}},"required":["service_id","date_from"]}',
   'read'),
  ('agenda_book', 'Agenda: reservar cita',
   'Books an appointment in the native calendar after the customer confirms',
   '{"type":"object","properties":{"service_id":{"type":"string"},"start":{"type":"string"},"staff_id":{"type":"string"},"customer_name":{"type":"string"},"notes":{"type":"string"}},"required":["service_id","start"]}',
   'write'),
  ('agenda_my_appointments', 'Agenda: mis citas',
   'Lists the upcoming appointments of the contact in this conversation',
   '{"type":"object","properties":{}}', 'read'),
  ('agenda_cancel', 'Agenda: cancelar cita',
   'Cancels one of the contact''s own upcoming appointments',
   '{"type":"object","properties":{"appointment_id":{"type":"string"}},"required":["appointment_id"]}',
   'write'),
  ('agenda_reschedule', 'Agenda: cambiar cita',
   'Moves one of the contact''s own appointments to a new free slot',
   '{"type":"object","properties":{"appointment_id":{"type":"string"},"new_start":{"type":"string"},"staff_id":{"type":"string"}},"required":["appointment_id","new_start"]}',
   'write')
ON CONFLICT (key) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      schema = EXCLUDED.schema,
      sensitivity = EXCLUDED.sensitivity;

-- ============================================================
-- End of migration: 20261109000000_native_calendar
-- ============================================================
