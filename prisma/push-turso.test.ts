/**
 * Hardening tests for the Turso schema pusher (DEV-PREVIEW-01D).
 *
 * Covers the contract that the previous version violated: it printed
 * "Schema pusheado correctamente" even when statements had failed. These tests
 * lock in honest reporting, statement counting, secret-free errors and correct
 * exit codes for full success, partial failure and total failure.
 */

import assert from "node:assert/strict"
import test from "node:test"
import {
  sanitizeSecret,
  splitSqlStatements,
  isIdempotentSkip,
  isCriticalError,
  statementLabel,
  runSchemaStatements,
  computeExitCode,
  isSuccess,
  formatReport,
  type SqlExecutor,
} from "./push-turso"

/** Executor whose behaviour per-statement is driven by a matcher map. */
function makeExecutor(
  behaviour: (sql: string, index: number) => "ok" | Error,
): { executor: SqlExecutor; calls: string[] } {
  const calls: string[] = []
  const executor: SqlExecutor = {
    async execute(sql: string) {
      const outcome = behaviour(sql, calls.length)
      calls.push(sql)
      if (outcome instanceof Error) throw outcome
      return { rowsAffected: 0 }
    },
  }
  return { executor, calls }
}

const okExecutor = () => makeExecutor(() => "ok")

const SAMPLE = [
  `CREATE TABLE "Workspace" ("id" TEXT NOT NULL PRIMARY KEY)`,
  `CREATE TABLE "User" ("id" TEXT NOT NULL PRIMARY KEY)`,
  `CREATE UNIQUE INDEX "User_email_key" ON "User"("email")`,
]

// ── Fully successful execution ───────────────────────────────────────────────

test("full success: every statement counted, success reported, exit 0", async () => {
  const { executor, calls } = okExecutor()
  const result = await runSchemaStatements(executor, SAMPLE)

  assert.equal(result.total, 3)
  assert.equal(result.succeeded, 3)
  assert.equal(result.failed, 0)
  assert.equal(result.skipped, 0)
  assert.equal(result.aborted, false)
  assert.equal(calls.length, 3)
  assert.equal(isSuccess(result), true)
  assert.equal(computeExitCode(result), 0)
  assert.match(formatReport(result), /successfully/i)
})

// ── Partial failure ──────────────────────────────────────────────────────────

test("partial failure: one bad statement → failed=1, no false success, exit 1", async () => {
  const { executor } = makeExecutor((sql) =>
    sql.includes("User_email_key") ? new Error("near \"ON\": syntax error") : "ok",
  )
  const result = await runSchemaStatements(executor, SAMPLE)

  assert.equal(result.succeeded, 2)
  assert.equal(result.failed, 1)
  assert.equal(result.failures.length, 1)
  assert.equal(result.failures[0].label, "INDEX User_email_key")
  assert.equal(isSuccess(result), false)
  assert.equal(computeExitCode(result), 1)
  const report = formatReport(result)
  assert.match(report, /FAILED/)
  assert.doesNotMatch(report, /successfully/i)
})

// ── Total failure ────────────────────────────────────────────────────────────

test("total failure: all statements fail (non-critical) → failed=total, exit 1", async () => {
  const { executor, calls } = makeExecutor(() => new Error("disk I/O error"))
  const result = await runSchemaStatements(executor, SAMPLE)

  assert.equal(result.failed, 3)
  assert.equal(result.succeeded, 0)
  assert.equal(calls.length, 3, "non-critical errors do not abort the run")
  assert.equal(result.aborted, false)
  assert.equal(isSuccess(result), false)
  assert.equal(computeExitCode(result), 1)
})

// ── Critical error aborts loudly ─────────────────────────────────────────────

test("critical error aborts remaining statements and exits 1", async () => {
  const { executor, calls } = makeExecutor((_sql, i) =>
    i === 0 ? new Error("SERVER_ERROR: UNAUTHORIZED: token expired") : "ok",
  )
  const result = await runSchemaStatements(executor, SAMPLE)

  assert.equal(result.aborted, true)
  assert.equal(result.failed, 1)
  assert.equal(calls.length, 1, "must not continue after a critical error")
  assert.equal(isSuccess(result), false)
  assert.equal(computeExitCode(result), 1)
})

// ── Idempotency: re-run skips already-present objects ────────────────────────

test("idempotent re-run: 'already exists' counts as skipped, stays successful", async () => {
  const { executor } = makeExecutor(() => new Error("table \"Workspace\" already exists"))
  const result = await runSchemaStatements(executor, SAMPLE)

  assert.equal(result.skipped, 3)
  assert.equal(result.failed, 0)
  assert.equal(isSuccess(result), true)
  assert.equal(computeExitCode(result), 0)
})

