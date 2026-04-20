import "dotenv/config"
import { createClient } from "@libsql/client"

const dbUrl = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL
const dbToken = process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN

if (!dbUrl || !dbUrl.startsWith("libsql://")) {
  console.error("TURSO_DATABASE_URL no configurada. Agrega al .env:")
  console.error('TURSO_DATABASE_URL="libsql://..."')
  console.error('TURSO_AUTH_TOKEN="..."')
  process.exit(1)
}

const client = createClient({
  url: dbUrl,
  authToken: dbToken,
})

const tables = [
  `CREATE TABLE IF NOT EXISTS "Cliente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customId" TEXT,
    "nombre" TEXT NOT NULL,
    "email" TEXT,
    "telefono" TEXT,
    "empresa" TEXT,
    "tipo" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "notas" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "Proyecto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customId" TEXT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'planificacion',
    "prioridad" TEXT NOT NULL DEFAULT 'media',
    "progreso" INTEGER NOT NULL DEFAULT 0,
    "presupuesto" REAL,
    "fechaInicio" DATETIME,
    "fechaFin" DATETIME,
    "estimatedDelivery" DATETIME,
    "actualDelivery" DATETIME,
    "tags" TEXT,
    "internalNotes" TEXT,
    "assignedTo" TEXT,
    "clienteId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Proyecto_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Tarea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "prioridad" TEXT NOT NULL DEFAULT 'media',
    "fechaLimite" DATETIME,
    "completedAt" DATETIME,
    "proyectoId" TEXT,
    "clienteId" TEXT,
    "usuarioId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Tarea_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Tarea_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Tarea_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Transaccion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipo" TEXT NOT NULL,
    "monto" REAL NOT NULL,
    "descripcion" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL,
    "clienteId" TEXT,
    "proyectoId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transaccion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaccion_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Factura" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "numero" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "subtotal" REAL NOT NULL DEFAULT 0,
    "impuesto" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "items" TEXT,
    "fechaEmision" DATETIME,
    "fechaVencimiento" DATETIME,
    "paidAt" DATETIME,
    "clienteId" TEXT,
    "proyectoId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Factura_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Factura_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Documento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'documento',
    "url" TEXT,
    "tamano" INTEGER,
    "clienteId" TEXT,
    "proyectoId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Documento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Documento_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Evento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'reunion',
    "fechaInicio" DATETIME NOT NULL,
    "fechaFin" DATETIME,
    "todoElDia" BOOLEAN NOT NULL DEFAULT false,
    "clienteId" TEXT,
    "proyectoId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Evento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Evento_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Nota" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "contenido" TEXT,
    "clienteId" TEXT,
    "proyectoId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Nota_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Nota_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "rol" TEXT NOT NULL DEFAULT 'miembro',
    "departamento" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "Automatizacion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "trigger" TEXT NOT NULL,
    "condiciones" TEXT,
    "acciones" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'activa',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "nombre" TEXT,
    "avatar" TEXT,
    "googleId" TEXT,
    "lastLogin" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "AllowedEmail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "module" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "userEmail" TEXT,
    "data" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "InboxEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "mensaje" TEXT NOT NULL,
    "fuente" TEXT NOT NULL DEFAULT 'manual',
    "tipo" TEXT NOT NULL DEFAULT 'consulta',
    "categoria" TEXT,
    "urgencia" TEXT NOT NULL DEFAULT 'media',
    "intencion" TEXT,
    "resumen" TEXT,
    "datosCliente" TEXT,
    "datosProyecto" TEXT,
    "notas" TEXT,
    "tags" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'nuevo',
    "aiRaw" TEXT,
    "clienteId" TEXT,
    "proyectoId" TEXT,
    "tareaId" TEXT,
    "archivedAt" DATETIME,
    "processedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "empresa" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'visitante',
    "canal" TEXT NOT NULL DEFAULT 'manual',
    "source" TEXT,
    "leadScore" INTEGER,
    "metadata" TEXT,
    "notas" TEXT,
    "clienteId" TEXT,
    "workspaceId" TEXT NOT NULL,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'manual',
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "subject" TEXT,
    "summary" TEXT,
    "intent" TEXT,
    "sector" TEXT,
    "leadScore" INTEGER,
    "urgency" TEXT NOT NULL DEFAULT 'media',
    "sentiment" TEXT,
    "assignedTo" TEXT,
    "clienteId" TEXT,
    "proyectoId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "lastMessageAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "closedAt" DATETIME,
    "workspaceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'inbound',
    "content" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'text',
    "metadata" TEXT,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "sourceMessageId" TEXT,
    "workspaceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "ConversationAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'suggested',
    "source" TEXT NOT NULL DEFAULT 'system',
    "confidence" REAL,
    "sourceMessageId" TEXT,
    "data" TEXT,
    "resultId" TEXT,
    "resultModule" TEXT,
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "dismissedAt" DATETIME,
    "executionNotes" TEXT,
    "errorMessage" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "workspaceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "AIClassification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "intent" TEXT,
    "sector" TEXT,
    "urgency" TEXT,
    "leadScore" INTEGER,
    "sentiment" TEXT,
    "summary" TEXT,
    "suggestedTags" TEXT,
    "briefData" TEXT,
    "facts" TEXT,
    "pendingItems" TEXT,
    "risks" TEXT,
    "nextBestAction" TEXT,
    "confidence" REAL,
    "model" TEXT,
    "promptVersion" TEXT,
    "pipelineVersion" TEXT,
    "scoreReasoning" TEXT,
    "lastProcessedMessageId" TEXT,
    "lastProcessedAt" DATETIME,
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "sourceConversationId" TEXT,
    "workspaceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "ConversationHandoff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'generated',
    "headline" TEXT,
    "summary" TEXT,
    "facts" TEXT,
    "decisions" TEXT,
    "pendingItems" TEXT,
    "risks" TEXT,
    "nextRecommendedAction" TEXT,
    "sourceMessageId" TEXT,
    "confidence" REAL,
    "model" TEXT,
    "promptVersion" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "workspaceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "ConversationDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'ghost_reply',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "title" TEXT,
    "content" TEXT NOT NULL,
    "tone" TEXT,
    "targetChannel" TEXT,
    "sourceMessageId" TEXT,
    "generatedFrom" TEXT,
    "model" TEXT,
    "promptVersion" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "workspaceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "tamano" INTEGER NOT NULL,
    "module" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "ocrText" TEXT,
    "scanStatus" TEXT NOT NULL DEFAULT 'pending',
    "scanResult" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "QRCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "module" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "imageData" TEXT NOT NULL,
    "label" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "ClientProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clienteId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClientProject_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "ClientInvoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clienteId" TEXT NOT NULL,
    "monto" REAL NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "qrCodeUrl" TEXT,
    "paymentUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientInvoice_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "ClientFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clienteId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamano" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientFile_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'idea',
    "marca" TEXT NOT NULL DEFAULT 'general',
    "fechaInicio" DATETIME,
    "fechaFin" DATETIME,
    "presupuesto" REAL,
    "objetivos" TEXT,
    "clienteId" TEXT,
    "proyectoId" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "allowedUsers" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Campaign_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Campaign_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "ContentPiece" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "copy" TEXT,
    "plataforma" TEXT NOT NULL DEFAULT 'instagram',
    "tipo" TEXT NOT NULL DEFAULT 'post',
    "estado" TEXT NOT NULL DEFAULT 'idea',
    "fechaProgramada" DATETIME,
    "fechaPublicada" DATETIME,
    "hashtags" TEXT,
    "mediaUrl" TEXT,
    "mediaType" TEXT,
    "enlace" TEXT,
    "notas" TEXT,
    "responsable" TEXT,
    "prioridad" TEXT NOT NULL DEFAULT 'media',
    "campaignId" TEXT,
    "clienteId" TEXT,
    "proyectoId" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContentPiece_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "ContentIdea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "categoria" TEXT,
    "plataforma" TEXT,
    "tags" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'nueva',
    "fuente" TEXT NOT NULL DEFAULT 'manual',
    "clienteId" TEXT,
    "proyectoId" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "ClientAuth" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "lastLogin" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClientAuth_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "ConversationRead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversationRead_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConversationRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "ChannelConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "channelType" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" TEXT,
    "credentials" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "externalAccountId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "syncState" TEXT,
    "lastSyncAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChannelConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
]

const uniqueIndexes = [
  `CREATE UNIQUE INDEX IF NOT EXISTS "ClientAuth_email_key" ON "ClientAuth"("email")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ClientAuth_clienteId_key" ON "ClientAuth"("clienteId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Factura_numero_key" ON "Factura"("numero")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Usuario_email_key" ON "Usuario"("email")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_googleId_key" ON "User"("googleId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "AllowedEmail_email_key" ON "AllowedEmail"("email")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "AIClassification_conversationId_key" ON "AIClassification"("conversationId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ConversationHandoff_conversationId_key" ON "ConversationHandoff"("conversationId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ConversationRead_conversationId_userId_key" ON "ConversationRead"("conversationId", "userId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ChannelConnection_workspaceId_externalAccountId_key" ON "ChannelConnection"("workspaceId", "externalAccountId")`,
  `CREATE INDEX IF NOT EXISTS "ChannelConnection_workspaceId_channelType_idx" ON "ChannelConnection"("workspaceId", "channelType")`,
  `CREATE INDEX IF NOT EXISTS "ChannelConnection_workspaceId_status_idx" ON "ChannelConnection"("workspaceId", "status")`,
]

async function main() {
  console.log("Conectando a Turso...")
  console.log("URL:", process.env.TURSO_DATABASE_URL)

  for (const sql of tables) {
    const name = sql.match(/"(\w+)"/)?.[1] ?? "?"
    try {
      await client.execute(sql)
      console.log(`  Tabla ${name} OK`)
    } catch (err) {
      console.error(`  Error en ${name}:`, err)
    }
  }

  for (const sql of uniqueIndexes) {
    const name = sql.match(/\"(\w+)\"/)?.[1] ?? "?"
    try {
      await client.execute(sql)
      console.log(`  Index ${name} OK`)
    } catch (err) {
      console.error(`  Error en index ${name}:`, err)
    }
  }

  const alterColumns = [
    `ALTER TABLE "Cliente" ADD COLUMN "customId" TEXT`,
    `ALTER TABLE "Cliente" ADD COLUMN "preferredPaymentMethod" TEXT`,
    `ALTER TABLE "Cliente" ADD COLUMN "currency" TEXT`,
    `ALTER TABLE "Proyecto" ADD COLUMN "customId" TEXT`,
    `ALTER TABLE "Proyecto" ADD COLUMN "estimatedDelivery" DATETIME`,
    `ALTER TABLE "Proyecto" ADD COLUMN "actualDelivery" DATETIME`,
    `ALTER TABLE "Proyecto" ADD COLUMN "tags" TEXT`,
    `ALTER TABLE "Proyecto" ADD COLUMN "internalNotes" TEXT`,
    `ALTER TABLE "Proyecto" ADD COLUMN "assignedTo" TEXT`,
    `ALTER TABLE "Proyecto" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'public'`,
    `ALTER TABLE "Proyecto" ADD COLUMN "allowedUsers" TEXT`,
    `ALTER TABLE "Proyecto" ADD COLUMN "createdBy" TEXT`,
    `ALTER TABLE "User" ADD COLUMN "isPrivate" BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE "User" ADD COLUMN "visibleProjects" TEXT`,
    `ALTER TABLE "InboxEntry" ADD COLUMN "contactId" TEXT`,
    `ALTER TABLE "InboxEntry" ADD COLUMN "conversationId" TEXT`,
    `ALTER TABLE "AIClassification" ADD COLUMN "facts" TEXT`,
    `ALTER TABLE "AIClassification" ADD COLUMN "pendingItems" TEXT`,
    `ALTER TABLE "AIClassification" ADD COLUMN "risks" TEXT`,
    `ALTER TABLE "AIClassification" ADD COLUMN "nextBestAction" TEXT`,
    `ALTER TABLE "AIClassification" ADD COLUMN "pipelineVersion" TEXT`,
    `ALTER TABLE "AIClassification" ADD COLUMN "scoreReasoning" TEXT`,
    `ALTER TABLE "AIClassification" ADD COLUMN "lastProcessedMessageId" TEXT`,
    `ALTER TABLE "AIClassification" ADD COLUMN "lastProcessedAt" DATETIME`,
    `ALTER TABLE "ConversationAction" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'system'`,
    `ALTER TABLE "ConversationAction" ADD COLUMN "confidence" REAL`,
    `ALTER TABLE "ConversationAction" ADD COLUMN "sourceMessageId" TEXT`,
    `ALTER TABLE "ConversationAction" ADD COLUMN "approvedBy" TEXT`,
    `ALTER TABLE "ConversationAction" ADD COLUMN "approvedAt" DATETIME`,
    `ALTER TABLE "ConversationAction" ADD COLUMN "dismissedAt" DATETIME`,
    `ALTER TABLE "ConversationAction" ADD COLUMN "executionNotes" TEXT`,
    `ALTER TABLE "ConversationAction" ADD COLUMN "errorMessage" TEXT`,
    `ALTER TABLE "Conversation" ADD COLUMN "detectedLanguage" TEXT`,
    `ALTER TABLE "InboxEntry" ADD COLUMN "workspaceId" TEXT`,
    `ALTER TABLE "Notification" ADD COLUMN "workspaceId" TEXT`,
    `ALTER TABLE "Conversation" ADD COLUMN "connectionId" TEXT`,
    `ALTER TABLE "Message" ADD COLUMN "connectionId" TEXT`,
  ]

  console.log("\nAgregando columnas nuevas (si no existen)...")
  for (const sql of alterColumns) {
    const col = sql.match(/"(\w+)" ADD COLUMN "(\w+)"/)?.[0] ?? "?"
    try {
      await client.execute(sql)
      console.log(`  ALTER ${col} OK`)
    } catch (err: any) {
      if (err?.message?.includes("duplicate column") || err?.message?.includes("already exists")) {
        console.log(`  ALTER ${col} — ya existe, skip`)
      } else {
        console.error(`  ALTER ${col} error:`, err?.message)
      }
    }
  }

  console.log("\nSchema pusheado a Turso correctamente")
  client.close()
}

main().catch(console.error)
