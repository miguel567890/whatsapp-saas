-- ============================================================
-- Post-deploy cron: recordatorios de citas (calendario propio)
--
-- Igual que schedule-buffer-flush.sql: sustituye los dos marcadores con los
-- valores de tu .env.local y ejecútalo en Supabase → SQL Editor.
--
--   __APP_URL__      -> NEXT_PUBLIC_APP_URL  (sin barra final)
--   __CRON_SECRET__  -> CRON_SECRET
--
-- Cada 10 minutos es suficiente: el recordatorio sale entre 0 y 10 min
-- después de entrar en la ventana "X horas antes". Idempotente.
-- ============================================================

select cron.schedule(
  'booking-reminders',
  '*/10 * * * *',
  $job$
    select net.http_get(
      url     := '__APP_URL__/api/cron/booking-reminders',
      headers := jsonb_build_object('Authorization', 'Bearer __CRON_SECRET__')
    );
  $job$
);

-- Verificar:
--   select jobname, schedule, active from cron.job where jobname = 'booking-reminders';
-- Quitar:
--   select cron.unschedule('booking-reminders');
