/**
 * time.ts — utilidades de zona horaria sin dependencias (Intl nativo).
 *
 * El calendario guarda instantes en UTC (timestamptz) pero piensa en "hora local
 * del negocio": un horario 10:00–14:00 es hora de Madrid, con su cambio de hora.
 * Pure module — seguro en cliente y servidor.
 */

export const DEFAULT_TIMEZONE = "Europe/Madrid";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function safeTimeZone(tz: string | null | undefined): string {
  return tz && isValidTimeZone(tz) ? tz : DEFAULT_TIMEZONE;
}

/** Offset de la zona respecto a UTC en minutos para un instante (Madrid invierno = +60). */
export function offsetMinutes(timeZone: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(
    dtf.formatToParts(at).map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
  return Math.round((asUtc - (at.getTime() - at.getMilliseconds())) / 60000);
}

/** "+01:00" a partir de minutos. */
export function formatOffset(mins: number): string {
  const sign = mins >= 0 ? "+" : "-";
  const abs = Math.abs(mins);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

/** Fecha local (YYYY-MM-DD) + minutos desde medianoche, en la zona dada → instante UTC. */
export function zonedToUtc(
  date: string,
  minutesOfDay: number,
  timeZone: string,
): Date {
  const [y, m, d] = date.split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d, 0, minutesOfDay);
  // Dos pasadas para resolver correctamente alrededor del cambio de hora.
  const first = naive - offsetMinutes(timeZone, new Date(naive)) * 60000;
  const second = naive - offsetMinutes(timeZone, new Date(first)) * 60000;
  return new Date(second);
}

export interface LocalParts {
  date: string; // YYYY-MM-DD
  weekday: number; // 0 = domingo
  minutes: number; // minutos desde medianoche
  time: string; // HH:MM
}

export function localParts(at: Date, timeZone: string): LocalParts {
  const local = new Date(at.getTime() + offsetMinutes(timeZone, at) * 60000);
  const date = local.toISOString().slice(0, 10);
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  return {
    date,
    weekday: local.getUTCDay(),
    minutes,
    time: minutesToTime(minutes),
  };
}

export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

export function isDateString(s: string): boolean {
  return DATE_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

/** "HH:MM" o "HH:MM:SS" → minutos. */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function minutesToTime(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

/**
 * Interpreta una fecha-hora de inicio que propone el agente o el panel.
 * - Con offset o "Z" (2026-11-10T17:30:00+01:00) → instante exacto.
 * - Sin offset (2026-11-10T17:30 o "2026-11-10 17:30") → hora local del negocio.
 * Devuelve null si no se puede interpretar.
 */
export function parseStart(input: string, timeZone: string): Date | null {
  const s = input.trim().replace(" ", "T");
  if (/([zZ]|[+-]\d{2}:?\d{2})$/.test(s)) {
    const t = Date.parse(s);
    return Number.isNaN(t) ? null : new Date(t);
  }
  const m = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m || !isDateString(m[1])) return null;
  const h = Number(m[2]);
  const min = Number(m[3]);
  if (h > 23 || min > 59) return null;
  return zonedToUtc(m[1], h * 60 + min, timeZone);
}

/** "martes, 10 de noviembre" en español. */
export function formatDayLabel(date: string, timeZone = "UTC"): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

/** "martes, 10 de noviembre, 17:30" para un instante en la zona del negocio. */
export function formatHuman(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(at);
}

/** ISO con el offset local del negocio: 2026-11-10T17:30:00+01:00 */
export function toLocalIso(at: Date, timeZone: string): string {
  const p = localParts(at, timeZone);
  return `${p.date}T${p.time}:00${formatOffset(offsetMinutes(timeZone, at))}`;
}
