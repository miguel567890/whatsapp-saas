"use server";

/**
 * public-actions.ts — server actions que usa la página de reservas pública.
 * No requieren sesión: validan todo en servidor y solo actúan sobre negocios
 * con la página activada.
 */

import { z } from "zod";
import {
  bookPublic,
  getPublicAvailability,
  type PublicBookingResult,
  type PublicDay,
} from "./public-booking";

const slug = z.string().min(3).max(50);
// Formato UUID sin exigir versión (los de la base de datos son v4).
const id = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

export async function fetchAvailability(
  slugValue: string,
  serviceId: string,
  staffId: string | null,
): Promise<PublicDay[]> {
  const parsed = z
    .object({ slug, serviceId: id, staffId: id.nullable() })
    .safeParse({ slug: slugValue, serviceId, staffId });
  if (!parsed.success) return [];
  return (
    (await getPublicAvailability(
      parsed.data.slug,
      parsed.data.serviceId,
      parsed.data.staffId,
    )) ?? []
  );
}

const bookingSchema = z.object({
  serviceId: id,
  staffId: id.nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  name: z.string().max(80),
  phone: z.string().max(30),
  consent: z.boolean(),
  // Campo trampa para bots: un humano nunca lo rellena.
  website: z.string().max(200).optional(),
});

export async function submitPublicBooking(
  slugValue: string,
  input: unknown,
): Promise<PublicBookingResult> {
  const s = slug.safeParse(slugValue);
  const parsed = bookingSchema.safeParse(input);
  if (!s.success || !parsed.success) {
    return { ok: false, error: "Revisa los datos de la reserva." };
  }
  if (parsed.data.website) {
    return { ok: false, error: "No se pudo hacer la reserva." };
  }
  const { website: _honeypot, ...rest } = parsed.data;
  void _honeypot;
  return bookPublic(s.data, rest);
}
