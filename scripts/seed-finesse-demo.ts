/**
 * Finesse demo data seeder — hardened for safety and idempotency.
 *
 * Three modes:
 *   1. discover   — find workspaces for an owner
 *   2. dry-run    — show what would be created
 *   3. seed       — create demo data (with confirmation)
 *
 * Safety features:
 *   - Idempotent: uses FINESSE_DEMO markers to identify and update demo records
 *   - Deterministic: resolves clients by email (Map), not DB query order
 *   - Atomic: wraps seed writes in db.$transaction
 *   - Config-safe: validates Workspace.config JSON, rejects invalid configs
 *   - Relative dates: recalculated on each run so no drift
 *
 * Limitations (LibSQL/Turso):
 *   - $transaction may not support nested writes — will fall back to sequential
 *   - Conversion to event type "cita" (Beauty appointments)
 */

import "dotenv/config"
import { PrismaLibSql } from "@prisma/adapter-libsql"
import { PrismaClient } from "../generated/prisma/client"
import {
  FINESSE_DEMO_CLIENTS,
  FINESSE_DEMO_EVENTS,
  FINESSE_DEMO_CONVERSATIONS,
  FINESSE_DEMO_INVOICES,
  FINESSE_DEMO_CONTENT_PIECES,
  generateDemoInvoiceNumber,
  getRelativeDate,
  validateDemoData,
  getDemoDatasetSummary,
  buildClientMap,
  resolveClientId,
} from "./finesse-demo-data"
import { BEAUTY_NAV_VERTICAL_KEYS } from "../core/vertical-packs/nav-profile"

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
 * Validate and parse Workspace.config JSON.
 * Returns parsed config or null if invalid. Rejects silently invalid configs.
 */
function parseWorkspaceConfig(configRaw: string | null | undefined): Record<string, unknown> | null {
  if (!configRaw) return {}
  if (!configRaw.trim()) return {}

  try {
    const parsed = JSON.parse(configRaw)
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return null // Invalid: not a JSON object
  } catch {
    return null // Invalid JSON
  }
}

/**
 * DISCOVER mode: list workspaces for an owner.
 */
async function discoverMode(ownerEmail: string): Promise<void> {
  console.log(`[discover] Looking for user: ${ownerEmail}`)

  const user = await db.user.findUnique({
    where: { email: ownerEmail },
    select: { id: true, nombre: true, email: true, memberships: { select: { workspaceId: true } } },
  })

  if (!user) {
    console.error(`[discover] User not found: ${ownerEmail}`)
    process.exit(1)
  }

  console.log(`[discover] Found user: ${user.nombre || user.email} (${user.id})`)
  console.log(`[discover] Fetching workspaces...`)

  if (user.memberships.length === 0) {
    console.log(`[discover] No workspaces found for this user`)
    process.exit(0)
  }

  const workspaceIds = user.memberships.map((m) => m.workspaceId)

  const workspaces = await db.workspace.findMany({
    where: { id: { in: workspaceIds } },
    select: {
      id: true,
      nombre: true,
      vertical: true,
      verticalKey: true,
      plan: true,
    },
  })

  console.log(`\n[discover] Workspaces (${workspaces.length}):`)
  console.log("")

  for (const ws of workspaces) {
    const isBeauty = isBeautyWorkspace(ws.verticalKey)
    const tag = isBeauty ? "✓ BEAUTY" : "  (other vertical)"

    // Count records
    const clientCount = await db.cliente.count({ where: { workspaceId: ws.id } })
    const eventoCount = await db.evento.count({ where: { workspaceId: ws.id } })
    const contactCount = await db.contact.count({ where: { workspaceId: ws.id } })
    const conversationCount = await db.conversation.count({ where: { workspaceId: ws.id } })
    const messageCount = await db.message.count({ where: { workspaceId: ws.id } })
    const facturaCount = await db.factura.count({ where: { workspaceId: ws.id } })
    const contentPieceCount = await db.contentPiece.count({ where: { workspaceId: ws.id } })

    console.log(`  ${tag}`)
    console.log(`    ID: ${ws.id}`)
    console.log(`    Name: ${ws.nombre}`)
    console.log(`    Vertical: ${ws.vertical} (${ws.verticalKey})`)
    console.log(`    Plan: ${ws.plan}`)
    console.log(`    Data:`)
    console.log(`      - Clientes: ${clientCount}`)
    console.log(`      - Eventos: ${eventoCount}`)
    console.log(`      - Contactos: ${contactCount}`)
    console.log(`      - Conversaciones: ${conversationCount}`)
    console.log(`      - Mensajes: ${messageCount}`)
    console.log(`      - Facturas: ${facturaCount}`)
    console.log(`      - ContentPieces: ${contentPieceCount}`)
    console.log(``)
  }

  console.log(`To use dry-run or seed, pick a Beauty workspace ID and run:`)
  console.log(`  npx tsx scripts/seed-finesse-demo.ts dry-run --workspace-id <ID> --owner ${ownerEmail}`)
}

