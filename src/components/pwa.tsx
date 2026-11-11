"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Registra el service worker (solo en producción). */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Si falla, el panel sigue funcionando igual en el navegador.
    });
  }, []);
  return null;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "citaya-install-dismissed";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

type Platform = "standalone" | "ios" | "other";

function detectPlatform(): Platform {
  const nav = navigator as Navigator & { standalone?: boolean };
  if (window.matchMedia("(display-mode: standalone)").matches || nav.standalone) {
    return "standalone";
  }
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
  return ios ? "ios" : "other";
}

const noop = () => () => {};

/**
 * Tarjeta "Instala Citaya en tu móvil". En Android/Chrome usa el aviso nativo
 * de instalación; en iPhone explica los dos toques de Safari. Se oculta si ya
 * está instalada o si el usuario la cierra.
 */
export function InstallAppCard() {
  // Valores que solo existen en el navegador: en el servidor, "standalone"
  // (no se pinta nada) para no descuadrar la hidratación.
  const platform = useSyncExternalStore<Platform>(noop, detectPlatform, () => "standalone");
  const initiallyDismissed = useSyncExternalStore(noop, readDismissed, () => true);
  const [dismissed, setDismissed] = useState(false);
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || dismissed || initiallyDismissed || platform === "standalone") return null;
  if (platform === "other" && !prompt) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Sin almacenamiento: se volverá a mostrar la próxima vez, no pasa nada.
    }
  }

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    setPrompt(null);
    if (outcome === "accepted") setInstalled(true);
  }

  return (
    <div className="relative flex items-start gap-3 rounded-lg border border-primary/40 bg-primary/10 p-4 pr-10">
      <Download className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0 space-y-2">
        <p className="text-sm font-medium">Ten Citaya en tu móvil como una app</p>
        {platform === "ios" ? (
          <p className="text-sm text-muted-foreground">
            En Safari, pulsa{" "}
            <Share className="inline h-4 w-4 align-text-bottom" aria-label="Compartir" />{" "}
            y luego <strong className="text-foreground">«Añadir a pantalla de inicio»</strong>.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Se abre desde un icono en tu pantalla de inicio, sin buscar la web.
            </p>
            <Button size="sm" onClick={install}>
              Instalar
            </Button>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Cerrar"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
