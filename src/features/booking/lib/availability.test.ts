/**
 * Tests del motor de huecos. Ejecutar con:
 *   npx tsx --test src/features/booking/lib/availability.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSlots, summarizeSlots } from "./availability";
import {
  formatHuman,
  localParts,
  parseStart,
  toLocalIso,
  zonedToUtc,
} from "./time";

const TZ = "Europe/Madrid";

const staff = [
  {
    id: "ana",
    name: "Ana",
    // Martes (2) con turno partido 10–14 y 17–20
    hours: [
      { weekday: 2, start: "10:00", end: "14:00" },
      { weekday: 2, start: "17:00", end: "20:00" },
    ],
  },
  {
    id: "luis",
    name: "Luis",
    hours: [{ weekday: 2, start: "10:00", end: "12:00" }],
  },
];

const base = {
  timeZone: TZ,
  dateFrom: "2026-11-10", // martes
  dateTo: "2026-11-10",
  durationMin: 30,
  stepMin: 30,
  notBefore: new Date("2026-01-01T00:00:00Z"),
  notAfter: new Date("2027-01-01T00:00:00Z"),
  staff,
  busy: [],
};

test("zonedToUtc respeta el horario de invierno y verano de Madrid", () => {
  assert.equal(
    zonedToUtc("2026-11-10", 10 * 60, TZ).toISOString(),
    "2026-11-10T09:00:00.000Z",
  );
  assert.equal(
    zonedToUtc("2026-07-10", 10 * 60, TZ).toISOString(),
    "2026-07-10T08:00:00.000Z",
  );
});

test("parseStart acepta ISO con offset y hora local sin offset", () => {
  assert.equal(
    parseStart("2026-11-10T17:30:00+01:00", TZ)!.toISOString(),
    "2026-11-10T16:30:00.000Z",
  );
  assert.equal(
    parseStart("2026-11-10T17:30", TZ)!.toISOString(),
    "2026-11-10T16:30:00.000Z",
  );
  assert.equal(parseStart("mañana a las 5", TZ), null);
});

test("toLocalIso y localParts devuelven la hora del negocio", () => {
  const d = new Date("2026-11-10T16:30:00Z");
  assert.equal(toLocalIso(d, TZ), "2026-11-10T17:30:00+01:00");
  assert.equal(localParts(d, TZ).weekday, 2);
  assert.match(formatHuman(d, TZ), /martes.*10.*noviembre.*17:30/);
});

test("genera huecos en el turno partido y el servicio cabe entero", () => {
  const slots = computeSlots(base);
  const ana = slots.filter((s) => s.staffId === "ana");
  // 10:00–14:00 → 8 huecos; 17:00–20:00 → 6 huecos
  assert.equal(ana.length, 14);
  const last = ana[ana.length - 1];
  assert.equal(localParts(last.start, TZ).time, "19:30");
  const luis = slots.filter((s) => s.staffId === "luis");
  assert.equal(luis.length, 4);
});

test("un servicio de 45 min no empieza si no cabe antes del cierre", () => {
  const slots = computeSlots({ ...base, durationMin: 45, stepMin: 15 });
  const lastMorning = slots
    .filter((s) => s.staffId === "ana")
    .map((s) => localParts(s.start, TZ).time)
    .filter((t) => t < "15:00")
    .pop();
  assert.equal(lastMorning, "13:15");
});

test("las citas y cierres bloquean huecos", () => {
  const slots = computeSlots({
    ...base,
    busy: [
      // Ana ocupada 10:00–11:00
      {
        staffId: "ana",
        start: new Date("2026-11-10T09:00:00Z"),
        end: new Date("2026-11-10T10:00:00Z"),
      },
      // Cierre general por la tarde
      {
        staffId: null,
        start: new Date("2026-11-10T15:00:00Z"),
        end: new Date("2026-11-10T20:00:00Z"),
      },
    ],
  });
  const anaTimes = slots
    .filter((s) => s.staffId === "ana")
    .map((s) => localParts(s.start, TZ).time);
  assert.ok(!anaTimes.includes("10:00"));
  assert.ok(!anaTimes.includes("10:30"));
  assert.ok(anaTimes.includes("11:00"));
  assert.ok(!anaTimes.some((t) => t >= "17:00"));
  // Luis sigue libre a las 10:00
  assert.ok(
    slots.some(
      (s) => s.staffId === "luis" && localParts(s.start, TZ).time === "10:00",
    ),
  );
});

test("respeta la antelación mínima", () => {
  const slots = computeSlots({
    ...base,
    notBefore: new Date("2026-11-10T11:00:00Z"), // 12:00 local
  });
  const first = slots[0];
  assert.equal(localParts(first.start, TZ).time, "12:00");
});

test("no hay huecos los días sin horario", () => {
  const slots = computeSlots({
    ...base,
    dateFrom: "2026-11-11",
    dateTo: "2026-11-11",
  });
  assert.equal(slots.length, 0);
});

test("summarizeSlots agrupa por hora con los profesionales libres", () => {
  const slots = computeSlots(base);
  const days = summarizeSlots(slots, staff, TZ);
  assert.equal(days.length, 1);
  const ten = days[0].times.find((t) => t.time === "10:00")!;
  assert.deepEqual(ten.staff, ["Ana", "Luis"]);
});

test("el día del cambio de hora no genera horas inexistentes", () => {
  // 29 mar 2026 (domingo): en Madrid de 02:00 se salta a 03:00
  const slots = computeSlots({
    ...base,
    dateFrom: "2026-03-29",
    dateTo: "2026-03-29",
    staff: [
      {
        id: "x",
        name: "X",
        hours: [{ weekday: 0, start: "01:00", end: "04:00" }],
      },
    ],
  });
  const times = slots.map((s) => localParts(s.start, TZ).time);
  assert.ok(!times.includes("02:00"));
  assert.ok(!times.includes("02:30"));
  assert.ok(times.includes("03:00"));
});
