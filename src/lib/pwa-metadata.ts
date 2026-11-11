import type { Metadata, Viewport } from "next";

/** Metadatos de la app instalable (panel y acceso). La web pública no los usa. */
export const pwaMetadata: Metadata = {
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Citaya",
    statusBarStyle: "black",
  },
  applicationName: "Citaya",
};

export const pwaViewport: Viewport = {
  themeColor: "#0f1115",
  viewportFit: "cover",
};
