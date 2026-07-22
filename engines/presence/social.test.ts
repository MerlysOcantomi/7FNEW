import { test } from "node:test"
import assert from "node:assert/strict"
import {
  normalizeSocialLink,
  normalizeSocialLinks,
  socialMapToLinks,
  socialLinksToMap,
  publicSocialForAssistant,
  PRESENCE_SOCIAL_KEYS,
} from "./social"

// ---- single-value normalization -------------------------------------------

test("Instagram username (@handle) becomes a public URL", () => {
  assert.equal(normalizeSocialLink("instagram", "@estudioaurora"), "https://instagram.com/estudioaurora")
  assert.equal(normalizeSocialLink("instagram", "estudioaurora"), "https://instagram.com/estudioaurora")
})

test("a full valid URL is accepted and canonicalized to https", () => {
  assert.equal(normalizeSocialLink("facebook", "https://facebook.com/estudio"), "https://facebook.com/estudio")
  assert.equal(normalizeSocialLink("facebook", "http://facebook.com/estudio"), "https://facebook.com/estudio")
  assert.equal(normalizeSocialLink("instagram", "instagram.com/estudio"), "https://instagram.com/estudio")
})

test("query strings and fragments are stripped", () => {
  assert.equal(normalizeSocialLink("instagram", "https://instagram.com/estudio?igshid=x#top"), "https://instagram.com/estudio")
})

test("TikTok usernames may contain dots", () => {
  assert.equal(normalizeSocialLink("tiktok", "@estudio.aurora"), "https://www.tiktok.com/@estudio.aurora")
})

test("empty / whitespace values are omitted (null)", () => {
  assert.equal(normalizeSocialLink("instagram", ""), null)
  assert.equal(normalizeSocialLink("instagram", "   "), null)
  assert.equal(normalizeSocialLink("instagram", null), null)
})

test("invalid values are omitted (no error)", () => {
  assert.equal(normalizeSocialLink("instagram", "not a handle!!"), null)
  assert.equal(normalizeSocialLink("instagram", "user name with spaces"), null)
})

test("SECURITY: non-http schemes are rejected", () => {
  assert.equal(normalizeSocialLink("instagram", "javascript:alert(1)"), null)
  assert.equal(normalizeSocialLink("instagram", "data:text/html,x"), null)
  assert.equal(normalizeSocialLink("instagram", "ftp://instagram.com/x"), null)
})

test("SECURITY: a URL pointing at a DIFFERENT platform/domain is rejected", () => {
  // facebook URL provided in the instagram field → rejected.
  assert.equal(normalizeSocialLink("instagram", "https://facebook.com/evil"), null)
  // look-alike / attacker domain → rejected.
  assert.equal(normalizeSocialLink("instagram", "https://instagram.com.evil.com/x"), null)
  assert.equal(normalizeSocialLink("x", "https://twitter.com.evil.com/x"), null)
})

test("X accepts both x.com and twitter.com hosts", () => {
  assert.equal(normalizeSocialLink("x", "@studio"), "https://x.com/studio")
  assert.equal(normalizeSocialLink("x", "https://twitter.com/studio"), "https://twitter.com/studio")
})

test("unknown platform key → null", () => {
  assert.equal(normalizeSocialLink("myspace", "@x"), null)
})

// ---- record normalization --------------------------------------------------

test("normalizeSocialLinks keeps only valid entries, in platform order", () => {
  const links = normalizeSocialLinks({
    facebook: "https://facebook.com/studio",
    instagram: "@studio",
    tiktok: "",
    x: "https://evil.com/x", // invalid → dropped
    unknownNetwork: "@nope", // unknown key → dropped
  })
  assert.deepEqual(links.map((l) => l.platform), ["instagram", "facebook"])
  assert.equal(links[0].href, "https://instagram.com/studio")
})

test("no networks → empty list (renderer shows nothing)", () => {
  assert.deepEqual(normalizeSocialLinks({}), [])
  assert.deepEqual(normalizeSocialLinks(undefined), [])
})

test("one network → single link", () => {
  const links = normalizeSocialLinks({ instagram: "@only" })
  assert.equal(links.length, 1)
  assert.equal(links[0].label, "Instagram")
})

test("socialMapToLinks rebuilds ordered labelled links from a validated map", () => {
  const map = socialLinksToMap(normalizeSocialLinks({ x: "@s", instagram: "@s" }))
  const links = socialMapToLinks(map)
  assert.deepEqual(links.map((l) => l.platform), ["instagram", "x"])
})

// ---- Fanny -----------------------------------------------------------------

test("publicSocialForAssistant returns only valid public links (Fanny-safe)", () => {
  const links = publicSocialForAssistant({
    instagram: "@studio",
    facebook: "https://evil.com/x", // invalid → excluded
    tiktok: "",
  })
  assert.deepEqual(links.map((l) => l.platform), ["instagram"])
  assert.ok(links.every((l) => l.href.startsWith("https://")))
})

test("the platform key set is stable and covers the required networks", () => {
  for (const k of ["instagram", "facebook", "tiktok", "youtube", "linkedin", "pinterest", "threads", "x"]) {
    assert.ok(PRESENCE_SOCIAL_KEYS.includes(k), `missing platform ${k}`)
  }
})
