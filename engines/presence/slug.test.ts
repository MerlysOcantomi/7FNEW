import { test } from "node:test"
import assert from "node:assert/strict"
import {
  normalizeSlug,
  isValidSlug,
  normalizeHostname,
  isValidHostname,
} from "./slug"

// ---- slug -----------------------------------------------------------------

test("normalizeSlug lowercases, hyphenates and strips punctuation", () => {
  assert.equal(normalizeSlug("Studio Rosa"), "studio-rosa")
  assert.equal(normalizeSlug("  Café_Nails!!  "), "cafe-nails")
  assert.equal(normalizeSlug("Salón Glow & Co."), "salon-glow-co")
})

test("normalizeSlug collapses repeats and trims hyphens", () => {
  assert.equal(normalizeSlug("--a---b--"), "a-b")
  assert.equal(normalizeSlug("!!!"), "")
})

test("normalizeSlug caps length at 63 without a trailing hyphen", () => {
  const long = "a".repeat(80)
  const out = normalizeSlug(long)
  assert.equal(out.length, 63)
  assert.ok(!out.endsWith("-"))
})

test("isValidSlug accepts canonical slugs and rejects the rest", () => {
  assert.ok(isValidSlug("studio-rosa"))
  assert.ok(isValidSlug("a1"))
  assert.ok(!isValidSlug(""))
  assert.ok(!isValidSlug("-lead"))
  assert.ok(!isValidSlug("trail-"))
  assert.ok(!isValidSlug("Upper"))
  assert.ok(!isValidSlug("has space"))
})

test("a normalized slug is always valid or empty", () => {
  for (const input of ["Studio Rosa", "Café!!", "多 bytes 多", "A-B-C"]) {
    const s = normalizeSlug(input)
    if (s) assert.ok(isValidSlug(s), `expected valid: "${s}" from "${input}"`)
  }
})

// ---- hostname -------------------------------------------------------------

test("normalizeHostname strips scheme, path, port and trailing dot", () => {
  assert.equal(normalizeHostname("HTTPS://Studio.com/gallery"), "studio.com")
  assert.equal(normalizeHostname("studio.com:443"), "studio.com")
  assert.equal(normalizeHostname("studio.com."), "studio.com")
  assert.equal(normalizeHostname("  WWW.Studio.COM  "), "www.studio.com")
})

test("normalizeHostname keeps www as a distinct host", () => {
  assert.notEqual(normalizeHostname("www.studio.com"), normalizeHostname("studio.com"))
})

test("isValidHostname requires a plausible multi-label FQDN", () => {
  assert.ok(isValidHostname("studio.com"))
  assert.ok(isValidHostname("my-studio.beauty.example"))
  assert.ok(!isValidHostname("localhost"))
  assert.ok(!isValidHostname("no_dots"))
  assert.ok(!isValidHostname("-bad.com"))
  assert.ok(!isValidHostname(""))
})