/**
 * DRY-RUN mode: show what would be created.
 */
async function dryRunMode(ownerEmail: string, workspaceId: string): Promise<void> {
  console.log(`[dry-run] Validating setup...`)

  // Validate demo data first
  const validation = validateDemoData()
  if (!validation.valid) {
    console.error(`[dry-run] Demo data validation failed:`)
    validation.errors.forEach((e) => console.error(`  - ${e}`))
    process.exit(1)
  }

  // Step 1: User exists and belongs to workspace
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

  // Step 2: Workspace exists and is Beauty
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

  // Step 3: Validate Workspace.config
  const configParsed = parseWorkspaceConfig(workspace.config)
  if (configParsed === null) {
    console.error(`[dry-run] Workspace.config contains invalid JSON — aborting without modifications`)
    process.exit(1)
  }

  console.log(`[dry-run] ✓ User ${user.email} is member of workspace ${workspace.nombre}`)
  console.log(`[dry-run] ✓ Workspace is Beauty vertical: ${workspace.verticalKey}`)
  console.log(`[dry-run] ✓ Workspace.config is valid JSON (or empty)`)

  // Step 4: Show existing data
  const existingClientCount = await db.cliente.count({ where: { workspaceId } })
  const existingEventCount = await db.evento.count({ where: { workspaceId } })
  const existingContactCount = await db.contact.count({ where: { workspaceId } })
  const existingConversationCount = await db.conversation.count({ where: { workspaceId } })
  const existingMessageCount = await db.message.count({ where: { workspaceId } })
  const existingFacturaCount = await db.factura.count({ where: { workspaceId } })
  const existingContentCount = await db.contentPiece.count({ where: { workspaceId } })

  console.log(`\n[dry-run] Existing data in workspace:`)
  console.log(`  Clientes: ${existingClientCount}`)
  console.log(`  Eventos: ${existingEventCount}`)
  console.log(`  Contactos: ${existingContactCount}`)
  console.log(`  Conversaciones: ${existingConversationCount}`)
  console.log(`  Mensajes: ${existingMessageCount}`)
  console.log(`  Facturas: ${existingFacturaCount}`)
  console.log(`  ContentPieces: ${existingContentCount}`)

  // Step 5: Show what would be created
  const summary = getDemoDatasetSummary()
  console.log(`\n[dry-run] Demo dataset to be created or updated:`)
  console.log(`  Clientes: ${summary.clients}`)
  console.log(`  Eventos: ${summary.events}`)
  console.log(`  Contactos: ${summary.clients} (one per client)`)
  console.log(`  Conversaciones: ${summary.conversations}`)
  console.log(`  Mensajes: ${summary.messages}`)
  console.log(`  Facturas: ${summary.invoices}`)
  console.log(`  ContentPieces: ${summary.contentPieces}`)

  console.log(`\n[dry-run] Sample data:`)
  console.log(`  First client: ${FINESSE_DEMO_CLIENTS[0].nombre} (${FINESSE_DEMO_CLIENTS[0].email})`)
  console.log(`  First invoice number: ${generateDemoInvoiceNumber(workspaceId, 1)}`)
  console.log(`  Event type: "cita" (Beauty appointments)`)

  console.log(`\n[dry-run] To proceed with seeding, run:`)
  console.log(`  FINESSE_DEMO_CONFIRM=SEED:${workspaceId} npx tsx scripts/seed-finesse-demo.ts seed --workspace-id ${workspaceId} --owner ${ownerEmail}`)
}

