import assert from "node:assert/strict"
import test from "node:test"
import { SignJWT } from "jose"
import {
  LAB_TOKEN,
  createLabAccessToken,
  verifyLabAccessToken,
} from "./access-token"

const SECRET = "lab-token-secret-value-with-enough-entropy"
const PROJECT = "prj_lab_123"
const bytes = (s: string) => new TextEncoder().encode(s)

/** Sign a token with fully custom claims/registered fields for negative cases. */
async function signCustom(opts: {
  secret?: string
  scope?: unknown
  projectId?: unknown
  iss?: string
  aud?: string
  sub?: string
  jti?: string
  expSecondsFromNow?: number
}): Promise<string> {
  const payload: Record<string, unknown> = {}
  if (opts.scope !== undefined) payload.scope = opts.scope
  if (opts.projectId !== undefined) payload.projectId = opts.projectId
  const now = Math.floor(Date.now() / 1000)
  let jwt = new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(opts.sub ?? LAB_TOKEN.subject)
    .setIssuer(opts.iss ?? LAB_TOKEN.issuer)
    .setAudience(opts.aud ?? LAB_TOKEN.audience)
    .setIssuedAt(now)
    .setExpirationTime(now + (opts.expSecondsFromNow ?? 3600))
  if (opts.jti !== undefined) jwt = jwt.setJti(opts.jti)
  else jwt = jwt.setJti("test-jti-1")
  return jwt.sign(bytes(opts.secret ?? SECRET))
}

// --- Creation & happy path (20, 21) ---

test("createLabAccessToken produces a compact JWS", async () => {
  const token = await createLabAccessToken({ secret: SECRET, projectId: PROJECT, ttlMinutes: 120 })
  assert.equal(token.split(".").length, 3)
})

test("valid token verifies and returns the synthetic claims", async () => {
  const token = await createLabAccessToken({ secret: SECRET, projectId: PROJECT, ttlMinutes: 120 })
  const result = await verifyLabAccessToken(token, { secret: SECRET, expectedProjectId: PROJECT })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.claims.sub, "lab-preview-visitor")
    assert.equal(result.claims.scope, "lab:preview")
    assert.equal(result.claims.iss, "mr-forte-lab")
    assert.equal(result.claims.aud, "sevenef-lab-preview")
    assert.equal(result.claims.projectId, PROJECT)
    assert.equal(typeof result.claims.jti, "string")
    assert.ok(result.claims.exp > result.claims.iat)
  }
})

// --- Rejections (22-31) ---

test("missing / empty token → missing", async () => {
  assert.deepEqual(await verifyLabAccessToken(undefined, { secret: SECRET, expectedProjectId: PROJECT }), {
    ok: false,
    reason: "missing",
  })
  assert.deepEqual(await verifyLabAccessToken("", { secret: SECRET, expectedProjectId: PROJECT }), {
    ok: false,
    reason: "missing",
  })
})

test("tampered signature → invalid-signature", async () => {
  const token = await createLabAccessToken({ secret: SECRET, projectId: PROJECT, ttlMinutes: 120 })
  const parts = token.split(".")
  const tampered = `${parts[0]}.${parts[1]}.${parts[2].slice(0, -2)}xx`
  const result = await verifyLabAccessToken(tampered, { secret: SECRET, expectedProjectId: PROJECT })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, "invalid-signature")
})

test("wrong signing secret → invalid-signature", async () => {
  const token = await signCustom({ secret: "a-different-secret-entirely-xxxxxxxxxxxx", scope: LAB_TOKEN.scope, projectId: PROJECT })
  const result = await verifyLabAccessToken(token, { secret: SECRET, expectedProjectId: PROJECT })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, "invalid-signature")
})

test("expired token → expired", async () => {
  const token = await signCustom({ scope: LAB_TOKEN.scope, projectId: PROJECT, expSecondsFromNow: -60 })
  const result = await verifyLabAccessToken(token, { secret: SECRET, expectedProjectId: PROJECT })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, "expired")
})

test("wrong issuer → issuer", async () => {
  const token = await signCustom({ iss: "someone-else", scope: LAB_TOKEN.scope, projectId: PROJECT })
  const result = await verifyLabAccessToken(token, { secret: SECRET, expectedProjectId: PROJECT })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, "issuer")
})

test("wrong audience → audience", async () => {
  const token = await signCustom({ aud: "some-other-app", scope: LAB_TOKEN.scope, projectId: PROJECT })
  const result = await verifyLabAccessToken(token, { secret: SECRET, expectedProjectId: PROJECT })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, "audience")
})

test("wrong subject → subject", async () => {
  const token = await signCustom({ sub: "real-user", scope: LAB_TOKEN.scope, projectId: PROJECT })
  const result = await verifyLabAccessToken(token, { secret: SECRET, expectedProjectId: PROJECT })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, "subject")
})

test("wrong scope → scope", async () => {
  const token = await signCustom({ scope: "full-access", projectId: PROJECT })
  const result = await verifyLabAccessToken(token, { secret: SECRET, expectedProjectId: PROJECT })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, "scope")
})

test("valid token but wrong expected project id → project-mismatch", async () => {
  const token = await createLabAccessToken({ secret: SECRET, projectId: PROJECT, ttlMinutes: 120 })
  const result = await verifyLabAccessToken(token, {
    secret: SECRET,
    expectedProjectId: "prj_other_project",
  })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, "project-mismatch")
})

test("missing required claim (no projectId) → missing-claim", async () => {
  const token = await signCustom({ scope: LAB_TOKEN.scope })
  const result = await verifyLabAccessToken(token, { secret: SECRET, expectedProjectId: PROJECT })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, "missing-claim")
})

test("malformed token → malformed", async () => {
  const result = await verifyLabAccessToken("not.a.jwt", { secret: SECRET, expectedProjectId: PROJECT })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, "malformed")
})

test("a merely valid signature is not enough — every claim is checked", async () => {
  // Correctly signed with the real secret, but scope is wrong: must still fail.
  const token = await signCustom({ scope: "elevated", projectId: PROJECT })
  const result = await verifyLabAccessToken(token, { secret: SECRET, expectedProjectId: PROJECT })
  assert.equal(result.ok, false)
})
