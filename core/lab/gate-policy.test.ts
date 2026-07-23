import assert from "node:assert/strict"
import test from "node:test"
import {
  decideLabGate,
  evaluateLabProjectConfig,
  isLabNamespacePath,
  normalizeHost,
  parseAllowedHosts,
  type LabGateDecision,
  type LabGateInput,
} from "./gate-policy"

const ALL_OK: LabGateInput = {
  enabled: "true",
  deploymentMode: "dedicated",
  expectedProjectId: "prj_lab_123",
  actualProjectId: "prj_lab_123",
  allowedHosts: "lab.example.com,project-lab.vercel.app",
  requestHost: "lab.example.com",
  vercelEnv: "production",
  localDevEnabled: undefined,
}

function denied(reason: string): LabGateDecision {
  return { allowed: false, reason: reason as never }
}

// --- Activation flag: exact "true" only -------------------------------------

test("all conditions hold → allowed with normalized host", () => {
  assert.deepEqual(decideLabGate(ALL_OK), {
    allowed: true,
    mode: "dedicated",
    normalizedHost: "lab.example.com",
  })
})

test("flag absent → disabled", () => {
  assert.deepEqual(decideLabGate({ ...ALL_OK, enabled: undefined }), denied("disabled"))
})

test('flag "false" → disabled', () => {
  assert.deepEqual(decideLabGate({ ...ALL_OK, enabled: "false" }), denied("disabled"))
})

test('flag "TRUE" (wrong case) → disabled', () => {
  assert.deepEqual(decideLabGate({ ...ALL_OK, enabled: "TRUE" }), denied("disabled"))
})

test('flag "1" → disabled', () => {
  assert.deepEqual(decideLabGate({ ...ALL_OK, enabled: "1" }), denied("disabled"))
})

// --- Deployment mode ---------------------------------------------------------

test("mode absent → invalid-mode", () => {
  assert.deepEqual(decideLabGate({ ...ALL_OK, deploymentMode: undefined }), denied("invalid-mode"))
})

test('mode "shared" → invalid-mode', () => {
  assert.deepEqual(decideLabGate({ ...ALL_OK, deploymentMode: "shared" }), denied("invalid-mode"))
})

test('mode "DEDICATED" (wrong case) → invalid-mode', () => {
  assert.deepEqual(
    decideLabGate({ ...ALL_OK, deploymentMode: "DEDICATED" }),
    denied("invalid-mode"),
  )
})

// --- Project identity --------------------------------------------------------

test("expected project id absent → missing-project-id", () => {
  assert.deepEqual(
    decideLabGate({ ...ALL_OK, expectedProjectId: undefined }),
    denied("missing-project-id"),
  )
})

test("actual project id absent (not on Vercel) → missing-project-id", () => {
  assert.deepEqual(
    decideLabGate({ ...ALL_OK, actualProjectId: undefined }),
    denied("missing-project-id"),
  )
})

test("different project ids → project-mismatch", () => {
  assert.deepEqual(
    decideLabGate({ ...ALL_OK, actualProjectId: "prj_sevenef_prod" }),
    denied("project-mismatch"),
  )
})

test("partial project-id overlap is still a mismatch", () => {
  assert.deepEqual(
    decideLabGate({ ...ALL_OK, actualProjectId: "prj_lab_1234" }),
    denied("project-mismatch"),
  )
})

test("exact project ids → allowed", () => {
  assert.equal(decideLabGate(ALL_OK).allowed, true)
})

// --- Host allowlist ----------------------------------------------------------

test("allowed hosts absent → invalid-configuration", () => {
  assert.deepEqual(
    decideLabGate({ ...ALL_OK, allowedHosts: undefined }),
    denied("invalid-configuration"),
  )
})

test("allowed hosts empty / whitespace-only → invalid-configuration", () => {
  assert.deepEqual(decideLabGate({ ...ALL_OK, allowedHosts: "" }), denied("invalid-configuration"))
  assert.deepEqual(
    decideLabGate({ ...ALL_OK, allowedHosts: "  ,  , " }),
    denied("invalid-configuration"),
  )
})

test("wildcard-only allowlist is dropped → invalid-configuration (no wildcard support)", () => {
  assert.deepEqual(
    decideLabGate({ ...ALL_OK, allowedHosts: "*.example.com" }),
    denied("invalid-configuration"),
  )
})

test("request host absent → missing-host", () => {
  assert.deepEqual(decideLabGate({ ...ALL_OK, requestHost: undefined }), denied("missing-host"))
})

