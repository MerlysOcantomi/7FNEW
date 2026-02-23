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
]

const uniqueIndexes = [
  `CREATE UNIQUE INDEX IF NOT EXISTS "ClientAuth_email_key" ON "ClientAuth"("email")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ClientAuth_clienteId_key" ON "ClientAuth"("clienteId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Factura_numero_key" ON "Factura"("numero")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Usuario_email_key" ON "Usuario"("email")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_googleId_key" ON "User"("googleId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "AllowedEmail_email_key" ON "AllowedEmail"("email")`,
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
