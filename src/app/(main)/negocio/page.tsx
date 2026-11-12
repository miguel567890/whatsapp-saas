import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/features/workspace/services/active-workspace";
import { getPanelMode } from "@/features/workspace/services/panel-mode";
import {
  bookingDb,
  loadBookingConfig,
} from "@/features/booking/services/booking-service";
import { getBookingTemplatesStatus } from "@/features/booking/services/booking-templates";
import { AgendaSettingsTab } from "@/features/booking/components/agenda-settings-tab";
import { BusinessInfoForm } from "@/features/settings/components/business-info-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mi negocio · Citaya" };

/** "Mi negocio": lo que el negocio puede cambiar sin tocar nada técnico. */
export default async function NegocioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [mode, membership] = await Promise.all([
    getPanelMode(supabase, user.id),
    getActiveWorkspace(supabase, user.id),
  ]);
  if (!membership) redirect(mode === "agency" ? "/workspaces" : "/onboarding");
  const workspaceId = membership.workspace_id;

  const db = bookingDb();
  const [config, { data: bi }, templateStatus] = await Promise.all([
    loadBookingConfig(db, workspaceId),
    db
      .from("business_info")
      .select("structured, free_text")
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    getBookingTemplatesStatus(workspaceId),
  ]);
  const businessInfo = bi
    ? {
        structured: (bi.structured as Record<string, unknown>) ?? {},
        free_text: (bi.free_text as string | null) ?? null,
      }
    : null;
  const canEdit = membership.role === "admin" || membership.role === "manager";

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="mb-1 font-display text-2xl font-semibold text-foreground">
        Mi negocio
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Servicios, horarios, tu equipo y lo que tu recepcionista cuenta a los clientes.
      </p>

      {!canEdit && (
        <p className="mb-6 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          Puedes verlo todo, pero solo el responsable del negocio puede hacer cambios.
        </p>
      )}

      <Tabs defaultValue="agenda">
        <TabsList className="mb-6">
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="negocio">Negocio</TabsTrigger>
        </TabsList>

        <TabsContent value="agenda">
          <div className="rounded-lg border border-border/60 bg-card p-4 sm:p-6">
            <AgendaSettingsTab
              workspaceId={workspaceId}
              initialConfig={config}
              businessName={(businessInfo?.structured.name as string | undefined) ?? null}
              simple={mode === "business"}
              templateStatus={templateStatus}
            />
          </div>
        </TabsContent>

        <TabsContent value="negocio">
          <div className="rounded-lg border border-border/60 bg-card p-4 sm:p-6">
            <BusinessInfoForm workspaceId={workspaceId} initial={businessInfo} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