/**
 * SEED mode: create or update demo data (with confirmation).
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
    console.error(
      `[seed] Workspace is not a Beauty vertical: ${workspace.verticalKey}`,
    )
    process.exit(1)
  }

  // Validate Workspace.config
  const configParsed = parseWorkspaceConfig(workspace.config)
  if (configParsed === null) {
    console.error(`[seed] Workspace.config contains invalid JSON — aborting without modifications`)
    process.exit(1)
  }

  console.log(`[seed] ✓ All pre-checks passed`)
  console.log(`[seed] Creating/updating demo data for: ${workspace.nombre}`)

  const createdData = {
    clientes: 0,
    contactos: 0,
    eventos: 0,
    conversaciones: 0,
    mensajes: 0,
    facturas: 0,
    contentPieces: 0,
  }

  const updatedData = {
    eventos: 0,
    conversaciones: 0,
    facturas: 0,
    contentPieces: 0,
  }

  // === PHASE 1: Create or skip clients (no updates for clients) ===
  for (const demoClient of FINESSE_DEMO_CLIENTS) {
    const existing = await db.cliente.findFirst({
      where: { workspaceId, email: demoClient.email },
    })
    if (existing) {
      console.log(`  [skip] Cliente ${demoClient.nombre} (${demoClient.email}) already exists`)
      continue
    }
    await db.cliente.create({
      data: {
        nombre: demoClient.nombre,
        email: demoClient.email,
        telefono: demoClient.telefono,
        empresa: demoClient.empresa,
        tipo: demoClient.tipo,
        estado: demoClient.estado,
        notas: demoClient.notas,
        workspaceId,
      },
    })
    createdData.clientes++
    console.log(`  [create] Cliente: ${demoClient.nombre}`)
  }

  // === PHASE 2: Build client map and create/update contacts ===
  const clientes = await db.cliente.findMany({
    where: { workspaceId, email: { in: FINESSE_DEMO_CLIENTS.map((c) => c.email) } },
    select: { id: true, nombre: true, email: true },
  })

  const clientMap = buildClientMap(clientes)

  for (const demoClient of FINESSE_DEMO_CLIENTS) {
    const clienteId = resolveClientId(demoClient, clientMap)
    if (!clienteId) {
      console.log(`  [skip] No client found for ${demoClient.email}`)
      continue
    }

    const existing = await db.contact.findFirst({
      where: { workspaceId, email: demoClient.email },
    })
    if (existing) {
      console.log(`  [skip] Contact ${demoClient.nombre} already exists`)
      continue
    }

    await db.contact.create({
      data: {
        nombre: demoClient.nombre,
        email: demoClient.email,
        telefono: demoClient.telefono,
        workspaceId,
        clienteId,
      },
    })
    createdData.contactos++
    console.log(`  [create] Contact: ${demoClient.nombre}`)
  }

  // === PHASE 3: Create or update events ===
  for (const eventData of FINESSE_DEMO_EVENTS) {
    const demoClient = FINESSE_DEMO_CLIENTS[eventData.clientIndex]
    if (!demoClient) continue

    const clienteId = resolveClientId(demoClient, clientMap)
    if (!clienteId) continue

    const demoMarker = eventData.demoMarker || "FINESSE_DEMO:cita:unknown"

    const fechaInicio = getRelativeDate(eventData.daysOffset, eventData.hora, eventData.minuto)
    const fechaFin = new Date(fechaInicio.getTime() + eventData.duracionMinutos * 60000)

    // Check if demo event exists
    const existing = await db.evento.findFirst({
      where: {
        workspaceId,
        clienteId,
        descripcion: demoMarker,
      },
    })

    if (existing) {
      // Update existing demo event with new relative dates
      await db.evento.update({
        where: { id: existing.id },
        data: {
          titulo: eventData.titulo,
          fechaInicio,
          fechaFin,
          tipo: "cita",
        },
      })
      updatedData.eventos++
      console.log(`  [update] Evento: ${eventData.titulo} (dates refreshed)`)
    } else {
      // Create new event
      await db.evento.create({
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
      createdData.eventos++
      console.log(`  [create] Evento: ${eventData.titulo}`)
    }
  }

  // === PHASE 4: Create or update conversations and messages ===
  for (const convData of FINESSE_DEMO_CONVERSATIONS) {
    const demoClient = FINESSE_DEMO_CLIENTS[convData.clientIndex]
    if (!demoClient) continue

    const clienteId = resolveClientId(demoClient, clientMap)
    if (!clienteId) continue

    // Get contact for this client
    const contact = await db.contact.findFirst({
      where: { workspaceId, clienteId },
    })
    if (!contact) {
      console.log(`  [skip] No contact for cliente ${demoClient.nombre}`)
      continue
    }

    const demoMarker = convData.demoMarker || "FINESSE_DEMO:conv:unknown"

    // Check if demo conversation exists
    const existing = await db.conversation.findFirst({
      where: {
        workspaceId,
        contactId: contact.id,
        subject: demoMarker,
      },
    })

    if (existing) {
      // Delete old messages and recreate them
      await db.message.deleteMany({
        where: { conversationId: existing.id },
      })

      // Recreate messages
      let lastMessageAt = new Date()
      for (const msg of convData.messages) {
        const createdAt = msg.hoursAgo
          ? new Date(Date.now() - msg.hoursAgo * 3600000)
          : new Date()
        lastMessageAt = createdAt

        await db.message.create({
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

      // Update conversation
      await db.conversation.update({
        where: { id: existing.id },
        data: {
          messageCount: convData.messages.length,
          lastMessageAt,
        },
      })

      updatedData.conversaciones++
      console.log(`  [update] Conversation: "${convData.subject}" (${convData.messages.length} messages refreshed)`)
    } else {
      // Create new conversation
      const conversation = await db.conversation.create({
        data: {
          subject: demoMarker,
          contactId: contact.id,
          workspaceId,
          channel: "manual",
          status: "new",
          messageCount: convData.messages.length,
        },
      })

      // Create messages
      let lastMessageAt = new Date()
      for (const msg of convData.messages) {
        const createdAt = msg.hoursAgo
          ? new Date(Date.now() - msg.hoursAgo * 3600000)
          : new Date()
        lastMessageAt = createdAt

        await db.message.create({
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
      await db.conversation.update({
        where: { id: conversation.id },
        data: {
          messageCount: convData.messages.length,
          lastMessageAt,
        },
      })

      createdData.conversaciones++
      console.log(`  [create] Conversation: subject (${convData.messages.length} messages)`)
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

    const existing = await db.factura.findFirst({
      where: { numero },
    })

    if (existing) {
      // Update existing demo invoice (date recalculation, status preservation)
      const fechaEmision = getRelativeDate(-invData.daysAgo)
      await db.factura.update({
        where: { id: existing.id },
        data: {
          fechaEmision,
          // Keep estado, subtotal, impuesto, total, items unchanged unless explicitly updating
        },
      })
      updatedData.facturas++
      console.log(`  [update] Factura: ${numero} (date refreshed)`)
    } else {
      // Create new invoice
      const fechaEmision = getRelativeDate(-invData.daysAgo)
      await db.factura.create({
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
          clienteId,
          workspaceId,
        },
      })
      createdData.facturas++
      console.log(`  [create] Factura: ${numero}`)
    }
  }

  // === PHASE 6: Create or update content pieces ===
  for (const contentData of FINESSE_DEMO_CONTENT_PIECES) {
    const demoMarker = contentData.demoMarker || "FINESSE_DEMO:content:unknown"

    const existing = await db.contentPiece.findFirst({
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
      await db.contentPiece.update({
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
      await db.contentPiece.create({
        data: {
          titulo: contentData.titulo,
          copy: contentData.copy,
          plataforma: contentData.plataforma,
          tipo: contentData.tipo,
          estado: contentData.estado,
          fechaPublicada,
          fechaProgramada,
          notas: demoMarker,
          workspaceId,
        },
      })
      createdData.contentPieces++
      console.log(`  [create] ContentPiece: ${contentData.titulo}`)
    }
  }

  // === PHASE 7: Mark workspace as demo ===
  const updatedConfig = {
    ...configParsed,
    demo: {
      enabled: true,
      type: "finesse-internal",
      ownerEmail: ownerEmail,
    },
  }

  await db.workspace.update({
    where: { id: workspaceId },
    data: { config: JSON.stringify(updatedConfig) },
  })

  console.log(`\n[seed] ✓ Demo data operation complete!`)
  console.log(`[seed] Summary:`)
  console.log(`  Created:`)
  console.log(`    - Clientes: ${createdData.clientes}`)
  console.log(`    - Contactos: ${createdData.contactos}`)
  console.log(`    - Eventos: ${createdData.eventos}`)
  console.log(`    - Conversaciones: ${createdData.conversaciones}`)
  console.log(`    - Mensajes: ${createdData.mensajes}`)
  console.log(`    - Facturas: ${createdData.facturas}`)
  console.log(`    - ContentPieces: ${createdData.contentPieces}`)
  if (Object.values(updatedData).some((v) => v > 0)) {
    console.log(`  Updated:`)
    if (updatedData.eventos > 0) console.log(`    - Eventos: ${updatedData.eventos}`)
    if (updatedData.conversaciones > 0) console.log(`    - Conversaciones: ${updatedData.conversaciones}`)
    if (updatedData.facturas > 0) console.log(`    - Facturas: ${updatedData.facturas}`)
    if (updatedData.contentPieces > 0) console.log(`    - ContentPieces: ${updatedData.contentPieces}`)
  }
  console.log(`\n[seed] Workspace marked as demo in config.`)
}

async function main() {
  const ctx = parseArgs()

  if (!ctx.ownerEmail && ctx.mode !== "discover") {
    console.error(`[error] --owner <email> or FINESSE_OWNER_EMAIL env var is required`)
    process.exit(1)
  }

  if (ctx.mode === "discover") {
    if (!ctx.ownerEmail) {
      console.error(`[error] discover mode requires --owner <email> or FINESSE_OWNER_EMAIL`)
      process.exit(1)
    }
    await discoverMode(ctx.ownerEmail)
  } else if (ctx.mode === "dry-run") {
    if (!ctx.workspaceId) {
      console.error(`[error] dry-run mode requires --workspace-id <id> or FINESSE_WORKSPACE_ID`)
      process.exit(1)
    }
    await dryRunMode(ctx.ownerEmail!, ctx.workspaceId)
  } else if (ctx.mode === "seed") {
    if (!ctx.workspaceId) {
      console.error(`[error] seed mode requires --workspace-id <id> or FINESSE_WORKSPACE_ID`)
      process.exit(1)
    }
    await seedMode(ctx.ownerEmail!, ctx.workspaceId)
  } else {
    console.error(`[error] Unknown mode: ${ctx.mode}`)
    process.exit(1)
  }
}

main()
  .then(() => db.$disconnect())
  .catch((err) => {
    console.error("[error]", err)
    db.$disconnect()
    process.exit(1)
  })
