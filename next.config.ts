import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Dominio público de Citaya y panel de gestión.
const PUBLIC_HOST_RE = process.env.PUBLIC_HOST_RE ?? "(?:www\\.)?holacitaya\\.app";
const PANEL_URL = process.env.PANEL_URL ?? "https://panel.holacitaya.app";
const PANEL_PATHS = [
  "login",
  "signup",
  "forgot-password",
  "reset-password",
  "inbox",
  "agenda",
  "settings",
  "dashboard",
  "workspaces",
  "onboarding",
];

// connect-src: realtime needs the wss:// scheme explicitly (a schemeless
// host-source does not reliably match WebSocket connections). In dev we also
// allow the localhost HMR/RSC sockets so Turbopack's runtime works under CSP.
const connectSrc = [
  "'self'",
  "*.supabase.co",
  "wss://*.supabase.co",
  "api.ycloud.com",
  "openrouter.ai",
  "services.leadconnectorhq.com",
  ...(isDev ? ["ws://localhost:*", "http://localhost:*"] : []),
].join(" ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: *.supabase.co",
      "media-src 'self' blob: *.supabase.co",
      "font-src 'self' data:",
      `connect-src ${connectSrc}`,
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  ...(process.env.NODE_ENV !== "production" && {
    experimental: {
      mcpServer: true,
    },
  }),
  headers: async () => [
    {
      source: "/(.*)",
      headers: securityHeaders,
    },
  ],
  // holacitaya.app (dominio público): portada + páginas de reservas.
  // Las rutas del panel que lleguen ahí se mandan a panel.holacitaya.app.
  redirects: async () =>
    PANEL_PATHS.map((p) => ({
      source: `/${p}/:rest*`,
      has: [{ type: "host" as const, value: PUBLIC_HOST_RE }],
      destination: `${PANEL_URL}/${p}/:rest*`,
      permanent: false,
    })),
  rewrites: async () => ({
    beforeFiles: [
      {
        source: "/:slug([a-z0-9][a-z0-9-]{1,48}[a-z0-9])",
        has: [{ type: "host", value: PUBLIC_HOST_RE }],
        destination: "/r/:slug",
      },
    ],
    afterFiles: [
      // Serve the app icon for legacy /favicon.ico probes (avoids a 404).
      { source: "/favicon.ico", destination: "/icon.svg" },
    ],
    fallback: [],
  }),
};

export default nextConfig;
