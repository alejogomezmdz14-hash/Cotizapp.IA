// tests/donut-gradient.test.ts
import assert from "node:assert/strict";
import test from "node:test";

import { buildConicGradient } from "../lib/donut-gradient";

test("buildConicGradient reparte los tramos proporcional al valor", () => {
  const gradient = buildConicGradient([
    { value: 1, color: "#00E5A0" },
    { value: 1, color: "#58a6ff" },
  ]);

  assert.equal(
    gradient,
    "conic-gradient(#00E5A0 0.00% 50.00%, #58a6ff 50.00% 100.00%)",
  );
});

test("buildConicGradient ignora segmentos en 0", () => {
  const gradient = buildConicGradient([
    { value: 0, color: "#00E5A0" },
    { value: 3, color: "#58a6ff" },
  ]);

  assert.equal(gradient, "conic-gradient(#58a6ff 0.00% 100.00%)");
});

test("buildConicGradient con total 0 devuelve el color de fondo", () => {
  const gradient = buildConicGradient([{ value: 0, color: "#00E5A0" }]);
  assert.equal(gradient, "rgb(var(--surface-2-rgb))");
});
