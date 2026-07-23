/**
 * Finesse demo data seeder — hardened for safety and idempotency.
 *
 * Three modes:
 *   1. discover   — find workspaces for an owner
 *   2. dry-run    — show what would be created
 *   3. seed       — create demo data (with confirmation + atomic transaction)
 *
 * Safety features:
 *   - Idempotent: uses FINESSE_DEMO markers to identify and update demo records
 *   - Deterministic: resolves clients by email (Map), not DB query order
 *   - Atomic: wraps all seed writes in db.$transaction
 *   - Config-safe: validates Workspace.config JSON, rejects invalid configs
 *   - Relative dates: recalculated on each run so no drift
 *   - Conversation safety: uses source field for markers, preserves visible subject
 *   - Real-workspace guard: a workspace that is NOT flagged as the internal
 *     demo AND holds unmarked clients/conversations is refused (see
 *     `assessDemoTarget`); overridable only with the workspace-bound
 *     FINESSE_DEMO_ALLOW_UNFLAGGED=ALLOW:<workspaceId>
 *
 * Marker fields:
 *   - Cliente.customId: FINESSE_DEMO:client:01
 *   - Contact.source: FINESSE_DEMO:contact:01
 *   - Evento.descripcion: FINESSE_DEMO:cita:01
 *   - Conversation.source: FINESSE_DEMO:conv:01
 *   - Factura.numero: DEMO-FINESSE-<workspace>-001
 *   - ContentPiece.notas: FINESSE_DEMO:content:01
 *   - WorkspaceTask.sourceType/sourceId: finesse_demo / FINESSE_DEMO:task:01
 *   - Tarea.descripcion (last line): FINESSE_DEMO:tarea:01
 *
 * Workspace.config writes (all non-destructive):
 *   - businessProfile: fill-only-missing (owner edits always win)
 *   - serviceCatalog: fallback only when no canonical catalog resolves
 *   - demo flag + finesseDemoMetadata: merged, existing keys preserved
 */

import "dotenv/config"
import { pathToFileURL } from "url"
import { PrismaLibSql } from "@prisma/adapter-libsql"
import { PrismaClient } from "../generated/prisma/client"
import {
  FINESSE_DEMO_CLIENTS,
  FINESSE_DEMO_EVENTS,
  FINESSE_DEMO_CONVERSATIONS,
  FINESSE_DEMO_INVOICES,
  FINESSE_DEMO_CONTENT_PIECES,
  FINESSE_DEMO_WORKSPACE_TASKS,
  FINESSE_DEMO_TAREAS,
  FINESSE_DEMO_BUSINESS_PROFILE,
  FINESSE_DEMO_SERVICE_CATALOG,
  FINESSE_DEMO_TASK_SOURCE_TYPE,
  FINESSE_DEMO_CHANNEL_CONNECTIONS,
  FINESSE_DEMO_OBSOLETE_CONNECTION_IDS,
  generateDemoInvoiceNumber,
  getRelativeDate,
  getDemoDatasetSummary,
  buildClientMap,
  resolveClientId,
  validateDemoData,
} from "./finesse-demo-data"
import {
  parseWorkspaceConfig,
  mergeDemoWorkspaceConfig,
  mergeDemoBusinessProfile,
  shouldWriteDemoServiceCatalog,
  assessDemoTarget,
  type DemoTargetAssessment,
} from "./finesse-demo-utils"
import { BEAUTY_NAV_VERTICAL_KEYS } from "../core/vertical-packs/nav-profile"
import { BEAUTY_PACK, buildBeautyDefaultConfig } from "../core/vertical-packs/beauty"

const dbUrl = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL
if (!dbUrl) throw new Error("DATABASE_URL or TURSO_DATABASE_URL must be set")

const adapter = new PrismaLibSql({
  url: dbUrl,
  authToken: process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN,
})
const db = new PrismaClient({ adapter })

interface CommandContext {
  mode: "discover" | "dry-run" | "seed"
  ownerEmail: string | null
  workspaceId: string | null
  verbose: boolean
}

/**
 * Parse command-line arguments.
 */
function parseArgs(): CommandContext {
  const mode = (process.argv[2] || "discover") as "discover" | "dry-run" | "seed"
  const ownerEmail = process.argv.includes("--owner")
    ? process.argv[process.argv.indexOf("--owner") + 1]
    : process.env.FINESSE_OWNER_EMAIL || null
  const workspaceId = process.argv.includes("--workspace-id")
    ? process.argv[process.argv.indexOf("--workspace-id") + 1]
    : process.env.FINESSE_WORKSPACE_ID || null
  const verbose = process.argv.includes("--verbose")

  return { mode, ownerEmail, workspaceId, verbose }
}

/**
 * Check if a workspace belongs to the Beauty/Finesse family.
 */
function isBeautyWorkspace(verticalKey: string | null): boolean {
  if (!verticalKey) return false
  return BEAUTY_NAV_VERTICAL_KEYS.has(verticalKey)
}

