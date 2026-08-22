/**
 * CORE-03C-M1 — safety and correctness tests for the read-only audit tool.
 *
 * Proves, against a SYNTHETIC database built from the real migration
 * history:
 *   - the audit is genuinely read-only (the SQL guard rejects writes, the
 *     file is opened readOnly, and the database file's bytes are identical
 *     before and after a full audit run);
 *   - every classification the audit reports (D2 counts and orphans, D5
 *     item/url categories, legacy counts, QR derivability classes, InboxTodo
 *     mapping classes, integrity findings) matches deliberately seeded data;
 *   - absent structures degrade into explicit TABLE_ABSENT/COLUMN_ABSENT
 *     findings instead of crashes (the production pre-adoption case).
 *
 * All data below is synthetic. Local throwaway SQLite only.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import assert from "node:assert/strict"
import test, { before, after } from "node:test"
import { execFileSync } from "node:child_process"
import { cpSync, mkdtempSync, rmSync, symlinkSync, writeFileSync, readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { assertReadOnlySql, auditSqliteFile, fkTargetsFromManifest } from "./audit-core-03c-m1"

const REPO = process.cwd()
const dir = mkdtempSync(join(tmpdir(), "audit-m1-"))
const dbPath = join(dir, "audit.db")

/** Insert a row filling every NOT NULL/no-default column with a synthetic value. */
function makeInsert(db: DatabaseSync, table: string, values: Record<string, unknown>): void {
  const cols = db.prepare(`PRAGMA table_info("${table}")`).all() as any[]
  const row: Record<string, unknown> = { ...values }
  for (const c of cols) {
    if (row[c.name] !== undefined) continue
    if (c.notnull === 1 && c.dflt_value === null && c.pk === 0) {
      row[c.name] = /INT|REAL|NUM/i.test(c.type) ? 0 : /DATE/i.test(c.type) ? "2026-01-01 00:00:00" : "synthetic"
    }
  }
  const names = Object.keys(row)
  db.prepare(`INSERT INTO "${table}" (${names.map((n) => `"${n}"`).join(",")}) VALUES (${names.map(() => "?").join(",")})`).run(
    ...names.map((n) => row[n] as any),
  )
}

