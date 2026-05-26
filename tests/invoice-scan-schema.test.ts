import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

type SqlMigration = {
  name: string;
  sql: string;
};

function migrationCreatesInvoiceScansWithFileName(sql: string) {
  return /CREATE TABLE(?:\s+public\.)?\s*invoice_scans\s*\([\s\S]*?\bfile_name\s+TEXT\b[\s\S]*?\)/.test(
    sql,
  );
}

function migrationAddsInvoiceScansFileName(sql: string) {
  return /ALTER TABLE(?:\s+public\.)?\s*invoice_scans\s+ADD COLUMN(?:\s+IF NOT EXISTS)?\s+file_name\s+TEXT\b/.test(
    sql,
  );
}

function migrationCreatesInvoiceScans(sql: string) {
  return /CREATE TABLE(?:\s+public\.)?\s*invoice_scans\s*\(/.test(sql);
}

async function getInvoiceScanMigrations() {
  const migrationsDirectory = path.resolve(import.meta.dirname, "../supabase/migrations");
  const migrationNames = (await readdir(migrationsDirectory))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  const contents = await Promise.all(
    migrationNames.map((name) =>
      readFile(path.join(migrationsDirectory, name), "utf8"),
    ),
  );

  return contents.map(
    (sql, index): SqlMigration => ({
      name: migrationNames[index] ?? "unknown",
      sql,
    }),
  );
}

test("invoice_scans migrations persist the original uploaded file name", async () => {
  const migrations = await getInvoiceScanMigrations();
  const createIndex = migrations.findIndex((migration) =>
    migrationCreatesInvoiceScans(migration.sql),
  );

  assert.notEqual(createIndex, -1, "Expected a migration that creates invoice_scans.");

  const createMigration = migrations[createIndex];
  assert.ok(createMigration, "Expected to resolve the invoice_scans creation migration.");

  if (migrationCreatesInvoiceScansWithFileName(createMigration.sql)) {
    return;
  }

  const addColumnMigration = migrations
    .slice(createIndex + 1)
    .find((migration) => migrationAddsInvoiceScansFileName(migration.sql));

  assert.ok(
    addColumnMigration,
    [
      "Expected invoice_scans to include file_name either in its CREATE TABLE",
      `statement or in a later corrective migration after ${createMigration.name}.`,
    ].join(" "),
  );
});
