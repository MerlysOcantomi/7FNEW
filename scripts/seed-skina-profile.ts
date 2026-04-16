import "dotenv/config"
import { PrismaLibSql } from "@prisma/adapter-libsql"
import { PrismaClient } from "../generated/prisma/client"

const dbUrl = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL
if (!dbUrl) throw new Error("DATABASE_URL or TURSO_DATABASE_URL must be set")

const adapter = new PrismaLibSql({
  url: dbUrl,
  authToken: process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN,
})
const db = new PrismaClient({ adapter })

const SKINA_BUSINESS_PROFILE = {
  businessName: "Skina Studio",
  businessDescription:
    "Estudio de diseño web, branding y desarrollo digital. Creamos experiencias digitales que conectan marcas con personas.",
  services: [
    "Diseño web",
    "Branding e identidad visual",
    "Desarrollo de aplicaciones web",
    "Consultoría digital",
    "UI/UX Design",
  ],
  tone: "profesional, cercano y directo",
  languages: ["español", "inglés"],
  region: "ES",
  workingHours: "Lun-Vie 9:00-18:00 CET",
}

async function main() {
  const workspaces = await db.workspace.findMany({
    select: { id: true, nombre: true, slug: true, config: true },
  })

  if (workspaces.length === 0) {
    console.error("No workspaces found. Run the main seed first.")
    process.exit(1)
  }

  console.log(`Found ${workspaces.length} workspace(s):`)
  for (const ws of workspaces) {
    console.log(`  - ${ws.nombre} (${ws.slug}) [${ws.id}]`)
  }

  const target = workspaces[0]
  console.log(`\nUpdating workspace: ${target.nombre} (${target.id})`)

  let currentConfig: Record<string, unknown> = {}
  if (target.config) {
    try {
      currentConfig = JSON.parse(target.config)
    } catch {
      console.warn("Could not parse existing config, starting fresh")
    }
  }

  const updatedConfig = {
    ...currentConfig,
    businessProfile: SKINA_BUSINESS_PROFILE,
  }

  await db.workspace.update({
    where: { id: target.id },
    data: { config: JSON.stringify(updatedConfig) },
  })

  console.log("\nBusinessProfile set:")
  console.log(JSON.stringify(SKINA_BUSINESS_PROFILE, null, 2))

  const verify = await db.workspace.findUnique({
    where: { id: target.id },
    select: { config: true },
  })
  const parsed = JSON.parse(verify!.config!)
  console.log("\nVerification — stored businessProfile:")
  console.log(JSON.stringify(parsed.businessProfile, null, 2))

  console.log("\nDone.")
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e)
    db.$disconnect()
    process.exit(1)
  })