/**
 * Preflight: classify the target workspace (flagged demo / fresh / real-looking)
 * from its config + marker-aware row counts. Read-only.
 */
async function assessTargetWorkspace(
  workspaceId: string,
  configParsed: Record<string, unknown>,
): Promise<DemoTargetAssessment> {
  const [totalClients, demoClients, totalConversations, demoConversations] = await Promise.all([
    db.cliente.count({ where: { workspaceId } }),
    db.cliente.count({ where: { workspaceId, customId: { startsWith: "FINESSE_DEMO:" } } }),
    db.conversation.count({ where: { workspaceId } }),
    db.conversation.count({ where: { workspaceId, source: { startsWith: "FINESSE_DEMO:" } } }),
  ])
  return assessDemoTarget(configParsed, {
    totalClients,
    demoClients,
    totalConversations,
    demoConversations,
  })
}

function describeAssessment(a: DemoTargetAssessment): string {
  switch (a.status) {
    case "ok-flagged-demo":
      return "workspace is flagged as the Finesse internal demo (config.demo) — safe to (re)seed"
    case "ok-fresh":
      return "workspace is not flagged yet but holds no unmarked data — first activation is safe"
    case "blocked-unflagged-data":
      return `workspace is NOT flagged as demo and holds unmarked data (${a.nonDemoClients} client(s), ${a.nonDemoConversations} conversation(s)) — it looks like a REAL workspace`
  }
}

/**
 * DISCOVER mode: list workspaces for an owner.
 */
async function discoverMode(ownerEmail: string): Promise<void> {
  console.log(`[discover] Finding workspaces for: ${ownerEmail}`)

  const user = await db.user.findUnique({
    where: { email: ownerEmail },
    select: { id: true, email: true },
  })
  if (!user) {
    console.error(`[discover] User not found: ${ownerEmail}`)
    process.exit(1)
  }

  const memberships = await db.workspaceMember.findMany({
    where: { userId: user.id },
    select: {
      workspace: {
        select: { id: true, nombre: true, vertical: true, verticalKey: true },
      },
    },
  })

  if (memberships.length === 0) {
    console.log(`[discover] No workspaces found for this user`)
    process.exit(0)
  }

  console.log(`[discover] Workspaces:`)
  for (const membership of memberships) {
    const isBeauty = isBeautyWorkspace(membership.workspace.verticalKey)
    const tag = isBeauty ? " ✓ BEAUTY" : ""
    console.log(
      `  ${membership.workspace.id} | ${membership.workspace.nombre} | ${membership.workspace.verticalKey}${tag}`,
    )
  }

  const beautyCount = memberships.filter((m) => isBeautyWorkspace(m.workspace.verticalKey)).length
  console.log(`\n[discover] Found ${beautyCount} Beauty workspace(s)`)
}

/**
 * DRY-RUN mode: show what would be created without modifying anything.
 */