before(() => {
  symlinkSync(join(REPO, "node_modules"), join(dir, "node_modules"))
  // This fixture audits a LEGACY-shaped database: it seeds the dirty rows
  // (NULL items, empty urls, D2 rows, …) that the M1 audit exists to detect.
  // The D5 tightenings (4_d5_schema_tightenings) forbid creating such rows
  // and the D2 retirement (5_d2_retire_legacy_portal_tables) drops the
  // legacy tables the scenario seeds, so the scenario is built from the
  // history UP TO migration 3 — the exact shape those legacy databases had.
  const migrationsCopy = join(dir, "migrations")
  cpSync(join(REPO, "prisma", "migrations"), migrationsCopy, { recursive: true })
  rmSync(join(migrationsCopy, "4_d5_schema_tightenings"), { recursive: true, force: true })
  rmSync(join(migrationsCopy, "5_d2_retire_legacy_portal_tables"), { recursive: true, force: true })
  const configPath = join(dir, "prisma.config.ts")
  writeFileSync(
    configPath,
    [
      'import { defineConfig } from "prisma/config"',
      "export default defineConfig({",
      `  schema: ${JSON.stringify(join(REPO, "prisma", "schema.prisma"))},`,
      `  migrations: { path: ${JSON.stringify(migrationsCopy)} },`,
      `  datasource: { url: ${JSON.stringify(`file:${dbPath}`)} },`,
      "})",
      "",
    ].join("\n"),
  )
  const env: NodeJS.ProcessEnv = { ...process.env }
  delete env.DATABASE_URL
  delete env.TURSO_DATABASE_URL
  delete env.DATABASE_AUTH_TOKEN
  delete env.TURSO_AUTH_TOKEN
  execFileSync(join(REPO, "node_modules", ".bin", "prisma"), ["migrate", "deploy", "--config", configPath], {
    cwd: REPO,
    stdio: "ignore",
    env: { ...env, DOTENV_CONFIG_PATH: "/dev/null", CHECKPOINT_DISABLE: "1", PRISMA_HIDE_UPDATE_MESSAGE: "1" },
  })

  // ── Synthetic seed (writes happen HERE, in the test setup — never in the audit) ──
  const db = new DatabaseSync(dbPath)
  try {
    // Orphan rows are part of the scenario being audited; production Turso
    // never enforced these FKs (CORE-03B), so seed with enforcement off.
    db.exec("PRAGMA foreign_keys = OFF")
    makeInsert(db, "Workspace", { id: "ws1", nombre: "WS One", slug: "ws-one" })
    makeInsert(db, "Workspace", { id: "ws2", nombre: "WS Two", slug: "ws-two" })
    makeInsert(db, "Cliente", { id: "c1", nombre: "Synthetic Client", workspaceId: "ws1" })
    makeInsert(db, "Contact", { id: "ct2", workspaceId: "ws2", nombre: "Synthetic Contact" })
    makeInsert(db, "Tarea", { id: "t1", titulo: "Task WS1", workspaceId: "ws1" })
    makeInsert(db, "Tarea", { id: "t2", titulo: "Task no WS", workspaceId: null })

    // D2 candidates: 2 projects (1 orphan cliente ref), 0 invoices, 1 file.
    makeInsert(db, "ClientProject", { id: "cp1", clienteId: "c1", titulo: "Legacy P" })
    makeInsert(db, "ClientProject", { id: "cp2", clienteId: "ghost-cliente", titulo: "Orphan P" })
    makeInsert(db, "ClientFile", { id: "cf1", clienteId: "c1", nombre: "f", url: "https://example.test/f", mimeType: "x", tamano: 1 })

    // D5 Factura.items: valid array / NULL / empty / invalid JSON.
    makeInsert(db, "Factura", { id: "f1", numero: "F-1", clienteId: "c1", items: '[{"q":1}]' })
    makeInsert(db, "Factura", { id: "f2", numero: "F-2", clienteId: "c1", items: null })
    makeInsert(db, "Factura", { id: "f3", numero: "F-3", clienteId: "c1", items: "" })
    makeInsert(db, "Factura", { id: "f4", numero: "F-4", clienteId: "c1", items: "not-json{" })

    // D5 Documento.url: null / empty / https duplicate pair / relative / other.
    makeInsert(db, "Documento", { id: "d1", nombre: "D", url: null, workspaceId: "ws1" })
    makeInsert(db, "Documento", { id: "d2", nombre: "D", url: "", workspaceId: "ws1" })
    makeInsert(db, "Documento", { id: "d3", nombre: "D", url: "https://example.test/a", workspaceId: "ws1" })
    makeInsert(db, "Documento", { id: "d4", nombre: "D", url: "https://example.test/a", workspaceId: "ws1" })
    makeInsert(db, "Documento", { id: "d5", nombre: "D", url: "/relative/path", workspaceId: "ws1" })
    makeInsert(db, "Documento", { id: "d6", nombre: "D", url: "weird-shape", workspaceId: "ws1" })

    makeInsert(db, "Usuario", { id: "u1", nombre: "Synthetic", email: "syn@test.local" })
    makeInsert(db, "InboxEntry", { id: "ie1", workspaceId: "ws1" })

    // InboxTodo mapping: linked / EXACT / AMBIGUOUS / NO_MATCH.
    makeInsert(db, "WorkspaceTask", { id: "w0", workspaceId: "ws1", title: "linked", createdBy: "u", sourceType: "inbox_todo", sourceId: "todo-linked" })
    makeInsert(db, "WorkspaceTask", { id: "w1", workspaceId: "ws1", title: "exact", createdBy: "u", sourceType: "inbox_todo", sourceId: "todo-exact" })
    makeInsert(db, "WorkspaceTask", { id: "w2", workspaceId: "ws1", title: "amb-a", createdBy: "u", sourceType: "inbox_todo", sourceId: "todo-amb" })
    makeInsert(db, "WorkspaceTask", { id: "w3", workspaceId: "ws1", title: "amb-b", createdBy: "u", sourceType: "inbox_todo", sourceId: "todo-amb" })
    makeInsert(db, "InboxTodo", { id: "todo-linked", workspaceId: "ws1", title: "x", workspaceTaskId: "w0" })
    makeInsert(db, "InboxTodo", { id: "todo-exact", workspaceId: "ws1", title: "x", workspaceTaskId: null })
    makeInsert(db, "InboxTodo", { id: "todo-amb", workspaceId: "ws1", title: "x", workspaceTaskId: null })
    makeInsert(db, "InboxTodo", { id: "todo-none", workspaceId: "ws1", title: "x", workspaceTaskId: null })

    // QR derivability: DETERMINISTIC / AMBIGUOUS (target without ws) / ORPHANED / UNKNOWN module / already scoped.
    makeInsert(db, "QRCode", { id: "q1", module: "clientes", recordId: "c1", url: "https://x", imageData: "i", workspaceId: null })
    makeInsert(db, "QRCode", { id: "q2", module: "tareas", recordId: "t2", url: "https://x", imageData: "i", workspaceId: null })
    makeInsert(db, "QRCode", { id: "q3", module: "clientes", recordId: "ghost", url: "https://x", imageData: "i", workspaceId: null })
    makeInsert(db, "QRCode", { id: "q4", module: "custom", recordId: "zz", url: "https://x", imageData: "i", workspaceId: null })
    makeInsert(db, "QRCode", { id: "q5", module: "clientes", recordId: "c1", url: "https://x", imageData: "i", workspaceId: "ws1" })

    // Integrity: orphan workspace ref + FK orphan + cross-tenant mismatch.
    makeInsert(db, "Conversation", { id: "cv1", workspaceId: "ghost-ws", contactId: "ct2", channel: "email" })
    makeInsert(db, "Conversation", { id: "cv2", workspaceId: "ws1", contactId: "ct2", channel: "email", clienteId: "ghost-cliente" })
  } finally {
    db.close()
  }
})

