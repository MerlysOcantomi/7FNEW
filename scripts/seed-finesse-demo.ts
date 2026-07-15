/**
 * Finesse demo data seeder.
 *
 * Three modes:
 *   1. discover   — find workspaces for an owner
 *   2. dry-run    — show what would be created
 *   3. seed       — actually create demo data (with confirmation)
 *
 * Usage:
 *   npx tsx scripts/seed-finesse-demo.ts discover [--owner email@example.com]
 *   npx tsx scripts/seed-finesse-demo.ts dry-run --workspace-id xyz --owner email@example.com
 *   npx tsx scripts/seed-finesse-demo.ts seed --workspace-id xyz --owner email@example.com
 *      (requires env var FINESSE_DEMO_CONFIRM=SEED:xyz)
 *
 * Validation:
 *   - Uses APPOINTMENT_VERTICAL_KEYS from core/vertical-packs to detect Beauty verticals
 *   - Not limited to verticalKey === "beauty"
 *   - Checks user membership and workspace beauty ownership
 *   - Confirms seed mode with exact workspace ID
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
  getWorkspaceShortId,
  validateDemoData,
  getDemoDatasetSummary,
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
 * Reutiliza la misma fuente de verdad que nav-profile.ts (BEAUTY_NAV_VERTICAL_KEYS)
 */
function isBeautyWorkspace(verticalKey: string | null): boolean {
  if (!verticalKey) return false
  return BEAUTY_NAV_VERTICAL_KEYS.has(verticalKey)
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
      clientes: { select: { id: true }, take: 1 },
      eventos: { select: { id: true }, take: 1 },
      contacts: { select: { id: true }, take: 1 },
      conversations: { select: { id: true }, take: 1 },
      messages: { select: { id: true }, take: 1 },
      facturas: { select: { id: true }, take: 1 },
      contentPieces: { select: { id: true }, take: 1 },
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

  console.log(`[dry-run] ✓ User ${user.email} is member of workspace ${workspace.nombre}`)
  console.log(`[dry-run] ✓ Workspace is Beauty vertical: ${workspace.verticalKey}`)

  // Step 3: Show existing data
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

  // Step 4: Show what would be created
  const summary = getDemoDatasetSummary()
  console.log(`\n[dry-run] Demo dataset to be created:`)
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

  console.log(`\n[dry-run] To proceed with seeding, run:`)
  console.log(`  FINESSE_DEMO_CONFIRM=SEED:${workspaceId} npx tsx scripts/seed-finesse-demo.ts seed --workspace-id ${workspaceId} --owner ${ownerEmail}`)
}

/**
 * SEED mode: create demo data (with confirmation).
 */