test("exact allowed host → allowed", () => {
  const decision = decideLabGate({ ...ALL_OK, requestHost: "project-lab.vercel.app" })
  assert.deepEqual(decision, {
    allowed: true,
    mode: "dedicated",
    normalizedHost: "project-lab.vercel.app",
  })
})

test("uppercase request host is normalized and allowed", () => {
  const decision = decideLabGate({ ...ALL_OK, requestHost: "LAB.Example.COM" })
  assert.deepEqual(decision, {
    allowed: true,
    mode: "dedicated",
    normalizedHost: "lab.example.com",
  })
})

test("accidental spaces in the configured list are tolerated", () => {
  const decision = decideLabGate({
    ...ALL_OK,
    allowedHosts: "  lab.example.com ,  project-lab.vercel.app  ",
  })
  assert.equal(decision.allowed, true)
})

test("host not in the allowlist → host-not-allowed", () => {
  assert.deepEqual(
    decideLabGate({ ...ALL_OK, requestHost: "other.example.com" }),
    denied("host-not-allowed"),
  )
})

test("malicious prefix (evil-lab.example.com) → host-not-allowed", () => {
  assert.deepEqual(
    decideLabGate({ ...ALL_OK, requestHost: "evil-lab.example.com" }),
    denied("host-not-allowed"),
  )
})

test("malicious suffix (lab.example.com.attacker.test) → host-not-allowed", () => {
  assert.deepEqual(
    decideLabGate({ ...ALL_OK, requestHost: "lab.example.com.attacker.test" }),
    denied("host-not-allowed"),
  )
})

test("host that only partially contains an allowed host → host-not-allowed", () => {
  assert.deepEqual(
    decideLabGate({ ...ALL_OK, requestHost: "example.com" }),
    denied("host-not-allowed"),
  )
})

test("port must match exactly when configured", () => {
  const withPort = { ...ALL_OK, allowedHosts: "localhost:3000", localDevEnabled: "true", vercelEnv: undefined }
  assert.equal(decideLabGate({ ...withPort, requestHost: "localhost:3000" }).allowed, true)
  assert.deepEqual(
    decideLabGate({ ...withPort, requestHost: "localhost" }),
    denied("host-not-allowed"),
  )
})

// --- Environment policy ------------------------------------------------------

test('VERCEL_ENV "production" of the dedicated project → allowed', () => {
  assert.equal(decideLabGate({ ...ALL_OK, vercelEnv: "production" }).allowed, true)
})

test('VERCEL_ENV "preview" → allowed', () => {
  assert.equal(decideLabGate({ ...ALL_OK, vercelEnv: "preview" }).allowed, true)
})

test("unknown environment → invalid-environment", () => {
  assert.deepEqual(
    decideLabGate({ ...ALL_OK, vercelEnv: "staging" }),
    denied("invalid-environment"),
  )
})

test("absent VERCEL_ENV without the local-dev flag → invalid-environment", () => {
  assert.deepEqual(
    decideLabGate({ ...ALL_OK, vercelEnv: undefined }),
    denied("invalid-environment"),
  )
})

test('local dev requires the exact "true" opt-in flag', () => {
  const local = { ...ALL_OK, vercelEnv: undefined, allowedHosts: "localhost:3000", requestHost: "localhost:3000" }
  assert.equal(decideLabGate({ ...local, localDevEnabled: "true" }).allowed, true)
  assert.deepEqual(decideLabGate({ ...local, localDevEnabled: "TRUE" }), denied("invalid-environment"))
  assert.deepEqual(decideLabGate({ ...local, localDevEnabled: "1" }), denied("invalid-environment"))
  assert.deepEqual(decideLabGate({ ...local, localDevEnabled: undefined }), denied("invalid-environment"))
})

test('local-dev flag also covers VERCEL_ENV "development" but nothing else', () => {
  const local = { ...ALL_OK, localDevEnabled: "true" }
  assert.equal(decideLabGate({ ...local, vercelEnv: "development" }).allowed, true)
  assert.deepEqual(decideLabGate({ ...local, vercelEnv: "staging" }), denied("invalid-environment"))
})

// --- Incomplete configuration is always a denial -----------------------------

test("empty input object → denied at the first failing check", () => {
  const empty: LabGateInput = {
    enabled: undefined,
    deploymentMode: undefined,
    expectedProjectId: undefined,
    actualProjectId: undefined,
    allowedHosts: undefined,
    requestHost: undefined,
    vercelEnv: undefined,
    localDevEnabled: undefined,
  }
  assert.deepEqual(decideLabGate(empty), denied("disabled"))
})

