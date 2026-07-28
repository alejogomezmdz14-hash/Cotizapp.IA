import assert from "node:assert/strict";
import test from "node:test";

import {
  getArgentinaMonthDateBounds,
  getArgentinaMonthInstantBounds,
  getArgentinaToday,
  getArgentinaYearMonth,
} from "../lib/argentina-time";

// 2026-08-01T02:00:00Z = 2026-07-31 23:00 en Argentina (UTC-3). Es el caso que
// rompía: en UTC ya es agosto, pero en Argentina todavía es julio.
const LATE_NIGHT = new Date("2026-08-01T02:00:00Z");

test("getArgentinaYearMonth usa el calendario argentino, no UTC", () => {
  assert.deepEqual(getArgentinaYearMonth(LATE_NIGHT), { year: 2026, month: 7 });
  assert.deepEqual(
    getArgentinaYearMonth(new Date("2026-07-15T12:00:00Z")),
    { year: 2026, month: 7 },
  );
});

test("getArgentinaToday devuelve la fecha argentina", () => {
  assert.equal(getArgentinaToday(LATE_NIGHT), "2026-07-31");
  assert.equal(getArgentinaToday(new Date("2026-07-01T02:00:00Z")), "2026-06-30");
});

test("getArgentinaMonthDateBounds da el mes calendario argentino", () => {
  const bounds = getArgentinaMonthDateBounds(0, LATE_NIGHT);
  assert.equal(bounds.monthStart, "2026-07-01");
  assert.equal(bounds.nextMonthStart, "2026-08-01");
  assert.equal(bounds.monthEnd, "2026-07-31");
});

test("getArgentinaMonthDateBounds(1) retrocede un mes", () => {
  const bounds = getArgentinaMonthDateBounds(1, LATE_NIGHT);
  assert.equal(bounds.monthStart, "2026-06-01");
  assert.equal(bounds.nextMonthStart, "2026-07-01");
});

test("getArgentinaMonthInstantBounds usa el offset UTC-3", () => {
  const bounds = getArgentinaMonthInstantBounds(0, LATE_NIGHT);
  assert.equal(bounds.isoStart, "2026-07-01T03:00:00.000Z");
  assert.equal(bounds.isoNextStart, "2026-08-01T03:00:00.000Z");
});

test("un pago a las 23:00 ART del último día cae en el mes correcto", () => {
  const { isoStart, isoNextStart } = getArgentinaMonthInstantBounds(0, LATE_NIGHT);
  // 2026-08-01T02:00:00Z = 2026-07-31 23:00 ART → debe contar en julio.
  const pago = "2026-08-01T02:00:00.000Z";
  assert.ok(pago >= isoStart && pago < isoNextStart);
  // 2026-08-01T04:00:00Z = 2026-08-01 01:00 ART → ya es agosto.
  assert.ok("2026-08-01T04:00:00.000Z" >= isoNextStart);
});
