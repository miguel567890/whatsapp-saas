import { CalendarCheck } from "lucide-react";
import { RegisterServiceWorker } from "@/components/pwa";
import { pwaMetadata, pwaViewport } from "@/lib/pwa-metadata";

export const metadata = pwaMetadata;
export const viewport = pwaViewport;

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-8 px-4 py-10">
      <span className="inline-flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
          <CalendarCheck className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="font-display text-2xl font-semibold tracking-tight text-foreground">
          Citaya
        </span>
      </span>
      {children}
      <RegisterServiceWorker />
    </div>
  );
}
