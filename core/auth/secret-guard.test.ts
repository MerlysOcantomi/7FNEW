import assert from "node:assert/strict"
import test from "node:test"
import { decideOnMissingSecret } from "./secret-guard"

test("protected API without AUTH_SECRET → block-api (never reaches handler)", () => {
  assert.equal(decideOnMissingSecret("/api/clientes"), "block-api")
  assert.equal(decideOnMissingSecret("/api/today"), "block-api")
  assert.equal(decideOnMissingSecret("/api/system/workspaces"), "block-api")
})

test("protected page without AUTH_SECRET → block-page (safe unavailability)", () => {
  assert.equal(decideOnMissingSecret("/today"), "block-page")
  assert.equal(decideOnMissingSecret("/calendario"), "block-page")
  assert.equal(decideOnMissingSecret("/"), "block-page")
})

test("the decision never depends on secret/config values — only the path shape", () => {
  // Pure function of the pathname; deterministic, reveals nothing.
  assert.equal(decideOnMissingSecret("/api/x"), decideOnMissingSecret("/api/y"))
})
