/**
 * public-slug.ts — utilidades puras para el enlace público y teléfonos.
 * Sin dependencias de servidor: se puede importar desde el cliente.
 */

/** Rutas del panel y palabras que no pueden ser el enlace de un negocio. */
export const RESERVED_SLUGS = new Set([
  "admin",
  "agency",
  "agenda",
  "api",
  "app",
  "ayuda",
  "blog",
  "contacto",
  "dashboard",
  "forgot-password",
  "inbox",
  "legal",
  "login",
  "onboarding",
  "panel",
  "precios",
  "privacidad",
  "r",
  "reset-password",
  "settings",
  "signup",
  "soporte",
  "ui",
  "workspaces",
  "www",
]);

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/;

/** "Barbería Juan Ñ" → "barberia-juan-n" */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
}

export function isValidPublicSlug(slug: string): boolean {
  return SLUG_RE.test(slug) && !RESERVED_SLUGS.has(slug);
}

/** Normaliza un teléfono a E.164; los números españoles sin prefijo reciben +34. */
export function normalizePhone(raw: string): string | null {
  let p = raw.replace(/[\s().-]/g, "");
  if (p.startsWith("00")) p = `+${p.slice(2)}`;
  if (/^[6789]\d{8}$/.test(p)) p = `+34${p}`;
  return /^\+\d{8,15}$/.test(p) ? p : null;
}

/** URL base de las páginas públicas (holacitaya.app). */
export const PUBLIC_SITE_URL =
  process.env.NEXT_PUBLIC_PUBLIC_SITE_URL ?? "https://holacitaya.app";