after(() => {
  rmSync(dir, { recursive: true, force: true })
})

test("the SQL guard rejects every non-SELECT/PRAGMA statement", () => {
  for (const bad of [
    "UPDATE Factura SET items = '[]'",
    "DELETE FROM InboxTodo",
    "INSERT INTO QRCode VALUES (1)",
    "DROP TABLE Cliente",
    "ALTER TABLE Documento ADD COLUMN x TEXT",
    "SELECT 1; DELETE FROM Cliente",
    "  update x set y = 1",
  ]) {
    assert.throws(() => assertReadOnlySql(bad), new RegExp("read-only guard"), bad)
  }
  assertReadOnlySql("SELECT COUNT(*) FROM x")
  assertReadOnlySql('PRAGMA table_info("x")')
})

test("full audit leaves the database bytes untouched and reports seeded truth", async () => {
  const hashBefore = createHash("sha256").update(readFileSync(dbPath)).digest("hex")
  const report: any = await auditSqliteFile(dbPath)
  const hashAfter = createHash("sha256").update(readFileSync(dbPath)).digest("hex")
  assert.equal(hashBefore, hashAfter, "audit must not change a single byte")

  // Row counts.
  assert.equal(report.rowCounts.ClientProject, 2)
  assert.equal(report.rowCounts.ClientInvoice, 0)
  assert.equal(report.rowCounts.ClientFile, 1)
  assert.equal(report.rowCounts.ForteSnapshot, 0)

  // D2.
  assert.deepEqual(
    { total: report.d2RetirementCandidates.ClientProject.total, orphans: report.d2RetirementCandidates.ClientProject.orphanClienteRefs },
    { total: 2, orphans: 1 },
  )
  assert.equal(report.d2RetirementCandidates.ClientInvoice.total, 0)

  // D5 Factura.items.
  const items = report.d5FacturaItems
  assert.equal(items.total, 4)
  assert.equal(items.nulls, 1)
  assert.equal(items.empty, 1)
  assert.equal(items.validJson, 1)
  assert.equal(items.invalidJson, 1)
  assert.equal(items.jsonArrays, 1)

  // D5 Documento.url.
  const url = report.d5DocumentoUrl
  assert.equal(url.total, 6)
  assert.equal(url.nulls, 1)
  assert.equal(url.empty, 1)
  assert.equal(url.https, 2)
  assert.equal(url.relative, 1)
  assert.equal(url.otherShape, 1)
  assert.equal(url.duplicateUrlGroups, 1)

  // Legacy quartet.
  assert.equal(report.legacyParallelConcepts.Usuario.total, 1)
  assert.equal(report.legacyParallelConcepts.Tarea.noWorkspace, 1)

  // QR derivability.
  const qr = report.qrWorkspaceAudit
  assert.equal(qr.total, 5)
  assert.equal(qr.withWorkspaceId, 1)
  assert.deepEqual(qr.byModuleDerivability.clientes, { rows: 3, DETERMINISTIC: 1, AMBIGUOUS: 0, ORPHANED: 1 })
  assert.deepEqual(qr.byModuleDerivability.tareas, { rows: 1, DETERMINISTIC: 0, AMBIGUOUS: 1, ORPHANED: 0 })
  assert.equal(qr.byModuleDerivability.custom.classification, "UNKNOWN")

  // InboxTodo mapping.
  const todo = report.inboxTodoWorkspaceTaskAudit
  assert.equal(todo.total, 4)
  assert.equal(todo.linked, 1)
  assert.deepEqual(todo.unlinkedMapping, { EXACT: 1, AMBIGUOUS: 1, NO_MATCH: 1 })

  // Integrity.
  const integrity = report.multitenantIntegrity
  assert.equal(integrity.rowsWithoutWorkspace.Tarea, 1)
  assert.equal(integrity.rowsWithNonexistentWorkspace.Conversation, 1)
  assert.equal(integrity.fkOrphans["Conversation.clienteId -> Cliente.id"], 1)
  // cv1 (ghost-ws) and cv2 (ws1) both point at ct2 in ws2 → two mismatches.
  assert.equal(integrity.crossTenantMismatches["Conversation.contactId -> Contact.id"], 2)
})

