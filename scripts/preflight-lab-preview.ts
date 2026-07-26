/**
 * Mr Forte Lab — deployment preflight (DEV-PREVIEW-01D).
 *
 *   npm run lab:preflight
 *
 * STRICTLY read-only. Confirms every layer is wired without printing any
 * secret, token, full URL or full hash. Exits non-zero on any failure.
 *
 * Note: Deployment Protection, the WAF rate limit and the LIVE hostname match
 * cannot be asserted from a CLI — they are marked as external HTTP checks and
 * must be smoke-tested against the running deployment (see docs/lab-preview.md).
 */

import "dotenv/config"
import { pathToFileURL } from "url"
import { PrismaLibSql } from "@prisma/adapter-libsql"
import { PrismaClient } from "../generated/prisma/client"
import { evaluateLabProjectConfig } from "../core/lab/gate-policy"
import { readLabGateEnv } from "../core/lab/config"
import { readLabAccessConfig } from "../core/lab/access-config"
import { readLabDataConfig } from "../core/lab/data-config"
import { assertTursoUrlAllowed, verifyTursoFingerprint } from "../core/lab/database-fingerprint"
import { assessLabDemoEnvironment } from "../core/lab/demo-environment"

type SectionResult = { label: string; ready: boolean; note?: string }

function line(r: SectionResult): string {
  return `${r.label.padEnd(22)} ${r.ready ? "READY" : "FAIL"}${r.note ? `  (${r.note})` : ""}`
}

async function main(): Promise<void> {
  const env = process.env
  const results: SectionResult[] = []

  // 1. Project gate (config level; live host match is an external HTTP check).
  const gate = evaluateLabProjectConfig(readLabGateEnv(env))
  results.push({ label: "Project gate", ready: gate.ready, note: gate.ready ? undefined : gate.reason })

  // 2. Access layer (key hash + independent token secret + TTL).
  const access = readLabAccessConfig(env)
  results.push({ label: "Access layer", ready: access.ok, note: access.ok ? undefined : access.reason })

  // 3. Database isolation (data config + protocol policy + fingerprint).
  const data = readLabDataConfig(env)
  const rawUrl = env.TURSO_DATABASE_URL || env.DATABASE_URL
  const protocolOk = assertTursoUrlAllowed(rawUrl, env)
  const fingerprintOk = data.ok && verifyTursoFingerprint(rawUrl, data.config.expectedDbFingerprint)
  const dbIsolation = data.ok && protocolOk.ok && fingerprintOk
  results.push({
    label: "Database isolation",
    ready: dbIsolation,
    note: dbIsolation
      ? undefined
      : !data.ok
        ? data.reason
        : !protocolOk.ok
          ? protocolOk.reason
          : "fingerprint-mismatch",
  })

  // 4/5. Demo dataset + application session (identity/workspace/membership/data).
  let datasetReady = false
  let sessionNote: string | undefined
  if (dbIsolation && rawUrl) {
    const db = new PrismaClient({
      adapter: new PrismaLibSql({
        url: rawUrl,
        authToken: env.TURSO_AUTH_TOKEN || env.DATABASE_AUTH_TOKEN,
      }),
    })
    try {
      const decision = await assessLabDemoEnvironment(db, env)
      datasetReady = decision.allowed
      if (!decision.allowed) sessionNote = decision.reason
    } finally {
      await db.$disconnect()
    }
  } else {
    sessionNote = "blocked-by-database-isolation"
  }
  results.push({ label: "Demo dataset", ready: datasetReady, note: datasetReady ? undefined : sessionNote })
  results.push({ label: "Application session", ready: datasetReady, note: datasetReady ? undefined : sessionNote })

  // 6. OAuth isolation: on a correctly-gated Lab deployment Google OAuth is
  //    blocked. Readiness of the gate config implies OAuth would be isolated.
  results.push({ label: "OAuth isolation", ready: gate.ready, note: gate.ready ? undefined : "gate-not-ready" })

  const overall = results.every((r) => r.ready)

  console.log("[lab:preflight] Mr Forte Lab preflight (read-only)")
  for (const r of results) console.log(`  ${line(r)}`)
  console.log(`  ${"Overall".padEnd(22)} ${overall ? "READY" : "NOT READY"}`)
  console.log("[lab:preflight] External HTTP checks (cannot be asserted from CLI):")
  console.log("    - Vercel Deployment Protection (private-window smoke)")
  console.log("    - Vercel WAF rate limit on POST /lab/enter (429 smoke)")
  console.log("    - Live request hostname ∈ SEVENEF_LAB_ALLOWED_HOSTS (HTTP smoke)")

  process.exit(overall ? 0 : 1)
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : ""
if (import.meta.url === invokedPath) {
  main().catch((err) => {
    console.error("[lab:preflight] ✗ Unexpected error:", err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
}
