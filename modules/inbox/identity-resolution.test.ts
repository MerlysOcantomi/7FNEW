import assert from "node:assert/strict"
import test from "node:test"
import {
  buildIdentityDescriptor,
  hashIdentityValue,
  normalizeEmail,
  normalizeHandle,
  normalizePhone,
  planContactForInbound,
  projectIdentityResolution,
  type IdentityLinkLike,
} from "./identity-resolution"

// ─── Normalization ──────────────────────────────────────────────────────────

test("email normalization lowercases, trims and rejects non-emails", () => {
  assert.equal(normalizeEmail("  Lola.Nails@Example.COM "), "lola.nails@example.com")
  assert.equal(normalizeEmail("not-an-email"), null)
  assert.equal(normalizeEmail("@nope"), null)
  assert.equal(normalizeEmail(""), null)
  assert.equal(normalizeEmail(null), null)
})

test("phone normalization is E.164 ONLY with explicit country context", () => {
  assert.deepEqual(normalizePhone("+34 612 34 56 78"), { value: "+34612345678", quality: "e164" })
  assert.deepEqual(normalizePhone("0034612345678"), { value: "+34612345678", quality: "e164" })
  // No country context → digits-only, flagged (never invent a country).
  assert.deepEqual(normalizePhone("612 34 56 78"), { value: "612345678", quality: "digits" })
  // Explicit context provided by the caller → E.164.
  assert.deepEqual(normalizePhone("612345678", { defaultCountryCallingCode: "34" }), {
    value: "+34612345678",
    quality: "e164",
  })
  assert.equal(normalizePhone("123"), null)
  assert.equal(normalizePhone(""), null)
})

test("handle normalization strips @ and lowercases", () => {
  assert.equal(normalizeHandle("@Lola.Nails"), "lola.nails")
  assert.equal(normalizeHandle("  @@x "), "x")
  assert.equal(normalizeHandle("@"), null)
})

test("hashIdentityValue is stable and never echoes the raw value", () => {
  const hash = hashIdentityValue("+34612345678")
  assert.equal(hash, hashIdentityValue("+34612345678"))
  assert.equal(hash.length, 16)
  assert.ok(!hash.includes("612345678"))
})

// ─── Routing descriptor doctrine ────────────────────────────────────────────

test("globally-addressed kinds use provider unknown and empty scope", () => {
  assert.deepEqual(
    buildIdentityDescriptor({ channel: "email", kind: "email", rawValue: "A@B.com", provider: "resend" }),
    { channel: "email", provider: "unknown", scopeKey: "", kind: "email", externalKey: "a@b.com" },
  )
  assert.deepEqual(
    buildIdentityDescriptor({ channel: "sms", kind: "phone", rawValue: "+34612345678", provider: "twilio" }),
    { channel: "sms", provider: "unknown", scopeKey: "", kind: "phone", externalKey: "+34612345678" },
  )
})

test("provider-scoped kinds use the real provider and providerAccountId scope", () => {
  assert.deepEqual(
    buildIdentityDescriptor({
      channel: "messenger",
      kind: "psid",
      rawValue: "psid-123",
      provider: "meta",
      providerAccountId: "page_A",
      connectionId: "conn_1",
    }),
    { channel: "messenger", provider: "meta", scopeKey: "page_A", kind: "psid", externalKey: "psid-123" },
  )
  // Degraded fallback: connectionId only when no account id.
  assert.equal(
    buildIdentityDescriptor({
      channel: "messenger",
      kind: "psid",
      rawValue: "psid-123",
      provider: "meta",
      connectionId: "conn_1",
    })?.scopeKey,
    "conn_1",
  )
})

test("visitor ids are workspace-scoped through the routing key itself", () => {
  assert.deepEqual(
    buildIdentityDescriptor({ channel: "web_chat", kind: "visitor", rawValue: "v-42" }),
    { channel: "web_chat", provider: "unknown", scopeKey: "", kind: "visitor", externalKey: "v-42" },
  )
})

// ─── Resolution projection (the 04B.2 required matrix) ──────────────────────

const link = (contactId: string, status: IdentityLinkLike["status"], source = "ingestion") =>
  ({ contactId, status, source }) as IdentityLinkLike

test("no links → unresolved", () => {
  assert.deepEqual(projectIdentityResolution([]), {
    resolutionStatus: "unresolved",
    primaryContactId: null,
  })
})

test("one confirmed link → resolved with that contact", () => {
  assert.deepEqual(projectIdentityResolution([link("c1", "confirmed")]), {
    resolutionStatus: "resolved",
    primaryContactId: "c1",
  })
})

test("two confirmed links → ambiguous, no silent selection", () => {
  assert.deepEqual(projectIdentityResolution([link("c1", "confirmed"), link("c2", "confirmed")]), {
    resolutionStatus: "ambiguous",
    primaryContactId: null,
  })
})

test("suggested/declared/rejected links never select a contact", () => {
  assert.deepEqual(
    projectIdentityResolution([
      link("c1", "suggested"),
      link("c2", "suggested", "declared"),
      link("c3", "rejected"),
    ]),
    { resolutionStatus: "unresolved", primaryContactId: null },
  )
})

test("rejection: rejecting one of two confirmed resolves to the survivor", () => {
  // Before: ambiguous. Operator rejects c2's link.
  assert.deepEqual(projectIdentityResolution([link("c1", "confirmed"), link("c2", "rejected")]), {
    resolutionStatus: "resolved",
    primaryContactId: "c1",
  })
})

test("manual correction: old confirmed → rejected, new manual confirmed wins", () => {
  const links = [link("c1", "rejected", "manual"), link("c2", "confirmed", "manual")]
  assert.deepEqual(projectIdentityResolution(links), {
    resolutionStatus: "resolved",
    primaryContactId: "c2",
  })
})

test("merge: links repointed to the survivor collapse to one resolved contact", () => {
  // After a merge both former links point at the surviving contact.
  const links = [link("cSurvivor", "confirmed", "merge"), link("cSurvivor", "confirmed")]
  assert.deepEqual(projectIdentityResolution(links), {
    resolutionStatus: "resolved",
    primaryContactId: "cSurvivor",
  })
})

test("contact deletion: links gone → back to unresolved", () => {
  // Cascade removed the deleted contact's links.
  assert.deepEqual(projectIdentityResolution([link("cOther", "rejected")]), {
    resolutionStatus: "unresolved",
    primaryContactId: null,
  })
})

test("projection is idempotent — same links, same result", () => {
  const links = [link("c1", "confirmed"), link("c2", "suggested")]
  assert.deepEqual(projectIdentityResolution(links), projectIdentityResolution(links))
})

// ─── Provisional contact strategy ───────────────────────────────────────────

test("resolved identity → use the primary contact", () => {
  assert.deepEqual(
    planContactForInbound({ resolutionStatus: "resolved", primaryContactId: "c1" }, []),
    { action: "use_primary", contactId: "c1" },
  )
})

test("unresolved identity reuses ITS provisional contact — never one per message", () => {
  const links = [link("cProv", "suggested", "ingestion")]
  assert.deepEqual(
    planContactForInbound({ resolutionStatus: "unresolved", primaryContactId: null }, links),
    { action: "reuse_provisional", contactId: "cProv" },
  )
})

test("ambiguous identity with only declared claims creates a provisional contact (no silent pick)", () => {
  const links = [link("c1", "suggested", "declared"), link("c2", "suggested", "declared")]
  assert.deepEqual(
    planContactForInbound({ resolutionStatus: "ambiguous", primaryContactId: null }, links),
    { action: "create_provisional" },
  )
})