async function dryRunMode(ownerEmail: string, workspaceId: string): Promise<void> {
  console.log(`[dry-run] Workspace: ${workspaceId}`)

  const user = await db.user.findUnique({
    where: { email: ownerEmail },
    select: { id: true, email: true },
  })
  if (!user) {
    console.error(`[dry-run] User not found: ${ownerEmail}`)
    process.exit(1)
  }

  const membership = await db.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId } },
  })
  if (!membership) {
    console.error(`[dry-run] User is not a member of workspace ${workspaceId}`)
    process.exit(1)
  }

  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, nombre: true, vertical: true, verticalKey: true, config: true },
  })
  if (!workspace) {
    console.error(`[dry-run] Workspace not found: ${workspaceId}`)
    process.exit(1)
  }

  if (!isBeautyWorkspace(workspace.verticalKey)) {
    console.error(
      `[dry-run] Workspace is not a Beauty vertical: ${workspace.verticalKey} (expected one of: ${Array.from(BEAUTY_NAV_VERTICAL_KEYS).join(", ")})`,
    )
    process.exit(1)
  }

  // Validate Workspace.config
  const configParsed = parseWorkspaceConfig(workspace.config)
  if (configParsed === null) {
    console.error(`[dry-run] Workspace.config contains invalid JSON — aborting without modifications`)
    process.exit(1)
  }

  console.log(`[dry-run] ✓ User ${user.email} is member of workspace ${workspace.nombre}`)
  console.log(`[dry-run] ✓ Workspace is Beauty vertical: ${workspace.verticalKey}`)
  console.log(`[dry-run] ✓ Workspace.config is valid JSON (or empty)`)

  // Preflight: is this actually the demo workspace (or a safe fresh one)?
  const assessment = await assessTargetWorkspace(workspaceId, configParsed)
  if (assessment.status === "blocked-unflagged-data") {
    console.error(`[dry-run] ✗ BLOCKED: ${describeAssessment(assessment)}`)
    console.error(
      `[dry-run]   The seed mode will refuse this workspace. If you are absolutely sure it is the demo, set FINESSE_DEMO_ALLOW_UNFLAGGED=ALLOW:${workspaceId}`,
    )
  } else {
    console.log(`[dry-run] ✓ Target check: ${describeAssessment(assessment)}`)
  }

  const existingClientCount = await db.cliente.count({ where: { workspaceId } })
  const existingEventCount = await db.evento.count({ where: { workspaceId } })
  const existingContactCount = await db.contact.count({ where: { workspaceId } })
  const existingConversationCount = await db.conversation.count({ where: { workspaceId } })
  const existingMessageCount = await db.message.count({ where: { workspaceId } })
  const existingFacturaCount = await db.factura.count({ where: { workspaceId } })
  const existingContentCount = await db.contentPiece.count({ where: { workspaceId } })
  const existingWorkspaceTaskCount = await db.workspaceTask.count({ where: { workspaceId } })
  const existingTareaCount = await db.tarea.count({ where: { workspaceId } })

  console.log(`\n[dry-run] Existing data in workspace:`)
  console.log(`  Clientes: ${existingClientCount}`)
  console.log(`  Eventos: ${existingEventCount}`)
  console.log(`  Contactos: ${existingContactCount}`)
  console.log(`  Conversaciones: ${existingConversationCount}`)
  console.log(`  Mensajes: ${existingMessageCount}`)
  console.log(`  Facturas: ${existingFacturaCount}`)
  console.log(`  ContentPieces: ${existingContentCount}`)
  console.log(`  WorkspaceTasks: ${existingWorkspaceTaskCount}`)
  console.log(`  Tareas: ${existingTareaCount}`)

  const summary = getDemoDatasetSummary()
  console.log(`\n[dry-run] Demo dataset to be created or updated:`)
  console.log(`  Clientes: ${summary.clients}`)
  console.log(`  Eventos: ${summary.events}`)
  console.log(`  Contactos: ${summary.clients} (one per client)`)
  console.log(`  Conversaciones: ${summary.conversations}`)
  console.log(`  Mensajes: ${summary.messages}`)
  console.log(`  Facturas: ${summary.invoices}`)
  console.log(`  ContentPieces: ${summary.contentPieces}`)
  console.log(`  WorkspaceTasks: ${summary.workspaceTasks}`)
  console.log(`  Tareas: ${summary.tareas}`)
  console.log(`  Workspace.config: businessProfile (fill-missing) + serviceCatalog fallback`)

  console.log(`\n[dry-run] Sample data:`)
  console.log(`  First client: ${FINESSE_DEMO_CLIENTS[0].nombre} (${FINESSE_DEMO_CLIENTS[0].email})`)
  console.log(`  First invoice number: ${generateDemoInvoiceNumber(workspaceId, 1)}`)
  console.log(`  Event type: "cita" (Beauty appointments)`)

  console.log(`\n[dry-run] To proceed with seeding, run:`)
  console.log(`  FINESSE_DEMO_CONFIRM=SEED:${workspaceId} npx tsx scripts/seed-finesse-demo.ts seed --workspace-id ${workspaceId} --owner ${ownerEmail}`)
}

/**
 * SEED mode: create or update demo data (with confirmation + atomic transaction).
 */
