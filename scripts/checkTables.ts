import "dotenv/config"
import { createClient } from "@libsql/client"

async function main() {
  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN
  const db = createClient({ url: url!, authToken })

  // SQLite can't ALTER COLUMN, so we recreate the tables with proper defaults
  const tablesNeedingFix = [
    "User", "Cliente", "Proyecto", "Tarea", "Transaccion",
    "Factura", "Documento", "Evento", "Nota", "Usuario",
    "Automatizacion", "InboxEntry",
  ]

  for (const table of tablesNeedingFix) {
    try {
      const info = await db.execute(`PRAGMA table_info(${table})`)
      const hasUpdatedAt = info.rows.some((r) => r.name === "updatedAt")
      if (!hasUpdatedAt) continue

      const col = info.rows.find((r) => r.name === "updatedAt")
      if (col && col.dflt_value === null) {
        // Drop and recreate is too risky, so just set existing NULLs
        await db.execute(`UPDATE ${table} SET updatedAt = CURRENT_TIMESTAMP WHERE updatedAt IS NULL`)
        console.log(`${table}: updatedAt NULLs fixed`)
      } else {
        console.log(`${table}: updatedAt OK`)
      }
    } catch (err) {
      console.log(`${table}: skip (${err})`)
    }
  }

  console.log("\nDone!")
}

main().catch(console.error)
