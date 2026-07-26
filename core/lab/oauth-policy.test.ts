import assert from "node:assert/strict"
import test from "node:test"
import { shouldBlockGoogleOAuth, shouldRedirectLoginToLab } from "./oauth-policy"

test("Lab deployment (gate allowed) → block Google OAuth + redirect login to lab", () => {
  assert.equal(shouldBlockGoogleOAuth(true), true)
  assert.equal(shouldRedirectLoginToLab(true), true)
})

test("production / gate denied → Google OAuth untouched", () => {
  assert.equal(shouldBlockGoogleOAuth(false), false)
  assert.equal(shouldRedirectLoginToLab(false), false)
})
