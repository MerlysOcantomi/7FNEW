import assert from "node:assert/strict"
import test from "node:test"
import { evaluateLabDemoEnvironment, type LabDemoEnvironmentInput } from "./demo-environment"
import { LAB_DEMO_IDENTITY } from "./demo-identity"

const EXPECTED = {
  userId: LAB_DEMO_IDENTITY.userId,
  userEmail: LAB_DEMO_IDENTITY.userEmail,
  workspaceId: LAB_DEMO_IDENTITY.workspaceId,
  workspaceSlug: LAB_DEMO_IDENTITY.workspaceSlug,
  verticalKey: LAB_DEMO_IDENTITY.verticalKey,
  membershipRole: LAB_DEMO_IDENTITY.membershipRole,
  sessionRole: LAB_DEMO_IDENTITY.sessionRole,
}

const VALID: LabDemoEnvironmentInput = {
  configError: null,
  fingerprintOk: true,
  dbReachable: true,
  workspaceCount: 1,
  foreignUserCount: 0,
  expected: EXPECTED,
  user: { id: EXPECTED.userId, email: EXPECTED.userEmail, role: "editor" },
  workspace: { id: EXPECTED.workspaceId, slug: EXPECTED.workspaceSlug, verticalKey: "beauty", demoFlagged: true },
  membership: { role: "ADMIN" },
  dataset: { clients: 8, events: 30, conversations: 5, messages: 12, invoices: 16, workspaceTasks: 6 },
}

function denied(reason: string) {
  return { allowed: false, reason }
}

test("fully valid environment → allowed with editor role", () => {
  assert.deepEqual(evaluateLabDemoEnvironment(VALID), {
    allowed: true,
    userId: EXPECTED.userId,
    workspaceId: EXPECTED.workspaceId,
    email: EXPECTED.userEmail,
    role: "editor",
  })
})

test("configError disabled → disabled", () => {
  assert.deepEqual(evaluateLabDemoEnvironment({ ...VALID, configError: "disabled" }), denied("disabled"))
})

test("configError other → invalid-configuration", () => {
  assert.deepEqual(evaluateLabDemoEnvironment({ ...VALID, configError: "auth-secret-weak" }), denied("invalid-configuration"))
})

test("fingerprint mismatch → database-fingerprint-mismatch", () => {
  assert.deepEqual(evaluateLabDemoEnvironment({ ...VALID, fingerprintOk: false }), denied("database-fingerprint-mismatch"))
})

test("database unreachable → database-unavailable", () => {
  assert.deepEqual(evaluateLabDemoEnvironment({ ...VALID, dbReachable: false }), denied("database-unavailable"))
})

test("too many workspaces → unsafe-database", () => {
  assert.deepEqual(evaluateLabDemoEnvironment({ ...VALID, workspaceCount: 2 }), denied("unsafe-database"))
})

test("unexpected foreign users → unsafe-database", () => {
  assert.deepEqual(evaluateLabDemoEnvironment({ ...VALID, foreignUserCount: 1 }), denied("unsafe-database"))
})

test("user missing → user-missing", () => {
  assert.deepEqual(evaluateLabDemoEnvironment({ ...VALID, user: null }), denied("user-missing"))
})

test("wrong email → user-mismatch", () => {
  assert.deepEqual(
    evaluateLabDemoEnvironment({ ...VALID, user: { ...VALID.user!, email: "other@sevenef.invalid" } }),
    denied("user-mismatch"),
  )
})

test("wrong user role → user-mismatch", () => {
  assert.deepEqual(
    evaluateLabDemoEnvironment({ ...VALID, user: { ...VALID.user!, role: "admin" } }),
    denied("user-mismatch"),
  )
})

test("workspace missing → workspace-missing", () => {
  assert.deepEqual(evaluateLabDemoEnvironment({ ...VALID, workspace: null }), denied("workspace-missing"))
})

test("wrong slug → workspace-mismatch", () => {
  assert.deepEqual(
    evaluateLabDemoEnvironment({ ...VALID, workspace: { ...VALID.workspace!, slug: "other" } }),
    denied("workspace-mismatch"),
  )
})

test("wrong vertical → workspace-mismatch", () => {
  assert.deepEqual(
    evaluateLabDemoEnvironment({ ...VALID, workspace: { ...VALID.workspace!, verticalKey: "saas" } }),
    denied("workspace-mismatch"),
  )
})

test("demo marker absent → unsafe-database", () => {
  assert.deepEqual(
    evaluateLabDemoEnvironment({ ...VALID, workspace: { ...VALID.workspace!, demoFlagged: false } }),
    denied("unsafe-database"),
  )
})

test("membership missing → membership-missing", () => {
  assert.deepEqual(evaluateLabDemoEnvironment({ ...VALID, membership: null }), denied("membership-missing"))
})

test("wrong membership role → membership-mismatch", () => {
  assert.deepEqual(
    evaluateLabDemoEnvironment({ ...VALID, membership: { role: "VIEWER" } }),
    denied("membership-mismatch"),
  )
})

test("dataset below minimums → dataset-incomplete", () => {
  assert.deepEqual(
    evaluateLabDemoEnvironment({ ...VALID, dataset: { ...VALID.dataset, clients: 0 } }),
    denied("dataset-incomplete"),
  )
  assert.deepEqual(
    evaluateLabDemoEnvironment({ ...VALID, dataset: { ...VALID.dataset, conversations: 0 } }),
    denied("dataset-incomplete"),
  )
})

test("denials carry only { allowed, reason } — no secrets", () => {
  const cases: LabDemoEnvironmentInput[] = [
    { ...VALID, fingerprintOk: false },
    { ...VALID, user: null },
    { ...VALID, foreignUserCount: 3 },
  ]
  for (const input of cases) {
    const d = evaluateLabDemoEnvironment(input)
    assert.equal(d.allowed, false)
    assert.deepEqual(Object.keys(d).sort(), ["allowed", "reason"])
  }
})
