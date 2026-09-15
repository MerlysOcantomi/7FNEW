import assert from "node:assert/strict"
import test from "node:test"
import {
  OPERATION_MODES,
  PrivilegedOperationDeniedError,
  assertOperationAllowed,
  checkOperation,
  createEnvironmentPolicySource,
  currentPolicySource,
  decideOperation,
  getOperation,
  isPrivilegedOperationDenied,
  isPrivilegedOperationId,
  listOperations,
  parseOperationMode,
  resetPolicySource,
  setPolicySource,
  type PolicySource,
} from "./index"
import { isPublicApiError } from "@core/errors"
import { classifyRawSql } from "./raw-sql"

const fixed = (mode: "normal" | "freeze-writes"): PolicySource => ({ name: "test:fixed", resolve: () => ({ kind: "mode", mode, origin: "test:fixed" }) })
const invalid: PolicySource = { name: "test:invalid", resolve: () => ({ kind: "invalid", origin: "test:invalid", detail: "bad" }) }

test("registry is deterministic: fixed order, stable ids, known families", () => {
  const ids = listOperations().map((o) => o.id)
  assert.deepEqual(ids, ["database.write", "background.start"])
  assert.deepEqual(listOperations().map((o) => o.id), ids, "same order every call")
  assert.equal(getOperation("database.write").family, "database")
  assert.deepEqual(getOperation("database.write").deniedInModes, ["freeze-writes"])
  assert.ok(isPrivilegedOperationId("background.start"))
  assert.ok(!isPrivilegedOperationId("database.destructive"), "future ids are not registered in v1")
  assert.throws(() => getOperation("deploy.production" as never), /unknown operation/)
  assert.deepEqual([...OPERATION_MODES], ["normal", "freeze-writes"])
})

test("policy decision is pure and fail-closed", () => {
  const write = getOperation("database.write")
  assert.equal(decideOperation(write, { kind: "mode", mode: "normal", origin: "x" }).allowed, true)
  assert.equal(decideOperation(write, { kind: "mode", mode: "freeze-writes", origin: "x" }).allowed, false)
  const inv = decideOperation(write, { kind: "invalid", origin: "x", detail: "bad" })
  assert.equal(inv.allowed, false)
  assert.equal(inv.mode, "invalid")
  assert.equal(decideOperation(getOperation("background.start"), { kind: "mode", mode: "freeze-writes", origin: "x" }).allowed, false)
  // determinism
  const a = decideOperation(write, { kind: "mode", mode: "freeze-writes", origin: "x" })
  const b = decideOperation(write, { kind: "mode", mode: "freeze-writes", origin: "x" })
  assert.deepEqual(a, b)
})

test("environment policy source: unset → normal (explicit), exact values only, anything else invalid and never echoed", () => {
  assert.deepEqual(parseOperationMode(undefined), { kind: "mode", mode: "normal", origin: "env:SEVENF_OPERATION_MODE(unset→normal)" })
  assert.deepEqual(parseOperationMode(""), { kind: "mode", mode: "normal", origin: "env:SEVENF_OPERATION_MODE(unset→normal)" })
  assert.equal(parseOperationMode("normal").kind, "mode")
  assert.equal((parseOperationMode("freeze-writes") as { mode: string }).mode, "freeze-writes")
  assert.equal((parseOperationMode(" freeze-writes ") as { mode: string }).mode, "freeze-writes")
  for (const bad of ["FREEZE-WRITES", "maintenance", "true", "read-only", "secret-value-xyz", "normal;rm -rf"]) {
    const r = parseOperationMode(bad)
    assert.equal(r.kind, "invalid", bad)
    assert.ok(!JSON.stringify(r).includes(bad), "the offending value is never echoed")
  }
  const source = createEnvironmentPolicySource({ SEVENF_OPERATION_MODE: "freeze-writes" })
  assert.equal(checkOperation("database.write", source).allowed, false)
  assert.equal(checkOperation("database.write", createEnvironmentPolicySource({})).allowed, true)
})

test("normal allows, freeze-writes refuses writes and background starts, invalid fails closed; reads are not an operation", () => {
  assert.equal(checkOperation("database.write", fixed("normal")).allowed, true)
  assert.equal(checkOperation("background.start", fixed("normal")).allowed, true)
  assert.equal(checkOperation("database.write", fixed("freeze-writes")).allowed, false)
  assert.equal(checkOperation("background.start", fixed("freeze-writes")).allowed, false)
  assert.equal(checkOperation("database.write", invalid).allowed, false)
  assert.doesNotThrow(() => assertOperationAllowed("database.write", fixed("normal")))
  assert.throws(() => assertOperationAllowed("database.write", fixed("freeze-writes")), (err: unknown) => {
    assert.ok(isPrivilegedOperationDenied(err))
    assert.ok(err instanceof PrivilegedOperationDeniedError)
    assert.ok(isPublicApiError(err), "publishable through core/api.ts#handleError")
    assert.equal(err.code, "OPERATION_FROZEN")
    assert.equal(err.status, 503)
    assert.equal(err.operation, "database.write")
    assert.equal(err.decision.mode, "freeze-writes")
    assert.match(err.message, /reads remain available/)
    return true
  })
  assert.throws(() => assertOperationAllowed("background.start", invalid), (err: PrivilegedOperationDeniedError) => err.decision.mode === "invalid" && err.status === 503)
})

test("the policy source is substitutable without touching callers, and resettable", () => {
  const original = currentPolicySource()
  assert.equal(original.name, "env:SEVENF_OPERATION_MODE")
  setPolicySource(fixed("freeze-writes"))
  try {
    assert.equal(checkOperation("database.write").allowed, false, "callers name the operation only; the source changed underneath")
    assert.equal(checkOperation("database.write").source, "test:fixed")
  } finally {
    resetPolicySource()
  }
  assert.equal(currentPolicySource(), original)
  assert.equal(checkOperation("database.write", createEnvironmentPolicySource({})).allowed, true)
})

test("raw SQL classifier: reads stay reads, anything that could write is a write", () => {
  for (const read of [
    "SELECT 1",
    "  select c.id from \"Conversation\" c where c.\"workspaceId\" = $1",
    "-- comment\nSELECT count(*) FROM \"Message\"",
    "/* c */ WITH x AS (SELECT 1) SELECT * FROM x",
    "EXPLAIN SELECT 1",
    "VALUES (1)",
    "TABLE \"Workspace\"",
  ]) assert.equal(classifyRawSql(read), "read", read)
  for (const write of [
    "INSERT INTO \"Workspace\" VALUES (1)",
    "update \"Message\" set content = 'x'",
    "DELETE FROM \"Message\"",
    "WITH d AS (DELETE FROM \"Message\" RETURNING id) SELECT * FROM d",
    "SELECT * FROM \"Message\" FOR UPDATE",
    "SELECT setval('s', 1)",
    "TRUNCATE \"Message\"",
    "DO $$ BEGIN END $$",
    "CALL proc()",
    "COPY x FROM stdin",
    "SET search_path = public",
    "",
    "   ",
    "BEGIN",
    "select_from_nowhere", // not a leader keyword match
  ]) assert.equal(classifyRawSql(write), "write", JSON.stringify(write))
})
