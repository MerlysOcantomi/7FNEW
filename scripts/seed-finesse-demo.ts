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
 *
 * Marker fields:
 *   - Cliente.customId: FINESSE_DEMO:client:01
 *   - Contact.source: FINESSE_DEMO:contact:01
 *   - Evento.descripcion: FINESSE_DEMO:cita:01
 *   - Conversation.source: FINESSE_DEMO:conv:01
 *   - Factura.numero: DEMO-FINESSE-<workspace>-001
 *   - ContentPiece.notas: FINESSE_DEMO:content:01
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
  getDemoDatasetSummary,
  buildClientMap,
  resolveClientId,
} from "./finesse-demo-data"
import { parseWorkspaceConfig, mergeDemoWorkspaceConfig } from "./finesse-demo-utils"
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

  console.log(`[seed] ✓ All pre-checks passed`)
  console.log(`[seed] Creating/updating demo data for: ${workspace.nombre}`)

  // Execute seed inside a transaction
  try {
    await db.$transaction(async (tx) => {
      await performSeed(tx, workspaceId, configParsed)
    })
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
async function performSeed(
  tx: any, // Prisma transaction client
  workspaceId: string,
  existingConfig: Record<string, unknown>,
): Promise<void> {
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
      updatedData.eventos++
      console.log(`  [update] Evento: ${eventData.titulo} (dates refreshed)`)
    } else {
      // Create new event
      await tx.evento.create({
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
          messageCount: convData.messages.length,
          lastMessageAt,
          // Preserve other fields that may have been set by users
        },
      })

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

    const existing = await tx.factura.findFirst({
      where: { numero },
    })

    if (existing) {
      // Update existing demo invoice (date recalculation, status preservation)
      const fechaEmision = getRelativeDate(-invData.daysAgo)
      await tx.factura.update({
        where: { id: existing.id },
        data: {
          fechaEmision,
        },
      })
      updatedData.facturas++
      console.log(`  [update] Factura: ${numero} (date refreshed)`)
    } else {
      // Create new invoice
      const fechaEmision = getRelativeDate(-invData.daysAgo)
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

  // === PHASE 7: Merge demo metadata into Workspace.config ===
  const demoMetadata = {
    createdAt: new Date().toISOString(),
    created: createdData,
    updated: updatedData,
  }

  const newConfig = mergeDemoWorkspaceConfig(existingConfig, demoMetadata)

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

main()
