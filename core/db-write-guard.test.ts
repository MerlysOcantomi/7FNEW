import assert from "node:assert/strict"
import test from "node:test"
import { guardModelOperation, guardRawOperation, isReadModelOperation, rawSqlText, writeGuardExtension } from "./db-write-guard"
import { PrivilegedOperationDeniedError, resetPolicySource, setPolicySource, type PolicySource } from "@core/privileged-operations"

const frozen: PolicySource = { name: "test:frozen", resolve: () => ({ kind: "mode", mode: "freeze-writes", origin: "test:frozen" }) }

test.afterEach(() => resetPolicySource())

test("read allowlist is explicit; every other model operation is a write (fail closed)", () => {
  for (const r of ["findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy"]) assert.ok(isReadModelOperation(r), r)
  for (const w of ["create", "createMany", "createManyAndReturn", "update", "updateMany", "updateManyAndReturn", "upsert", "delete", "deleteMany", "somethingNew"]) assert.ok(!isReadModelOperation(w), w)
})

test("guardModelOperation: normal passes everything through; frozen refuses writes before query() and lets reads run", async () => {
  const calls: string[] = []
  const query = async (args: unknown) => {
    calls.push(String(args))
    return "ok"
  }
  assert.equal(await guardModelOperation("create", "a", query), "ok")
  setPolicySource(frozen)
  for (const w of ["create", "createMany", "createManyAndReturn", "update", "updateMany", "updateManyAndReturn", "upsert", "delete", "deleteMany"]) {
    await assert.rejects(guardModelOperation(w, w, query), PrivilegedOperationDeniedError, w)
  }
  assert.deepEqual(calls, ["a"], "no write reached query() while frozen")
  for (const r of ["findMany", "count", "findUnique", "aggregate", "groupBy"]) assert.equal(await guardModelOperation(r, r, query), "ok")
  assert.deepEqual(calls, ["a", "findMany", "count", "findUnique", "aggregate", "groupBy"])
})

test("guardRawOperation: $executeRaw* always write; $queryRaw* by SQL content; Prisma argument shapes are understood", async () => {
  const query = async () => "ok"
  setPolicySource(frozen)
  await assert.rejects(guardRawOperation("$executeRawUnsafe", ["SELECT 1"], query), PrivilegedOperationDeniedError, "execute is a write by contract even for a SELECT")
  await assert.rejects(guardRawOperation("$executeRaw", { sql: "SELECT 1", values: [] }, query), PrivilegedOperationDeniedError)
  assert.equal(await guardRawOperation("$queryRawUnsafe", ["SELECT id FROM \"Message\" WHERE id = $1", "x"], query), "ok")
  assert.equal(await guardRawOperation("$queryRaw", { strings: ["SELECT count(*) FROM \"Message\" WHERE id = ", ""], values: ["x"] }, query), "ok")
  assert.equal(await guardRawOperation("$queryRaw", { sql: "SELECT 1", values: [] }, query), "ok")
  await assert.rejects(guardRawOperation("$queryRawUnsafe", ["DELETE FROM \"Message\""], query), PrivilegedOperationDeniedError)
  await assert.rejects(guardRawOperation("$queryRaw", { strings: ["WITH d AS (DELETE FROM \"Message\" RETURNING id) SELECT * FROM d"], values: [] }, query), PrivilegedOperationDeniedError)
  await assert.rejects(guardRawOperation("$queryRawUnsafe", [42], query), PrivilegedOperationDeniedError, "unknown argument shape fails closed")
  assert.equal(rawSqlText({ strings: ["a ", " b"] }), "a ? b")
  assert.equal(rawSqlText(["x"]), "x")
  assert.equal(rawSqlText(null), "")
})

test("the extension covers every model operation and every raw entry point", () => {
  assert.equal(writeGuardExtension.name, "sevenf-privileged-operations-database-write")
  assert.deepEqual(Object.keys(writeGuardExtension.query).sort(), ["$allModels", "$executeRaw", "$executeRawUnsafe", "$queryRaw", "$queryRawUnsafe"])
  assert.equal(typeof writeGuardExtension.query.$allModels.$allOperations, "function")
})
