import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { sslPosture } from "./db"

/**
 * NEON-05 — explicit TLS posture. `sslPosture` is pure (importing core/db.ts
 * builds no client); `.env.example` must document verify-full.
 */
test("sslPosture: verify-full is the only accepted explicit posture; aliases are named as deprecated; loopback needs none", () => {
  assert.equal(sslPosture("postgresql://u:p@ep-x.eu-central-1.aws.neon.tech/neondb?sslmode=verify-full"), "verify-full")
  assert.equal(sslPosture("postgresql://u:p@ep-x.eu-central-1.aws.neon.tech/neondb?sslmode=require"), "deprecated-alias")
  assert.equal(sslPosture("postgresql://u:p@ep-x.eu-central-1.aws.neon.tech/neondb?sslmode=verify-ca"), "deprecated-alias")
  assert.equal(sslPosture("postgresql://u:p@ep-x.eu-central-1.aws.neon.tech/neondb?sslmode=prefer"), "deprecated-alias")
  assert.equal(sslPosture("postgresql://u:p@ep-x.eu-central-1.aws.neon.tech/neondb?sslmode=disable"), "disabled")
  assert.equal(sslPosture("postgresql://u:p@ep-x.eu-central-1.aws.neon.tech/neondb"), "absent")
  assert.equal(sslPosture("postgresql://postgres@127.0.0.1:5432/t7f"), "loopback")
  assert.equal(sslPosture("postgresql://postgres@localhost/t7f"), "loopback")
  assert.equal(sslPosture("postgresql://postgres@[::1]/t7f"), "loopback")
})

test(".env.example documents sslmode=verify-full for both DATABASE_URL and DIRECT_URL and never sslmode=require", () => {
  const env = readFileSync(new URL("../.env.example", import.meta.url), "utf8")
  assert.match(env, /^DATABASE_URL=postgresql:\/\/[^\n]*sslmode=verify-full$/m)
  assert.match(env, /^DIRECT_URL=postgresql:\/\/[^\n]*sslmode=verify-full$/m)
  assert.ok(!/sslmode=require/.test(env))
  assert.match(env, /SEVENF_OPERATION_MODE/)
})
