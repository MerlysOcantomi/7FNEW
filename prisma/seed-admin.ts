import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import { PrismaClient } from "../generated/prisma/client"

const adapter = new PrismaBetterSqlite3({ url: "file:./dev.db" })
const prisma = new PrismaClient({ adapter })

const ADMIN_EMAIL = process.argv[2]

async function main() {
  if (!ADMIN_EMAIL) {
    console.error("Uso: npx tsx prisma/seed-admin.ts correo@ejemplo.com")
    console.error("Ejemplo: npx tsx prisma/seed-admin.ts merlys@7f.com")
    process.exit(1)
  }

  const email = ADMIN_EMAIL.trim().toLowerCase()

  const existing = await prisma.allowedEmail.findUnique({ where: { email } })
  if (existing) {
    await prisma.allowedEmail.update({
      where: { email },
      data: { role: "admin" },
    })
    console.log(`✓ Email "${email}" actualizado a admin en AllowedEmail`)
  } else {
    await prisma.allowedEmail.create({
      data: { email, role: "admin" },
    })
    console.log(`✓ Email "${email}" agregado como admin en AllowedEmail`)
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (user) {
    await prisma.user.update({
      where: { email },
      data: { role: "admin" },
    })
    console.log(`✓ User "${email}" actualizado a admin`)
  }

  console.log("\nMerlys esta configurada como administradora.")
  console.log("Solo ella puede gestionar usuarios y permisos.")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