// --- Denials never leak configuration ---------------------------------------

test("deny decisions carry only { allowed, reason } — no config or host values", () => {
  const cases: LabGateInput[] = [
    { ...ALL_OK, enabled: undefined },
    { ...ALL_OK, actualProjectId: "prj_other" },
    { ...ALL_OK, requestHost: "evil-lab.example.com" },
    { ...ALL_OK, vercelEnv: "staging" },
  ]
  for (const input of cases) {
    const decision = decideLabGate(input)
    assert.equal(decision.allowed, false)
    assert.deepEqual(Object.keys(decision).sort(), ["allowed", "reason"])
    if (!decision.allowed) {
      assert.doesNotMatch(decision.reason, /prj_|example\.com|vercel\.app/)
    }
  }
})

// --- Host helpers ------------------------------------------------------------

test("normalizeHost rejects empty, path-smuggling and wildcard values", () => {
  assert.equal(normalizeHost(undefined), null)
  assert.equal(normalizeHost(""), null)
  assert.equal(normalizeHost("   "), null)
  assert.equal(normalizeHost("lab.example.com/evil"), null)
  assert.equal(normalizeHost("user@lab.example.com"), null)
  assert.equal(normalizeHost("*.example.com"), null)
  assert.equal(normalizeHost("lab.example.com?x=1"), null)
  assert.equal(normalizeHost(" Lab.Example.Com "), "lab.example.com")
})

test("parseAllowedHosts drops invalid entries instead of widening them", () => {
  assert.deepEqual(parseAllowedHosts("lab.example.com, *.evil.com, ,foo.bar/x"), [
    "lab.example.com",
  ])
  assert.deepEqual(parseAllowedHosts(undefined), [])
})

// --- Namespace predicate -----------------------------------------------------

test("isLabNamespacePath accepts exactly /lab", () => {
  assert.equal(isLabNamespacePath("/lab"), true)
})

test("isLabNamespacePath accepts /lab/... subpaths", () => {
  assert.equal(isLabNamespacePath("/lab/"), true)
  assert.equal(isLabNamespacePath("/lab/finesse"), true)
  assert.equal(isLabNamespacePath("/lab/experiments/foo"), true)
})

test("isLabNamespacePath rejects /laboratory and /labyrinth", () => {
  assert.equal(isLabNamespacePath("/laboratory"), false)
  assert.equal(isLabNamespacePath("/labyrinth"), false)
  assert.equal(isLabNamespacePath("/labsomething"), false)
})

// --- Config-level gate readiness (preflight, no request host) --------------

const CFG_OK = {
  enabled: "true",
  deploymentMode: "dedicated",
  expectedProjectId: "prj_lab_123",
  actualProjectId: "prj_lab_123",
  allowedHosts: "lab.example.com",
  vercelEnv: "production",
  localDevEnabled: undefined,
}

test("evaluateLabProjectConfig: full valid config (allowlist non-empty) → ready", () => {
  assert.deepEqual(evaluateLabProjectConfig(CFG_OK), { ready: true })
})

test("evaluateLabProjectConfig: flag off → not ready (disabled)", () => {
  assert.deepEqual(evaluateLabProjectConfig({ ...CFG_OK, enabled: undefined }), {
    ready: false,
    reason: "disabled",
  })
})

test("evaluateLabProjectConfig: project mismatch → not ready", () => {
  assert.deepEqual(evaluateLabProjectConfig({ ...CFG_OK, actualProjectId: "prj_other" }), {
    ready: false,
    reason: "project-mismatch",
  })
})

test("evaluateLabProjectConfig: empty allowlist → not ready (invalid-configuration)", () => {
  assert.deepEqual(evaluateLabProjectConfig({ ...CFG_OK, allowedHosts: "" }), {
    ready: false,
    reason: "invalid-configuration",
  })
})

test("isLabNamespacePath rejects /api/lab and normal app routes", () => {
  assert.equal(isLabNamespacePath("/api/lab"), false)
  assert.equal(isLabNamespacePath("/api/lab/session"), false)
  assert.equal(isLabNamespacePath("/today"), false)
  assert.equal(isLabNamespacePath("/calendario"), false)
  assert.equal(isLabNamespacePath("/inbox"), false)
  assert.equal(isLabNamespacePath("/"), false)
})
