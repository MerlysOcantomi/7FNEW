/**
 * Mr Forte Lab — demo environment verifier (DEV-PREVIEW-01C).
 *
 *   npm run lab:verify-demo
 *
 * STRICTLY read-only. Validates configuration, database fingerprint, the safe
 * database state, the synthetic identity/workspace/membership, the demo marker
 * and the minimum dataset, then prints a safe report. Exits non-zero on any
 * failure (including "not provisioned yet"). Never prints secrets, the Turso
 * token, the full URL, full hashes, JWTs or cookies.
 */

import "dotenv/config"
import { pathToFileURL } from "url"
import { PrismaLibSql } from "@prisma/adapter-libsql"
import { PrismaClient } from "../generated/prisma/client"
import { readLabDataConfig } from "../core/lab/data-config"
import { verifyTursoFingerprint } from "../core/lab/database-fingerprint"
import { assessLabDemoEnvironment } from "../core/lab/demo-environment"
import { datasetCounts } from "./provision-lab-preview"

async function main(): Promise<void> {
  console.log("[lab:verify] Verifying Mr Forte Lab demo environment (read-only)…")

  const configResult = readLabDataConfig(process.env)
  if (!configResult.ok) {
    console.error(`[lab:verify] ✗ REJECTED: data configuration invalid (${configResult.reason})`)
    process.exit(1)
  }
  const config = configResult.config

  const rawUrl = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL
  if (!verifyTursoFingerprint(rawUrl, config.expectedDbFingerprint)) {
    console.error("[lab:verify] ✗ REJECTED: database fingerprint mismatch")
    process.exit(1)
  }
  if (!rawUrl) {
    console.error("[lab:verify] ✗ REJECTED: no database URL configured")
    process.exit(1)
  }

  const db = new PrismaClient({
    adapter: new PrismaLibSql({
      url: rawUrl,
      authToken: process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN,
    }),
  })

  try {
    const decision = await assessLabDemoEnvironment(db, process.env)
    if (!decision.allowed) {
      console.error(`[lab:verify] ✗ REJECTED: ${decision.reason}`)
      process.exit(1)
    }
    const counts = await datasetCounts(db, config.workspaceId)
    console.log("[lab:verify] ✓ ALLOWED — environment is provisioned and safe")
    console.log(`[lab:verify]   user=${config.userId} workspace=${config.workspaceId} role=editor`)
    console.log("[lab:verify]   Dataset counts (demo workspace):")
    for (const [k, v] of Object.entries(counts)) console.log(`      ${k.padEnd(14)} ${v}`)
  } finally {
    await db.$disconnect()
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : ""
if (import.meta.url === invokedPath) {
  main().catch((err) => {
    console.error("[lab:verify] ✗ Unexpected error:", err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
}
