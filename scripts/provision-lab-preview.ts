/**
 * Mr Forte Lab — demo environment provisioner (DEV-PREVIEW-01C).
 *
 * Explicit, idempotent, administrative CLI. NEVER run from a web request.
 *
 *   npm run lab:provision-demo
 *
 * Order: data config → database fingerprint → connect → safety preflight →
 * idempotent user/workspace/membership → reusable Finesse seed → post-assess →
 * safe report. It refuses to write unless the fingerprint matches and the
 * database is safe (only the demo workspace + synthetic user, or empty). It
 * never prints secrets, tokens or the full database URL, never deletes unknown
 * rows, and never falls back to another database.
 */

import "dotenv/config"
import { pathToFileURL } from "url"
import { PrismaLibSql } from "@prisma/adapter-libsql"
import { PrismaClient } from "../generated/prisma/client"
import { readLabDataConfig } from "../core/lab/data-config"
import { verifyTursoFingerprint } from "../core/lab/database-fingerprint"
import { LAB_DEMO_IDENTITY, LAB_DEMO_MAX_WORKSPACES } from "../core/lab/demo-identity"
import { assessLabDemoEnvironment } from "../core/lab/demo-environment"
import {
  parseWorkspaceConfig,
  mergeDemoWorkspaceConfig,
} from "./finesse-demo-utils"
import { performSeed } from "./seed-finesse-demo"

function fail(message: string): never {
  console.error(`[lab:provision] ✗ ${message}`)
  process.exit(1)
}

async function main(): Promise<void> {
  console.log("[lab:provision] Starting Mr Forte Lab demo provisioning…")

  // 1. Data configuration.
  const configResult = readLabDataConfig(process.env)
  if (!configResult.ok) fail(`data configuration invalid (${configResult.reason})`)
  const config = configResult.config

  // 2. Database fingerprint — refuse ALL writes on mismatch.
  const rawUrl = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL
  if (!verifyTursoFingerprint(rawUrl, config.expectedDbFingerprint)) {
    fail("database fingerprint mismatch — refusing to write to this database")
  }
  console.log("[lab:provision] ✓ Database fingerprint verified")

  // 3. Connect (own client; never falls back to a default DB).
  if (!rawUrl) fail("TURSO_DATABASE_URL / DATABASE_URL is not set")
  const db = new PrismaClient({
    adapter: new PrismaLibSql({
      url: rawUrl,
      authToken: process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN,
    }),
  })

  try {
    // 4. Safety preflight — only the demo workspace + synthetic user may exist.
    const [workspaceCount, foreignUsers] = await Promise.all([
      db.workspace.count(),
      db.user.count({ where: { id: { notIn: [config.userId] } } }),
    ])
    if (foreignUsers > 0) fail(`unsafe database: ${foreignUsers} unexpected user(s) present`)
    const existingWorkspace = await db.workspace.findUnique({
      where: { id: config.workspaceId },
      select: { id: true },
    })
    const allowedWorkspaces = existingWorkspace ? LAB_DEMO_MAX_WORKSPACES : 0
    if (workspaceCount > allowedWorkspaces) {
      fail(`unsafe database: ${workspaceCount} workspace(s) present, only the demo workspace is allowed`)
    }
    console.log("[lab:provision] ✓ Safety preflight passed")

    // 5. Idempotent synthetic user.
    await db.user.upsert({
      where: { id: config.userId },
      create: {
        id: config.userId,
        email: config.userEmail,
        nombre: "Finesse Preview",
        role: LAB_DEMO_IDENTITY.sessionRole,
      },
      update: { email: config.userEmail, role: LAB_DEMO_IDENTITY.sessionRole },
    })

    // 6. Idempotent demo workspace, flagged demo BEFORE seeding.
    const existingConfigRaw = existingWorkspace
      ? (await db.workspace.findUnique({ where: { id: config.workspaceId }, select: { config: true } }))?.config
      : null
    const parsedExisting = parseWorkspaceConfig(existingConfigRaw ?? null) ?? {}
    const flaggedConfig = mergeDemoWorkspaceConfig(
      parsedExisting,
      { provisionedBy: "lab:provision", provisionedAt: new Date().toISOString() },
      config.userEmail,
    )
    await db.workspace.upsert({
      where: { id: config.workspaceId },
      create: {
        id: config.workspaceId,
        nombre: LAB_DEMO_IDENTITY.workspaceName,
        slug: config.workspaceSlug,
        vertical: LAB_DEMO_IDENTITY.vertical,
        verticalKey: LAB_DEMO_IDENTITY.verticalKey,
        config: JSON.stringify(flaggedConfig),
      },
      update: {
        slug: config.workspaceSlug,
        vertical: LAB_DEMO_IDENTITY.vertical,
        verticalKey: LAB_DEMO_IDENTITY.verticalKey,
        config: JSON.stringify(flaggedConfig),
      },
    })

    // 7. Idempotent membership (canonical ADMIN role for full demo interaction).
    await db.workspaceMember.upsert({
      where: { userId_workspaceId: { userId: config.userId, workspaceId: config.workspaceId } },
      create: { userId: config.userId, workspaceId: config.workspaceId, role: LAB_DEMO_IDENTITY.membershipRole },
      update: { role: LAB_DEMO_IDENTITY.membershipRole },
    })
    console.log("[lab:provision] ✓ Identity, workspace and membership are in place")

    // 8. Reusable Finesse seed (idempotent, marker-based) in a transaction.
    await db.$transaction(
      async (tx) => {
        await performSeed(
          tx,
          config.workspaceId,
          flaggedConfig,
          config.userEmail,
          config.userId,
          LAB_DEMO_IDENTITY.verticalKey,
        )
      },
      { maxWait: 30_000, timeout: 300_000 },
    )
    console.log("[lab:provision] ✓ Finesse demo dataset seeded")

    // 9. Post-assessment + 10. safe report.
    const decision = await assessLabDemoEnvironment(db, process.env)
    const counts = await datasetCounts(db, config.workspaceId)
    console.log("[lab:provision] Dataset counts (demo workspace):")
    for (const [k, v] of Object.entries(counts)) console.log(`    ${k.padEnd(14)} ${v}`)
    if (!decision.allowed) {
      fail(`post-assessment rejected the environment (${decision.reason})`)
    }
    console.log("[lab:provision] ✓ Post-assessment: environment ready")
    console.log(`[lab:provision]   user=${config.userId} workspace=${config.workspaceId} role=${LAB_DEMO_IDENTITY.sessionRole}`)
  } finally {
    await db.$disconnect()
  }
}

export async function datasetCounts(
  db: PrismaClient,
  workspaceId: string,
): Promise<Record<string, number>> {
  const [clients, events, conversations, messages, invoices, workspaceTasks, tareas, contentPieces] =
    await Promise.all([
      db.cliente.count({ where: { workspaceId } }),
      db.evento.count({ where: { workspaceId } }),
      db.conversation.count({ where: { workspaceId } }),
      db.message.count({ where: { workspaceId } }),
      db.factura.count({ where: { workspaceId } }),
      db.workspaceTask.count({ where: { workspaceId } }),
      db.tarea.count({ where: { workspaceId } }),
      db.contentPiece.count({ where: { workspaceId } }),
    ])
  return { clients, events, conversations, messages, invoices, workspaceTasks, tareas, contentPieces }
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : ""
if (import.meta.url === invokedPath) {
  main().catch((err) => {
    console.error("[lab:provision] ✗ Unexpected error:", err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
}