// ── No false success message under any failure ───────────────────────────────

test("formatReport never announces success when failures exist", async () => {
  const { executor } = makeExecutor((_sql, i) => (i === 1 ? new Error("boom") : "ok"))
  const result = await runSchemaStatements(executor, SAMPLE)
  assert.equal(isSuccess(result), false)
  assert.doesNotMatch(formatReport(result), /correct|success/i)
})

// ── computeExitCode mapping ──────────────────────────────────────────────────

test("computeExitCode: 0 only on clean success", () => {
  assert.equal(
    computeExitCode({ total: 5, succeeded: 5, skipped: 0, failed: 0, aborted: false, failures: [] }),
    0,
  )
  assert.equal(
    computeExitCode({ total: 5, succeeded: 4, skipped: 0, failed: 1, aborted: false, failures: [] }),
    1,
  )
  assert.equal(
    computeExitCode({ total: 5, succeeded: 4, skipped: 0, failed: 0, aborted: true, failures: [] }),
    1,
  )
})

// ── Secret redaction ─────────────────────────────────────────────────────────

test("sanitizeSecret redacts the auth token and database URL", () => {
  const prevToken = process.env.TURSO_AUTH_TOKEN
  const prevUrl = process.env.TURSO_DATABASE_URL
  process.env.TURSO_AUTH_TOKEN = "super-secret-token-value-123"
  process.env.TURSO_DATABASE_URL = "libsql://demo-secret-org.turso.io"
  try {
    const err = new Error(
      "auth failed for libsql://demo-secret-org.turso.io with token super-secret-token-value-123",
    )
    const out = sanitizeSecret(err)
    assert.doesNotMatch(out, /super-secret-token-value-123/)
    assert.doesNotMatch(out, /demo-secret-org/)
    assert.match(out, /REDACTED/)
  } finally {
    if (prevToken === undefined) delete process.env.TURSO_AUTH_TOKEN
    else process.env.TURSO_AUTH_TOKEN = prevToken
    if (prevUrl === undefined) delete process.env.TURSO_DATABASE_URL
    else process.env.TURSO_DATABASE_URL = prevUrl
  }
})

test("sanitizeSecret redacts JWT-shaped tokens and URLs even without env", () => {
  const jwt = "eyJhbGciOiJFZERTQSJ9.eyJpZCI6ImFiYyJ9.c2lnbmF0dXJlLXZhbHVl"
  const out = sanitizeSecret(new Error(`connect libsql://x-y.turso.io token ${jwt}`))
  assert.doesNotMatch(out, /eyJ/)
  assert.doesNotMatch(out, /turso\.io/)
  assert.match(out, /REDACTED_TOKEN/)
  assert.match(out, /REDACTED_URL/)
})

// ── Helpers ──────────────────────────────────────────────────────────────────

test("splitSqlStatements strips comments and splits on semicolons", () => {
  const sql = [
    "-- CreateTable",
    'CREATE TABLE "A" (',
    '  "id" TEXT NOT NULL PRIMARY KEY',
    ");",
    "",
    "-- CreateIndex",
    'CREATE UNIQUE INDEX "A_id_key" ON "A"("id");',
  ].join("\n")
  const parts = splitSqlStatements(sql)
  assert.equal(parts.length, 2)
  assert.match(parts[0], /CREATE TABLE "A"/)
  assert.match(parts[1], /CREATE UNIQUE INDEX "A_id_key"/)
  assert.doesNotMatch(parts.join("\n"), /CreateTable|CreateIndex/)
})

test("isIdempotentSkip / isCriticalError classification", () => {
  assert.equal(isIdempotentSkip("table \"X\" already exists"), true)
  assert.equal(isIdempotentSkip("duplicate column name: foo"), true)
  assert.equal(isIdempotentSkip("near \")\": syntax error"), false)

  assert.equal(isCriticalError("UNAUTHORIZED: bad token"), true)
  assert.equal(isCriticalError("DNS resolution failed"), true)
  assert.equal(isCriticalError("ECONNREFUSED"), true)
  assert.equal(isCriticalError("near \")\": syntax error"), false)
})

test("statementLabel produces secret-free, readable labels", () => {
  assert.equal(statementLabel('CREATE TABLE "Workspace" ("id" TEXT)'), "TABLE Workspace")
  assert.equal(
    statementLabel('CREATE UNIQUE INDEX "User_email_key" ON "User"("email")'),
    "INDEX User_email_key",
  )
  assert.equal(statementLabel('ALTER TABLE "User" ADD COLUMN "locale" TEXT'), "ALTER User.locale")
})
