// tests/sparkline-points.test.ts
import assert from "node:assert/strict";
import test from "node:test";

import { buildSparklinePoints } from "../lib/sparkline-points";

test("buildSparklinePoints devuelve '' con menos de 2 valores", () => {
  assert.equal(buildSparklinePoints([]), "");
  assert.equal(buildSparklinePoints([5]), "");
});

test("buildSparklinePoints reparte el ancho 0..100 y mapea min/max al alto", () => {
  // Dos puntos: x va de 0 a 100. El mínimo (0) cae abajo, el máximo (10) arriba.
  const points = buildSparklinePoints([0, 10]);
  const pairs = points.split(" ").map((p) => p.split(",").map(Number));

  assert.equal(pairs.length, 2);
  assert.equal(pairs[0][0], 0); // primer x
  assert.equal(pairs[1][0], 100); // último x
  // y del máximo es menor (más arriba) que y del mínimo
  assert.ok(pairs[1][1] < pairs[0][1]);
});

test("buildSparklinePoints con todos los valores iguales no rompe (línea plana)", () => {
  const points = buildSparklinePoints([5, 5, 5]);
  const ys = points.split(" ").map((p) => Number(p.split(",")[1]));
  assert.ok(ys.every((y) => Number.isFinite(y)));
});