async function seedMode(ownerEmail: string, workspaceId: string): Promise<void> {
  console.log(`[seed] Starting demo data creation...`)

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

  console.log(`[seed] ✓ All pre-checks passed`)
  console.log(`[seed] Creating demo data for: ${workspace.nombre}`)

  const shortId = getWorkspaceShortId(workspaceId)
  const createdData = {
    clientes: 0,
    contactos: 0,
    eventos: 0,
    conversaciones: 0,
    mensajes: 0,
    facturas: 0,
    contentPieces: 0,
  }

  // Create clients
  for (let i = 0; i < FINESSE_DEMO_CLIENTS.length; i++) {
    const data = FINESSE_DEMO_CLIENTS[i]
    const existing = await db.cliente.findFirst({
      where: { workspaceId, email: data.email },
    })
    if (existing) {
      console.log(`  [skip] Cliente ${data.nombre} (${data.email}) already exists`)
      continue
    }
    await db.cliente.create({
      data: {
        nombre: data.nombre,
        email: data.email,
        telefono: data.telefono,
        empresa: data.empresa,
        tipo: data.tipo,
        estado: data.estado,
        notas: data.notas,
        workspaceId,
      },
    })
    createdData.clientes++
    console.log(`  [create] Cliente: ${data.nombre}`)
  }

  // Create contacts (one per client)
  const clientes = await db.cliente.findMany({
    where: { workspaceId, email: { in: FINESSE_DEMO_CLIENTS.map((c) => c.email) } },
    select: { id: true, nombre: true, email: true },
  })

  for (const cliente of clientes) {
    const existing = await db.contact.findFirst({
      where: { workspaceId, email: cliente.email },
    })
    if (existing) {
      console.log(`  [skip] Contact ${cliente.nombre} already exists`)
      continue
    }
    await db.contact.create({
      data: {
        nombre: cliente.nombre,
        email: cliente.email,
        telefono: FINESSE_DEMO_CLIENTS.find((c) => c.email === cliente.email)?.telefono || null,
        workspaceId,
        clienteId: cliente.id,
      },
    })
    createdData.contactos++
    console.log(`  [create] Contact: ${cliente.nombre}`)
  }

  // Create events
  for (const eventData of FINESSE_DEMO_EVENTS) {
    const cliente = clientes[eventData.clientIndex]
    if (!cliente) continue

    const fechaInicio = getRelativeDate(eventData.daysOffset, eventData.hora, eventData.minuto)
    const fechaFin = new Date(fechaInicio.getTime() + eventData.duracionMinutos * 60000)

    const existing = await db.evento.findFirst({
      where: { workspaceId, titulo: eventData.titulo, clienteId: cliente.id },
    })
    if (existing) {
      console.log(`  [skip] Evento ${eventData.titulo} para ${cliente.nombre}`)
      continue
    }

    await db.evento.create({
      data: {
        titulo: eventData.titulo,
        fechaInicio,
        fechaFin,
        tipo: "reunion",
        workspaceId,
        clienteId: cliente.id,
      },
    })
    createdData.eventos++
    console.log(`  [create] Evento: ${eventData.titulo}`)
  }

  // Create conversations and messages
  for (const convData of FINESSE_DEMO_CONVERSATIONS) {
    const cliente = clientes[convData.clientIndex]
    if (!cliente) continue

    // Get or create contact for this client
    const contact = await db.contact.findFirst({
      where: { workspaceId, clienteId: cliente.id },
    })
    if (!contact) {
      console.log(`  [skip] No contact for cliente ${cliente.nombre}`)
      continue
    }

    const existing = await db.conversation.findFirst({
      where: { workspaceId, contactId: contact.id, subject: convData.subject },
    })
    if (existing) {
      console.log(`  [skip] Conversation "${convData.subject}" already exists`)
      continue
    }

    // Create conversation
    const conversation = await db.conversation.create({
      data: {
        subject: convData.subject,
        contactId: contact.id,
        workspaceId,
        channel: "manual",
        status: "new",
        messageCount: convData.messages.length,
      },
    })
    createdData.conversaciones++

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

    // Update conversation with message count and last message time
    await db.conversation.update({
      where: { id: conversation.id },
      data: {
        messageCount: convData.messages.length,
        lastMessageAt,
      },
    })

    console.log(`  [create] Conversation: "${convData.subject}" (${convData.messages.length} messages)`)
  }

  // Create invoices
  for (let i = 0; i < FINESSE_DEMO_INVOICES.length; i++) {
    const invData = FINESSE_DEMO_INVOICES[i]
    const cliente = clientes[invData.clientIndex]
    if (!cliente) continue

    const numero = generateDemoInvoiceNumber(workspaceId, i + 1)
    const existing = await db.factura.findFirst({
      where: { numero },
    })
    if (existing) {
      console.log(`  [skip] Invoice ${numero} already exists`)
      continue
    }

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
        clienteId: cliente.id,
        workspaceId,
      },
    })
    createdData.facturas++
    console.log(`  [create] Factura: ${numero}`)
  }

  // Create content pieces
  for (const contentData of FINESSE_DEMO_CONTENT_PIECES) {
    const existing = await db.contentPiece.findFirst({
      where: { workspaceId, titulo: contentData.titulo },
    })
    if (existing) {
      console.log(`  [skip] ContentPiece "${contentData.titulo}" already exists`)
      continue
    }

    let fechaPublicada: Date | null = null
    let fechaProgramada: Date | null = null
    if (contentData.estado === "published" && contentData.daysAgo) {
      fechaPublicada = getRelativeDate(-contentData.daysAgo)
    } else if (contentData.estado === "scheduled" && contentData.daysInFuture) {
      fechaProgramada = getRelativeDate(contentData.daysInFuture)
    }

    await db.contentPiece.create({
      data: {
        titulo: contentData.titulo,
        copy: contentData.copy,
        plataforma: contentData.plataforma,
        tipo: contentData.tipo,
        estado: contentData.estado,
        fechaPublicada,
        fechaProgramada,
        workspaceId,
      },
    })
    createdData.contentPieces++
    console.log(`  [create] ContentPiece: ${contentData.titulo}`)
  }

  // Mark workspace as demo
  let workspaceConfig: Record<string, any> = {}
  if (workspace.config) {
    try {
      workspaceConfig = JSON.parse(workspace.config)
    } catch {
      // Invalid JSON, start fresh
    }
  }
  workspaceConfig.demo = {
    enabled: true,
    type: "finesse-internal",
    ownerEmail: ownerEmail,
  }

  await db.workspace.update({
    where: { id: workspaceId },
    data: { config: JSON.stringify(workspaceConfig) },
  })

  console.log(`\n[seed] ✓ Demo data creation complete!`)
  console.log(`[seed] Summary:`)
  console.log(`  - Clientes: ${createdData.clientes}`)
  console.log(`  - Contactos: ${createdData.contactos}`)
  console.log(`  - Eventos: ${createdData.eventos}`)
  console.log(`  - Conversaciones: ${createdData.conversaciones}`)
  console.log(`  - Mensajes: ${createdData.mensajes}`)
  console.log(`  - Facturas: ${createdData.facturas}`)
  console.log(`  - ContentPieces: ${createdData.contentPieces}`)
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