test("absent structures degrade into explicit findings (pre-adoption shape)", async () => {
  // A minimal DB missing almost everything: only Workspace + QRCode WITHOUT
  // workspaceId — the deployed-production shape before migration adoption.
  const miniPath = join(dir, "mini.db")
  const mini = new DatabaseSync(miniPath)
  mini.exec('CREATE TABLE "Workspace" ("id" TEXT PRIMARY KEY, "nombre" TEXT NOT NULL, "slug" TEXT NOT NULL)')
  mini.exec('CREATE TABLE "QRCode" ("id" TEXT PRIMARY KEY, "module" TEXT NOT NULL, "recordId" TEXT NOT NULL)')
  mini.exec(`INSERT INTO "QRCode" VALUES ('q1', 'clientes', 'x')`)
  mini.close()

  const report: any = await auditSqliteFile(miniPath)
  assert.equal(report.rowCounts.ClientAsset, "TABLE_ABSENT")
  assert.equal(report.rowCounts.ForteSnapshot, "TABLE_ABSENT")
  assert.equal(report.d2RetirementCandidates.ClientProject.unavailable, "TABLE_ABSENT: ClientProject")
  assert.equal(report.qrWorkspaceAudit.workspaceIdColumnPresent, false)
  assert.equal(report.qrWorkspaceAudit.withWorkspaceId, "COLUMN_ABSENT")
  assert.equal(report.qrWorkspaceAudit.byModuleDerivability.clientes.reason, "target table absent")
})

test("the drift manifest yields the FK orphan-check targets deterministically", () => {
  const targets = fkTargetsFromManifest(join(REPO, "prisma", "migrations", "drift-manifest.json"))
  assert.ok(targets.length >= 37, `expected >= 37 FK targets, got ${targets.length}`)
  assert.ok(targets.some((t) => t.child === "Conversation" && t.childColumn === "clienteId" && t.parent === "Cliente"))
  const keys = targets.map((t) => `${t.child}.${t.childColumn}`)
  assert.deepEqual(keys, [...keys].sort(), "targets must be deterministically ordered")
})
