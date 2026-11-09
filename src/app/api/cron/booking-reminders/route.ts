import { NextResponse } from "next/server";
import { runAppointmentReminders } from "@/features/booking/services/reminders";

// ──────────────────────────────────────────────────────────────────────────────
// Cron: recordatorios de citas del calendario propio.
// Se llama desde pg_cron (ver supabase/cron/schedule-booking-reminders.sql)
// con Authorization: Bearer {CRON_SECRET}, igual que buffer-flush.
// ──────────────────────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get("Authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runAppointmentReminders();
  return NextResponse.json({ ok: true, ...result });
}
