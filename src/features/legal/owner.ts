/**
 * Datos del titular de Citaya que exige la ley (LSSI y RGPD).
 * Se cambian aquí y se actualizan solos en todas las páginas legales.
 */
export const OWNER = {
  name: "Juan Miguel Calero",
  nif: "", // DNI/NIF del titular: obligatorio antes de publicar
  address: "Calle Sánchez Flores, 11180 Alcalá de los Gazules (Cádiz), España",
  email: "", // email de contacto para avisos legales y protección de datos
  /** Contacto mientras no haya email: WhatsApp de Citaya. */
  whatsapp: "+34 613 08 69 85",
  brand: "Citaya",
  site: "holacitaya.app",
} as const;

/** Fecha de la última revisión de los textos legales. */
export const LEGAL_UPDATED = "12 de noviembre de 2026";

/**
 * Proveedores que tratan datos por cuenta de Citaya (subencargados).
 * Si se cambia de proveedor, se actualiza esta lista y se avisa a los negocios.
 */
export const SUBPROCESSORS = [
  { name: "Vercel Inc.", role: "Alojamiento de la web y del panel", where: "EE. UU. / UE" },
  { name: "Supabase Inc.", role: "Base de datos y cuentas de acceso", where: "EE. UU. / UE" },
  { name: "YCloud", role: "Conexión oficial con la API de WhatsApp Business", where: "Fuera de la UE" },
  { name: "Meta Platforms Ireland Ltd. (WhatsApp)", role: "Envío y recepción de mensajes de WhatsApp", where: "UE / EE. UU." },
  { name: "OpenRouter / Anthropic", role: "Inteligencia artificial que redacta las respuestas de la recepcionista", where: "EE. UU." },
] as const;
