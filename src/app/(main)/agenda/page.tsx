import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/features/workspace/services/active-workspace";
import {
  bookingDb,
  listAppointmentsBetween,
  loadBookingConfig,
} from "@/features/booking/services/booking-service";
import {
  addDays,
  isDateString,
  localParts,
  weekdayOf,
  zonedToUtc,
} from "@/features/booking/lib/time";
import { AgendaBoard } from "@/features/booking/components/agenda-board";

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await getActiveWorkspace(supabase, user.id);
  if (!membership) redirect("/settings");

  const workspaceId = membership.workspace_id;
  const config = await loadBookingConfig(bookingDb(), workspaceId);

  const today = localParts(new Date(), config.timeZone).date;
  const { date } = await searchParams;
  const anchor = date && isDateString(date) ? date : today;
  // Semana de lunes a domingo
  const monday = addDays(anchor, -((weekdayOf(anchor) + 6) % 7));
  const nextMonday = addDays(monday, 7);

  const appointments = await listAppointmentsBetween(
    workspaceId,
    zonedToUtc(monday, 0, config.timeZone),
    zonedToUtc(nextMonday, 0, config.timeZone),
  );

  return (
    <AgendaBoard
      workspaceId={workspaceId}
      role={membership.role}
      config={config}
      weekStart={monday}
      today={today}
      appointments={appointments}
    />
  );
}
