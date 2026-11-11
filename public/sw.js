/* Citaya — service worker mínimo.
 * No guarda en caché ninguna página (todas dependen de la sesión y de datos al
 * día). Solo sirve para que el panel se pueda instalar como app y para mostrar
 * un aviso claro cuando el móvil se queda sin conexión. */

const OFFLINE_HTML = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sin conexión · Citaya</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f1115;color:#f3f4f6;font-family:system-ui,sans-serif;text-align:center;padding:24px}
.b{display:inline-grid;place-items:center;width:56px;height:56px;border-radius:14px;background:#c4f000;color:#0f1115;font-weight:700;font-size:26px}
h1{font-size:20px;margin:20px 0 8px}p{color:#9ca3af;margin:0 0 24px}
button{background:#c4f000;color:#0f1115;border:0;border-radius:10px;padding:12px 20px;font-weight:600;font-size:15px}</style></head>
<body><div><span class="b">C</span><h1>Sin conexión</h1><p>Revisa tu internet y vuelve a intentarlo.</p>
<button onclick="location.reload()">Reintentar</button></div></body></html>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      () => new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } }),
    ),
  );
});
