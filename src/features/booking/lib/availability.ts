/**
 * availability.ts — cálculo puro de huecos libres (sin DB, testeable).
 *
 * Un hueco es válido para un profesional si:
 *   - cae dentro de alguno de sus tramos de horario de ese día de la semana,
 *   - el servicio completo cabe antes del fin del tramo,
 *   - no se solapa con citas activas suyas ni con cierres (suyos o del negocio),
 *   - respeta la antelación mínima y el máximo de días vista.
 */

import {
  addDays,
  daysBetween,
  localParts,
  timeToMinutes,
  weekdayOf,
  zonedToUtc,
} from "./time";

export interface HoursRange {
  weekday: number; // 0 = domingo
  start: string; // "10:00"
  end: string; // "14:00"
}

export interface StaffAvailabilityInput {
  id: string;
  name: string;
  hours: HoursRange[];
}

export interface BusyBlock {
  /** null = afecta a todo el negocio (cierre general). */
  staffId: string | null;
  start: Date;
  end: Date;
}

export interface SlotQuery {
  timeZone: string;
  dateFrom: string; // YYYY-MM-DD (local)
  dateTo: string; // YYYY-MM-DD (local, inclusive)
  durationMin: number;
  stepMin: number;
  notBefore: Date;
  notAfter: Date;
  staff: StaffAvailabilityInput[];
  busy: BusyBlock[];
}

export interface Slot {
  start: Date;
  end: Date;
  staffId: string;
}

/** Límite de seguridad para no generar rangos enormes. */
export const MAX_RANGE_DAYS = 31;

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

export function computeSlots(q: SlotQuery): Slot[] {
  const out: Slot[] = [];
  if (q.durationMin <= 0 || q.stepMin <= 0) return out;

  const span = Math.min(daysBetween(q.dateFrom, q.dateTo), MAX_RANGE_DAYS - 1);
  if (span < 0) return out;

  const notBefore = q.notBefore.getTime();
  const notAfter = q.notAfter.getTime();
  const durMs = q.durationMin * 60000;

  for (let i = 0; i <= span; i++) {
    const date = addDays(q.dateFrom, i);
    const weekday = weekdayOf(date);

    for (const member of q.staff) {
      const blocks = q.busy.filter(
        (b) => b.staffId === null || b.staffId === member.id,
      );
      const ranges = member.hours
        .filter((h) => h.weekday === weekday)
        .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

      for (const r of ranges) {
        const rStart = timeToMinutes(r.start);
        const rEnd = timeToMinutes(r.end);
        for (let t = rStart; t + q.durationMin <= rEnd; t += q.stepMin) {
          const start = zonedToUtc(date, t, q.timeZone).getTime();
          const end = start + durMs;
          if (start < notBefore || start > notAfter) continue;
          // Cambio de hora: el instante debe seguir siendo la hora local pedida.
          if (localParts(new Date(start), q.timeZone).minutes !== t) continue;
          const clash = blocks.some((b) =>
            overlaps(start, end, b.start.getTime(), b.end.getTime()),
          );
          if (clash) continue;
          out.push({
            start: new Date(start),
            end: new Date(end),
            staffId: member.id,
          });
        }
      }
    }
  }

  out.sort(
    (a, b) =>
      a.start.getTime() - b.start.getTime() ||
      q.staff.findIndex((s) => s.id === a.staffId) -
        q.staff.findIndex((s) => s.id === b.staffId),
  );
  return out;
}

export interface DaySummary {
  date: string;
  times: { time: string; staff: string[] }[];
}

/** Agrupa los huecos por día y hora local, listando qué profesionales están libres. */
export function summarizeSlots(
  slots: Slot[],
  staff: StaffAvailabilityInput[],
  timeZone: string,
): DaySummary[] {
  const names = new Map(staff.map((s) => [s.id, s.name]));
  const byDay = new Map<string, Map<string, string[]>>();
  for (const s of slots) {
    const p = localParts(s.start, timeZone);
    const day = byDay.get(p.date) ?? new Map<string, string[]>();
    const list = day.get(p.time) ?? [];
    list.push(names.get(s.staffId) ?? s.staffId);
    day.set(p.time, list);
    byDay.set(p.date, day);
  }
  return [...byDay.entries()].map(([date, times]) => ({
    date,
    times: [...times.entries()].map(([time, staffNames]) => ({
      time,
      staff: staffNames,
    })),
  }));
}
