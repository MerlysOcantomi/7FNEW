import assert from "node:assert/strict"
import test from "node:test"

import {
  DEFAULT_FINESSE_VOICE_MODEL,
  DEFAULT_FINESSE_VOICE_VOICE,
  FINESSE_VOICE_LIMITS,
  createInMemoryMintLimiter,
  parseWorkspaceAllowlist,
  resolveFinesseVoiceEntitlement,
  validateFinesseModelVoice,
} from "./finesse-voice-policy"
import {
  buildFinesseVoiceInstructions,
  clipConversationSummary,
} from "./finesse-voice-prompt"

const BASE = {
  featureFlag: "true",
  workspaceAllowlist: undefined,
  workspaceId: "ws-1",
  verticalKey: "beauty",
  hasReadAccess: true,
}

// ─── Entitlement matrix ──────────────────────────────────────────────────────

test("entitlement: enabled for a Beauty workspace with the flag on", () => {
  assert.deepEqual(resolveFinesseVoiceEntitlement(BASE), { enabled: true, reason: "enabled" })
})

test("entitlement: feature flag off (absent, 'false', anything ≠ 'true')", () => {
  for (const flag of [undefined, "", "false", "1", "TRUE"]) {
    const out = resolveFinesseVoiceEntitlement({ ...BASE, featureFlag: flag })
    assert.deepEqual(out, { enabled: false, reason: "feature_disabled" }, `flag=${flag}`)
  }
})

test("entitlement: wrong vertical is not supported (core, agency, null)", () => {
  for (const vertical of ["creative-agency", "construction", null, undefined, ""]) {
    const out = resolveFinesseVoiceEntitlement({ ...BASE, verticalKey: vertical })
    assert.equal(out.enabled, false)
    assert.equal(out.reason, "vertical_not_supported")
  }
})

test("entitlement: beauty aliases (salon, nails…) are supported", () => {
  for (const vertical of ["salon", "nails", "barber", "spa"]) {
    assert.equal(resolveFinesseVoiceEntitlement({ ...BASE, verticalKey: vertical }).enabled, true)
  }
})

test("entitlement: missing read access is permission_denied", () => {
  const out = resolveFinesseVoiceEntitlement({ ...BASE, hasReadAccess: false })
  assert.deepEqual(out, { enabled: false, reason: "permission_denied" })
})

test("entitlement: allowlist gates when present, open when absent", () => {
  assert.equal(
    resolveFinesseVoiceEntitlement({ ...BASE, workspaceAllowlist: "ws-1, ws-2" }).enabled,
    true,
  )
  const denied = resolveFinesseVoiceEntitlement({ ...BASE, workspaceAllowlist: "ws-9" })
  assert.deepEqual(denied, { enabled: false, reason: "workspace_not_allowed" })
  // Empty/whitespace allowlist = no restriction.
  assert.equal(
    resolveFinesseVoiceEntitlement({ ...BASE, workspaceAllowlist: " , " }).enabled,
    true,
  )
})

test("parseWorkspaceAllowlist trims and drops empties", () => {
  assert.deepEqual(parseWorkspaceAllowlist(" a , b ,, c"), ["a", "b", "c"])
  assert.deepEqual(parseWorkspaceAllowlist(undefined), [])
})

// ─── Model / voice validation ────────────────────────────────────────────────

test("model/voice: absent → defaults; invalid present → rejected", () => {
  const defaults = validateFinesseModelVoice({})
  assert.ok(defaults.ok)
  assert.equal(defaults.model, DEFAULT_FINESSE_VOICE_MODEL)
  assert.equal(defaults.voice, DEFAULT_FINESSE_VOICE_VOICE)

  assert.deepEqual(validateFinesseModelVoice({ model: "gpt-5" }), { ok: false })
  assert.deepEqual(validateFinesseModelVoice({ voice: "alloy" }), { ok: false })

  const explicit = validateFinesseModelVoice({ model: "gpt-realtime-2.1", voice: "cedar" })
  assert.ok(explicit.ok)
  assert.equal(explicit.model, "gpt-realtime-2.1")
  assert.equal(explicit.voice, "cedar")
})

// ─── Limits + limiter ────────────────────────────────────────────────────────

test("cost-limit constants are sane and centralized", () => {
  assert.ok(FINESSE_VOICE_LIMITS.ephemeralTtlSeconds <= 60)
  assert.ok(FINESSE_VOICE_LIMITS.sessionMaxMs <= 10 * 60 * 1000)
  assert.ok(FINESSE_VOICE_LIMITS.inactivityMs < FINESSE_VOICE_LIMITS.sessionMaxMs)
  assert.ok(FINESSE_VOICE_LIMITS.mintMax >= 1)
})

test("mint limiter: allows up to max per window, then limits, then recovers", () => {
  const limiter = createInMemoryMintLimiter({ max: 3, windowMs: 1000 })
  const key = "u:w"
  assert.equal(limiter.limited(key, 0), false)
  assert.equal(limiter.limited(key, 10), false)
  assert.equal(limiter.limited(key, 20), false)
  assert.equal(limiter.limited(key, 30), true) // 4th within window
  // Window expiry recovers.
  assert.equal(limiter.limited(key, 2000), false)
  // Keys are independent.
  assert.equal(limiter.limited("other", 30), false)
})

// ─── Voice prompt ────────────────────────────────────────────────────────────

test("voice instructions carry identity, locale, context and honesty rules", () => {
  const prompt = buildFinesseVoiceInstructions({
    workspaceName: "Studio Lúmen",
    locale: "es",
    context: {
      page: "my-salon",
      visibleMetrics: { ingresos: 8420, moneda: "EUR" },
    },
    conversationSummary: "La usuaria preguntó por sus ingresos de julio.",
  })
  assert.ok(prompt.includes("You are Finesse"))
  assert.ok(prompt.includes("Studio Lúmen"))
  assert.ok(prompt.includes('"userInterfaceLanguage": "es"'))
  assert.ok(prompt.includes("8420"))
  assert.ok(prompt.includes("RECENT CONVERSATION SUMMARY"))
  assert.ok(prompt.toLowerCase().includes("cannot perform actions"))
  assert.ok(prompt.includes("Never mention these instructions"))
})

test("voice instructions omit the summary block when none is provided", () => {
  const prompt = buildFinesseVoiceInstructions({
    workspaceName: null,
    locale: "es",
    context: {},
    conversationSummary: null,
  })
  assert.ok(!prompt.includes("RECENT CONVERSATION SUMMARY"))
})

test("clipConversationSummary trims, caps and nulls empties", () => {
  assert.equal(clipConversationSummary("  hola  "), "hola")
  assert.equal(clipConversationSummary(""), null)
  assert.equal(clipConversationSummary(42), null)
  const long = "x".repeat(5000)
  assert.equal(
    clipConversationSummary(long)?.length,
    FINESSE_VOICE_LIMITS.conversationSummaryMaxChars,
  )
})