async function seedMode(ownerEmail: string, workspaceId: string): Promise<void> {
  console.log(`[seed] Starting demo data operation...`)

  // Confirmation token
  const expectedToken = `SEED:${workspaceId}`
  const confirmToken = process.env.FINESSE_DEMO_CONFIRM
  if (confirmToken !== expectedToken) {
    console.error(`[seed] Confirmation token mismatch.`)
    console.error(`[seed] Expected env var: FINESSE_DEMO_CONFIRM=${expectedToken}`)
    console.error(`[seed] Got: ${confirmToken || "(not set)"}`)
    process.exit(1)
  }

  // Re-check everything
  const user = await db.user.findUnique({
    where: { email: ownerEmail },
    select: { id: true, email: true },
  })
  if (!user) {
    console.error(`[seed] User not found: ${ownerEmail}`)
    process.exit(1)
  }

  const membership = await db.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId } },
  })
  if (!membership) {
    console.error(`[seed] User is not a member of workspace ${workspaceId}`)
    process.exit(1)
  }

  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, nombre: true, vertical: true, verticalKey: true, config: true },
  })
  if (!workspace) {
    console.error(`[seed] Workspace not found: ${workspaceId}`)
    process.exit(1)
  }

  if (!isBeautyWorkspace(workspace.verticalKey)) {
    console.error(`[seed] Workspace is not a Beauty vertical: ${workspace.verticalKey}`)
    process.exit(1)
  }

  // Validate Workspace.config
  const configParsed = parseWorkspaceConfig(workspace.config)
  if (configParsed === null) {
    console.error(`[seed] Workspace.config contains invalid JSON — aborting without modifications`)
    process.exit(1)
  }

  // Validate demo dataset consistency (markers, indices, unique emails)
  const datasetValidation = validateDemoData()
  if (!datasetValidation.valid) {
    console.error(`[seed] Demo dataset is invalid — aborting without modifications:`)
    for (const err of datasetValidation.errors) console.error(`  - ${err}`)
    process.exit(1)
  }

  // Preflight: refuse anything that looks like a REAL operator workspace.
  // A workspace qualifies only when it is already flagged as the internal
  // demo, or when it is fresh (no unmarked clients/conversations). The
  // explicit override exists for a deliberate operator decision and is
  // workspace-bound, so it can never be left set globally by accident.
  const assessment = await assessTargetWorkspace(workspaceId, configParsed)
  if (assessment.status === "blocked-unflagged-data") {
    const override = process.env.FINESSE_DEMO_ALLOW_UNFLAGGED
    if (override !== `ALLOW:${workspaceId}`) {
      console.error(`[seed] ✗ BLOCKED: ${describeAssessment(assessment)}`)
      console.error(`[seed]   No rows were written.`)
      console.error(
        `[seed]   Only if you are absolutely sure this is the demo workspace, re-run with FINESSE_DEMO_ALLOW_UNFLAGGED=ALLOW:${workspaceId}`,
      )
      process.exit(1)
    }
    console.log(`[seed] ⚠ Unflagged workspace with unmarked data — proceeding under explicit override`)
  } else {
    console.log(`[seed] ✓ Target check: ${describeAssessment(assessment)}`)
  }

  console.log(`[seed] ✓ All pre-checks passed`)
  console.log(`[seed] Creating/updating demo data for: ${workspace.nombre}`)

  // Execute seed inside a transaction
  try {
    await db.$transaction(
      async (tx) => {
        await performSeed(tx, workspaceId, configParsed, ownerEmail, user.id, workspace.verticalKey)
      },
      // The seed issues ~100 sequential lookups+writes against a remote Turso
      // database; Prisma's 5s default interactive-transaction timeout expires
      // mid-run on network latency alone.
      { maxWait: 30_000, timeout: 300_000 },
    )
    console.log(`[seed] ✓ Demo data operation completed successfully`)
  } catch (error) {
    console.error(`[seed] Transaction failed:`, error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

/**
 * Core seeding logic wrapped in transaction.
 * This function receives a Prisma transaction client and uses it for all writes.
 */
export async function performSeed(
  tx: any, // Prisma transaction client
  workspaceId: string,
  existingConfig: Record<string, unknown>,
  ownerEmail: string,
  ownerUserId: string,
  verticalKey: string,
): Promise<void> {
  const createdData = {
    clientes: 0,
    contactos: 0,
    eventos: 0,
    conversaciones: 0,
    mensajes: 0,
    facturas: 0,
    contentPieces: 0,
    workspaceTasks: 0,
    tareas: 0,
    channelConnections: 0,
  }

  const updatedData = {
    eventos: 0,
    conversaciones: 0,
    facturas: 0,
    contentPieces: 0,
    workspaceTasks: 0,
    tareas: 0,
    channelConnections: 0,
  }

  // === PHASE 1: Create or skip clients (no updates for clients) ===
  const clientes: Array<{ id: string; email: string }> = []
  for (const demoClient of FINESSE_DEMO_CLIENTS) {
    const demoMarker = `FINESSE_DEMO:client:${FINESSE_DEMO_CLIENTS.indexOf(demoClient) + 1}`

    const existing = await tx.cliente.findFirst({
      where: { workspaceId, email: demoClient.email },
    })

    if (existing) {
      console.log(`  [skip] Cliente ${demoClient.nombre} already exists`)
      clientes.push({ id: existing.id, email: demoClient.email })
      continue
    }

    const created = await tx.cliente.create({
      data: {
        nombre: demoClient.nombre,
        email: demoClient.email,
        telefono: demoClient.telefono,
        empresa: demoClient.empresa,
        tipo: demoClient.tipo,
        estado: demoClient.estado,
        notas: demoClient.notas,
        customId: demoMarker,
        workspaceId,
      },
    })
    clientes.push({ id: created.id, email: demoClient.email })
    createdData.clientes++
    console.log(`  [create] Cliente: ${demoClient.nombre}`)
  }

  const clientMap = buildClientMap(clientes)

  // === PHASE 2: Create or skip contacts (one per client) ===
  const contacts: Array<{ id: string; clienteId: string }> = []
  for (const demoClient of FINESSE_DEMO_CLIENTS) {
    const clienteId = resolveClientId(demoClient, clientMap)
    if (!clienteId) {
      console.log(`  [skip] No client found for ${demoClient.email}`)
      continue
    }

    const contactDemoMarker = `FINESSE_DEMO:contact:${FINESSE_DEMO_CLIENTS.indexOf(demoClient) + 1}`

    const existing = await tx.contact.findFirst({
      where: { workspaceId, email: demoClient.email },
    })
    if (existing) {
      console.log(`  [skip] Contact ${demoClient.nombre} already exists`)
      contacts.push({ id: existing.id, clienteId })
      continue
    }

    const created = await tx.contact.create({
      data: {
        nombre: demoClient.nombre,
        email: demoClient.email,
        telefono: demoClient.telefono,
        empresa: demoClient.empresa,
        source: contactDemoMarker,
        workspaceId,
        clienteId,
      },
    })
    contacts.push({ id: created.id, clienteId })
    createdData.contactos++
    console.log(`  [create] Contact: ${demoClient.nombre}`)
  }

  // === PHASE 3: Create or update events ===
  const eventoIdsByMarker = new Map<string, string>()
  for (const eventData of FINESSE_DEMO_EVENTS) {
    const demoClient = FINESSE_DEMO_CLIENTS[eventData.clientIndex]
    if (!demoClient) continue

    const clienteId = resolveClientId(demoClient, clientMap)
    if (!clienteId) continue

    const demoMarker = eventData.demoMarker || "FINESSE_DEMO:cita:unknown"

    const fechaInicio = getRelativeDate(eventData.daysOffset, eventData.hora, eventData.minuto)
    const fechaFin = new Date(fechaInicio.getTime() + eventData.duracionMinutos * 60000)

    // Check if demo event exists
    const existing = await tx.evento.findFirst({
      where: {
        workspaceId,
        clienteId,
        descripcion: demoMarker,
      },
    })

    if (existing) {
      // Update existing demo event with new relative dates
      await tx.evento.update({
        where: { id: existing.id },
        data: {
          titulo: eventData.titulo,
          fechaInicio,
          fechaFin,
          tipo: "cita",
        },
      })
      eventoIdsByMarker.set(demoMarker, existing.id)
      updatedData.eventos++
      console.log(`  [update] Evento: ${eventData.titulo} (dates refreshed)`)
    } else {
      // Create new event
      const created = await tx.evento.create({
        data: {
          titulo: eventData.titulo,
          descripcion: demoMarker,
          fechaInicio,
          fechaFin,
          tipo: "cita",
          workspaceId,
          clienteId,
        },
      })
      eventoIdsByMarker.set(demoMarker, created.id)
      createdData.eventos++
      console.log(`  [create] Evento: ${eventData.titulo}`)
    }
  }

  // === PHASE 4: Create or update conversations and messages ===
  const conversationIdsByMarker = new Map<string, string>()
  for (const convData of FINESSE_DEMO_CONVERSATIONS) {
    const demoClient = FINESSE_DEMO_CLIENTS[convData.clientIndex]
    if (!demoClient) continue

    const clienteId = resolveClientId(demoClient, clientMap)
    if (!clienteId) continue

    // Get contact for this client
    const contact = contacts.find((c) => c.clienteId === clienteId)
    if (!contact) {
      console.log(`  [skip] No contact for cliente ${demoClient.nombre}`)
      continue
    }

    const demoMarker = convData.demoMarker || "FINESSE_DEMO:conv:unknown"

    // Check if demo conversation exists by source field (not subject)
    const existing = await tx.conversation.findFirst({
      where: {
        workspaceId,
        contactId: contact.id,
        source: demoMarker,
      },
    })

    if (existing) {
      // Delete old messages and recreate them
      await tx.message.deleteMany({
        where: { conversationId: existing.id },
      })

      // Recreate messages
      let lastMessageAt = new Date()
      for (const msg of convData.messages) {
        const createdAt = msg.hoursAgo ? new Date(Date.now() - msg.hoursAgo * 3600000) : new Date()
        lastMessageAt = createdAt

        await tx.message.create({
          data: {
            conversationId: existing.id,
            workspaceId,
            direction: msg.direction,
            role: msg.role,
            content: msg.content,
            contentType: "text",
            createdAt,
          },
        })
      }

      // Update conversation (restore human-readable subject and other metadata)
      await tx.conversation.update({
        where: { id: existing.id },
        data: {
          subject: convData.subject,
          clienteId,
          messageCount: convData.messages.length,
          lastMessageAt,
          // Preserve other fields that may have been set by users (status, channel, category…)
        },
      })

      conversationIdsByMarker.set(demoMarker, existing.id)
      updatedData.conversaciones++
      console.log(
        `  [update] Conversation: "${convData.subject}" (${convData.messages.length} messages refreshed)`,
      )
    } else {
      // Create new conversation
      const conversation = await tx.conversation.create({
        data: {
          subject: convData.subject,
          source: demoMarker,
          contactId: contact.id,
          clienteId,
          workspaceId,
          channel: "manual",
          status: "new",
          messageCount: convData.messages.length,
        },
      })

      // Create messages
      let lastMessageAt = new Date()
      for (const msg of convData.messages) {
        const createdAt = msg.hoursAgo ? new Date(Date.now() - msg.hoursAgo * 3600000) : new Date()
        lastMessageAt = createdAt

        await tx.message.create({
          data: {
            conversationId: conversation.id,
            workspaceId,
            direction: msg.direction,
            role: msg.role,
            content: msg.content,
            contentType: "text",
            createdAt,
          },
        })
        createdData.mensajes++
      }

      // Update conversation with final metadata
      await tx.conversation.update({
        where: { id: conversation.id },
        data: {
          messageCount: convData.messages.length,
          lastMessageAt,
        },
      })

      conversationIdsByMarker.set(demoMarker, conversation.id)
      createdData.conversaciones++
      console.log(`  [create] Conversation: "${convData.subject}" (${convData.messages.length} messages)`)
    }
  }

  // === PHASE 5: Create or update invoices ===
  for (let i = 0; i < FINESSE_DEMO_INVOICES.length; i++) {
    const invData = FINESSE_DEMO_INVOICES[i]
    const demoClient = FINESSE_DEMO_CLIENTS[invData.clientIndex]
    if (!demoClient) continue

    const clienteId = resolveClientId(demoClient, clientMap)
    if (!clienteId) continue

    const numero = generateDemoInvoiceNumber(workspaceId, i + 1)

    // numero is globally @unique, so look it up globally and then verify
    // workspace ownership: never touch an invoice from another workspace.
    const existing = await tx.factura.findFirst({
      where: { numero },
    })

    if (existing && existing.workspaceId !== workspaceId) {
      throw new Error(
        `Invoice number collision: ${numero} already exists in another workspace — aborting (transaction will be rolled back)`,
      )
    }

    // Relative dates recalculated on every run so the demo never drifts:
    // an overdue invoice stays overdue, a paid one keeps a recent paid date.
    const fechaEmision = getRelativeDate(-invData.daysAgo)
    const fechaVencimiento =
      typeof invData.dueOffsetDays === "number" ? getRelativeDate(invData.dueOffsetDays) : null
    const paidAt =
      typeof invData.paidDaysAgo === "number" ? getRelativeDate(-invData.paidDaysAgo, 12, 0) : null

    if (existing) {
      // Update existing demo invoice (date recalculation, status preservation)
      await tx.factura.update({
        where: { id: existing.id },
        data: {
          fechaEmision,
          fechaVencimiento,
          paidAt,
        },
      })
      updatedData.facturas++
      console.log(`  [update] Factura: ${numero} (dates refreshed)`)
    } else {
      // Create new invoice
      await tx.factura.create({
        data: {
          numero,
          estado: invData.estado,
          subtotal: invData.subtotal,
          impuesto: invData.impuesto,
          total: invData.subtotal + invData.impuesto,
          items: JSON.stringify([
            {
              descripcion: invData.descripcion,
              cantidad: 1,
              precioUnitario: invData.subtotal,
              total: invData.subtotal,
            },
          ]),
          fechaEmision,
          fechaVencimiento,
          paidAt,
          clienteId,
          workspaceId,
        },
      })
      createdData.facturas++
      console.log(`  [create] Factura: ${numero}`)
    }
  }

  // === PHASE 5b: Create or update workspace tasks (Today's work lanes) ===
  for (const taskData of FINESSE_DEMO_WORKSPACE_TASKS) {
    const demoMarker = taskData.demoMarker

    const clienteId =
      typeof taskData.clientIndex === "number" &&
      FINESSE_DEMO_CLIENTS[taskData.clientIndex]
        ? resolveClientId(FINESSE_DEMO_CLIENTS[taskData.clientIndex], clientMap)
        : null
    const eventoId = taskData.eventMarker
      ? eventoIdsByMarker.get(taskData.eventMarker) ?? null
      : null
    const conversationId = taskData.conversationMarker
      ? conversationIdsByMarker.get(taskData.conversationMarker) ?? null
      : null

    // Today drops future-dated tasks and only shows undated tasks to their
    // assignee — dated demo tasks are always due TODAY (see dataset docs).
    const dueAt =
      typeof taskData.dueHour === "number"
        ? getRelativeDate(0, taskData.dueHour, taskData.dueMinute ?? 0)
        : null

    const assigneeType =
      taskData.assign === "owner" ? "user" : taskData.assign === "ai" ? "ai" : "unassigned"
    const assigneeId =
      taskData.assign === "owner" ? ownerUserId : taskData.assign === "ai" ? "fanny" : null

    const existing = await tx.workspaceTask.findFirst({
      where: {
        workspaceId,
        sourceType: FINESSE_DEMO_TASK_SOURCE_TYPE,
        sourceId: demoMarker,
      },
    })

    if (existing) {
      // Refresh dates and content; preserve a completion/dismissal the owner
      // may have performed on the demo task (do not resurrect it).
      const isTerminal = existing.completedAt !== null || existing.dismissedAt !== null
      await tx.workspaceTask.update({
        where: { id: existing.id },
        data: {
          title: taskData.title,
          description: taskData.description,
          priority: taskData.priority,
          dueAt,
          clienteId,
          eventoId,
          conversationId,
          sourceLabel: taskData.sourceLabel,
          ...(isTerminal ? {} : { status: taskData.status }),
        },
      })
      updatedData.workspaceTasks++
      console.log(`  [update] WorkspaceTask: ${taskData.title} (dates refreshed)`)
    } else {
      await tx.workspaceTask.create({
        data: {
          workspaceId,
          title: taskData.title,
          description: taskData.description,
          status: taskData.status,
          priority: taskData.priority,
          assigneeType,
          assigneeId,
          dueAt,
          sourceType: FINESSE_DEMO_TASK_SOURCE_TYPE,
          sourceId: demoMarker,
          sourceLabel: taskData.sourceLabel,
          clienteId,
          eventoId,
          conversationId,
          createdBy: ownerUserId,
          suggestedBy: taskData.suggestedBy ?? "user",
          executionMode: taskData.executionMode ?? "manual",
        },
      })
      createdData.workspaceTasks++
      console.log(`  [create] WorkspaceTask: ${taskData.title}`)
    }
  }

  // === PHASE 5c: Create or update legacy CRM tasks (the /tareas page) ===
  for (const tareaData of FINESSE_DEMO_TAREAS) {
    const demoMarker = tareaData.demoMarker

    const clienteId =
      typeof tareaData.clientIndex === "number" &&
      FINESSE_DEMO_CLIENTS[tareaData.clientIndex]
        ? resolveClientId(FINESSE_DEMO_CLIENTS[tareaData.clientIndex], clientMap)
        : null

    // Tarea has no metadata column; the marker travels on its own line at the
    // end of `descripcion` and idempotency matches with `contains`.
    const descripcion = `${tareaData.descripcion}\n${demoMarker}`
    const fechaLimite =
      typeof tareaData.dueOffsetDays === "number"
        ? getRelativeDate(tareaData.dueOffsetDays, 18, 0)
        : null

    const existing = await tx.tarea.findFirst({
      where: { workspaceId, descripcion: { contains: demoMarker } },
    })

    if (existing) {
      // Refresh deadline and content; preserve an estado the owner may have
      // moved (e.g. completada) — demo runs never un-complete a task.
      const isTerminal = existing.estado === "completada" || existing.estado === "cancelada"
      await tx.tarea.update({
        where: { id: existing.id },
        data: {
          titulo: tareaData.titulo,
          descripcion,
          prioridad: tareaData.prioridad,
          fechaLimite,
          clienteId,
          ...(isTerminal ? {} : { estado: tareaData.estado }),
        },
      })
      updatedData.tareas++
      console.log(`  [update] Tarea: ${tareaData.titulo} (dates refreshed)`)
    } else {
      await tx.tarea.create({
        data: {
          titulo: tareaData.titulo,
          descripcion,
          estado: tareaData.estado,
          prioridad: tareaData.prioridad,
          fechaLimite,
          clienteId,
          workspaceId,
        },
      })
      createdData.tareas++
      console.log(`  [create] Tarea: ${tareaData.titulo}`)
    }
  }

  // === PHASE 6: Create or update content pieces ===
  for (const contentData of FINESSE_DEMO_CONTENT_PIECES) {
    const demoMarker = contentData.demoMarker || "FINESSE_DEMO:content:unknown"

    const existing = await tx.contentPiece.findFirst({
      where: { workspaceId, notas: demoMarker },
    })

    let fechaPublicada: Date | null = null
    let fechaProgramada: Date | null = null
    if (contentData.estado === "published" && contentData.daysAgo) {
      fechaPublicada = getRelativeDate(-contentData.daysAgo)
    } else if (contentData.estado === "scheduled" && contentData.daysInFuture) {
      fechaProgramada = getRelativeDate(contentData.daysInFuture)
    }

    if (existing) {
      // Update existing demo content
      await tx.contentPiece.update({
        where: { id: existing.id },
        data: {
          estado: contentData.estado,
          fechaPublicada,
          fechaProgramada,
        },
      })
      updatedData.contentPieces++
      console.log(`  [update] ContentPiece: ${contentData.titulo} (status/dates refreshed)`)
    } else {
      // Create new content piece
      await tx.contentPiece.create({
        data: {
          titulo: contentData.titulo,
          copy: contentData.copy,
          plataforma: contentData.plataforma,
          tipo: contentData.tipo,
          estado: contentData.estado,
          notas: demoMarker,
          fechaPublicada,
          fechaProgramada,
          workspaceId,
        },
      })
      createdData.contentPieces++
      console.log(`  [create] ContentPiece: ${contentData.titulo}`)
    }
  }

  // === PHASE 6b: Create or update demo channel connections (Business
  // Profile → Channels, 03B). Clearly fictitious email mailboxes on the
  // reserved .invalid TLD, provider "demo" so no cron/transport ever
  // touches them. No credentials/sync data are ever written. Idempotency
  // key: [workspaceId, externalAccountId] (unique in the schema).

  // 6b.0: remove connections an earlier seed revision created and 03B
  // disallows (fictitious pending WhatsApp, old resend demo box).
  const obsolete = await tx.channelConnection.deleteMany({
    where: { workspaceId, externalAccountId: { in: FINESSE_DEMO_OBSOLETE_CONNECTION_IDS } },
  })
  if (obsolete.count > 0) {
    console.log(`  [delete] ${obsolete.count} obsolete demo channel connection(s) removed`)
  }

  for (const demoConnection of FINESSE_DEMO_CHANNEL_CONNECTIONS) {
    const existing = await tx.channelConnection.findFirst({
      where: { workspaceId, externalAccountId: demoConnection.externalAccountId },
    })

    if (existing) {
      await tx.channelConnection.update({
        where: { id: existing.id },
        data: {
          name: demoConnection.name,
          status: demoConnection.status,
          isDefault: demoConnection.isDefault,
        },
      })
      updatedData.channelConnections++
      console.log(`  [update] ChannelConnection: ${demoConnection.name} (status refreshed)`)
    } else {
      await tx.channelConnection.create({
        data: {
          workspaceId,
          channelType: demoConnection.channelType,
          provider: demoConnection.provider,
          name: demoConnection.name,
          externalAccountId: demoConnection.externalAccountId,
          status: demoConnection.status,
          isDefault: demoConnection.isDefault,
        },
      })
      createdData.channelConnections++
      console.log(`  [create] ChannelConnection: ${demoConnection.name}`)
    }
  }

  // === PHASE 7: Merge business profile, service catalog fallback and demo
  // metadata into Workspace.config ===

  // 7a. Business profile — fill ONLY fields the owner has not set yet, so a
  // hand-edited profile is never overwritten by a re-run.
  const profileMerge = mergeDemoBusinessProfile(existingConfig, FINESSE_DEMO_BUSINESS_PROFILE)
  let workingConfig = profileMerge.config
  if (profileMerge.filledKeys.length > 0) {
    console.log(`  [config] businessProfile filled: ${profileMerge.filledKeys.join(", ")}`)
  } else {
    console.log(`  [skip] businessProfile already complete — untouched`)
  }

  // 7b. Service catalog fallback — only when neither the vertical defaults
  // nor the workspace provide one (e.g. Beauty-alias verticalKey without a
  // seeded Vertical row). The canonical source always wins.
  const verticalRow = await tx.vertical.findUnique({
    where: { key: verticalKey },
    select: { defaultConfig: true },
  })
  const verticalDefaults = verticalRow
    ? parseWorkspaceConfig(verticalRow.defaultConfig)
    : verticalKey === BEAUTY_PACK.verticalKey
      ? parseWorkspaceConfig(buildBeautyDefaultConfig())
      : null
  if (shouldWriteDemoServiceCatalog(workingConfig, verticalDefaults)) {
    workingConfig = { ...workingConfig, serviceCatalog: FINESSE_DEMO_SERVICE_CATALOG }
    console.log(`  [config] serviceCatalog fallback written (${FINESSE_DEMO_SERVICE_CATALOG.length} services)`)
  } else {
    console.log(`  [skip] serviceCatalog resolves from its canonical source — untouched`)
  }

  // 7c. Demo metadata + demo flag.
  const demoMetadata = {
    createdAt: new Date().toISOString(),
    created: createdData,
    updated: updatedData,
  }

  const newConfig = mergeDemoWorkspaceConfig(workingConfig, demoMetadata, ownerEmail)

  await tx.workspace.update({
    where: { id: workspaceId },
    data: {
      config: JSON.stringify(newConfig),
    },
  })

  // Report results
  console.log(`\n[seed] ✓ Demo data operation completed:`)
  console.log(`  Created: ${JSON.stringify(createdData)}`)
  console.log(`  Updated: ${JSON.stringify(updatedData)}`)
  console.log(`  Workspace.config merged with demo metadata`)
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  const ctx = parseArgs()

  if (!ctx.ownerEmail) {
    console.error("Owner email is required (--owner or FINESSE_OWNER_EMAIL env var)")
    process.exit(1)
  }

  try {
    switch (ctx.mode) {
      case "discover":
        await discoverMode(ctx.ownerEmail)
        break
      case "dry-run":
        if (!ctx.workspaceId) {
          console.error("Workspace ID is required for dry-run (--workspace-id or FINESSE_WORKSPACE_ID env var)")
          process.exit(1)
        }
        await dryRunMode(ctx.ownerEmail, ctx.workspaceId)
        break
      case "seed":
        if (!ctx.workspaceId) {
          console.error(
            "Workspace ID is required for seed (--workspace-id or FINESSE_WORKSPACE_ID env var)",
          )
          process.exit(1)
        }
        await seedMode(ctx.ownerEmail, ctx.workspaceId)
        break
    }
  } catch (error) {
    console.error("[error]", error instanceof Error ? error.message : String(error))
    if (ctx.verbose && error instanceof Error) {
      console.error(error.stack)
    }
    process.exit(1)
  } finally {
    await db.$disconnect()
  }
}

/**
 * Only run the CLI when executed directly (e.g. `tsx scripts/seed-finesse-demo.ts`).
 * When imported (the Lab provisioner reuses `performSeed`), `main()` must not
 * fire and the module must not connect on its own.
 */
const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : ""
if (import.meta.url === invokedPath) {
  main()
}
