import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  ACTIVE_WORKSPACE_COOKIE,
  getActiveWorkspace,
} from "@/features/workspace/services/active-workspace";
import { getPanelMode } from "@/features/workspace/services/panel-mode";
import {
  bookingDb,
  listAppointmentsBetween,
  loadBookingConfig,
} from "@/features/booking/services/booking-service";
import { addDays, localParts, zonedToUtc } from "@/features/booking/lib/time";
import { PUBLIC_SITE_URL } from "@/features/booking/lib/public-slug";
import {
  TodayView,
  type PendingChat,
} from "@/features/booking/components/today-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Hoy · Citaya" };

export default async function HoyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const mode = await getPanelMode(supabase, user.id);
  // La agencia entra a un negocio desde su panel; sin negocio elegido, a la lista.
  const activeCookie = (await cookies()).get(ACTIVE_WORKSPACE_COOKIE)?.value;
  if (mode === "agency" && !activeCookie) redirect("/workspaces");

  const membership = await getActiveWorkspace(supabase, user.id);
  if (!membership) redirect(mode === "agency" ? "/workspaces" : "/onboarding");
  const workspaceId = membership.workspace_id;

  const db = bookingDb();
  const config = await loadBookingConfig(db, workspaceId);
  const now = new Date();
  const today = localParts(now, config.timeZone).date;
  const tomorrow = addDays(today, 1);

  const [todayAppts, tomorrowAppts, { data: bi }, { data: ws }, { data: chats }] =
    await Promise.all([
      listAppointmentsBetween(
        workspaceId,
        zonedToUtc(today, 0, config.timeZone),
        zonedToUtc(tomorrow, 0, config.timeZone),
      ),
      listAppointmentsBetween(
        workspaceId,
        zonedToUtc(tomorrow, 0, config.timeZone),
        zonedToUtc(addDays(tomorrow, 1), 0, config.timeZone),
      ),
      db
        .from("business_info")
        .select("structured")
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
      db.from("workspaces").select("name").eq("id", workspaceId).maybeSingle(),
      // Conversaciones en las que el negocio tiene que intervenir.
      supabase
        .from("conversations")
        .select("id, state, unread_count, last_message_at, contact:contacts(name, phone)")
        .eq("workspace_id", workspaceId)
        .or("state.eq.handoff_pending,and(state.eq.human_active,unread_count.gt.0)")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(5),
    ]);

  const businessName =
    ((bi?.structured as Record<string, unknown> | null)?.name as string | undefined) ||
    (ws?.name as string | undefined) ||
    "tu negocio";

  const pendingChats: PendingChat[] = (chats ?? []).map((c) => {
    const contact = (Array.isArray(c.contact) ? c.contact[0] : c.contact) as
      | { name: string | null; phone: string }
      | null;
    return {
      id: c.id as string,
      state: c.state as string,
      unread: (c.unread_count as number) ?? 0,
      lastAt: (c.last_message_at as string | null) ?? null,
      name: contact?.name ?? null,
      phone: contact?.phone ?? null,
    };
  });

  const s = config.settings;
  const publicUrl =
    s.public_enabled && s.public_slug ? `${PUBLIC_SITE_URL}/${s.public_slug}` : null;

  return (
    <TodayView
      workspaceId={workspaceId}
      businessName={businessName}
      config={config}
      today={today}
      nowIso={now.toISOString()}
      appointments={todayAppts}
      tomorrowCount={
        tomorrowAppts.filter((a) => a.status === "booked" || a.status === "confirmed")
          .length
      }
      pendingChats={pendingChats}
      publicUrl={publicUrl}
    />
  );
}
