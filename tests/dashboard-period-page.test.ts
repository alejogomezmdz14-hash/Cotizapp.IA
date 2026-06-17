import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("DashboardPage usa getDashboardPeriodSummary para semana y mes", async () => {
  const source = await readFile(
    new URL("../app/(dashboard)/dashboard/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /getDashboardPeriodSummary/);
  assert.match(source, /"week"/);
  assert.match(source, /"month"/);
  assert.match(source, /<DashboardPeriodSummary[\s\S]*week=\{[\s\S]*month=\{/);
});
