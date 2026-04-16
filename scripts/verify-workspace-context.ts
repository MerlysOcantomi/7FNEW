import "dotenv/config"
import { PrismaLibSql } from "@prisma/adapter-libsql"
import { PrismaClient } from "../generated/prisma/client"

const dbUrl = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL
if (!dbUrl) throw new Error("DATABASE_URL or TURSO_DATABASE_URL must be set")

const adapter = new PrismaLibSql({
  url: dbUrl,
  authToken: process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN,
})

// Inject the Prisma client so the resolver can find it
const prisma = new PrismaClient({ adapter })

// We need to override the db import used by the resolver.
// Instead, we replicate the resolver logic here for verification.
import { parseJsonConfig, mergeConfigs, type WorkspaceBusinessProfile } from "../core/verticals"

async function main() {
  const workspaces = await prisma.workspace.findMany({
    select: { id: true, nombre: true, slug: true, verticalKey: true, config: true },
  })

  for (const ws of workspaces) {
    console.log(`\n=== ${ws.nombre} (${ws.slug}) ===`)

    const vertical = await prisma.vertical.findUnique({ where: { key: ws.verticalKey } })
    const defaults = parseJsonConfig(vertical?.defaultConfig)
    const overrides = parseJsonConfig(ws.config)
    const resolved = mergeConfigs(defaults, overrides)
    const profile: WorkspaceBusinessProfile = resolved.businessProfile ?? {}

    const hasProfile = Object.keys(profile).length > 0
    console.log(`Has businessProfile: ${hasProfile}`)

    if (!hasProfile) {
      console.log("(no context block will be injected)")
      continue
    }

    // Build context block manually (same logic as buildWorkspaceContextBlock)
    const ctx = {
      identity: {
        name: profile.businessName || ws.nombre,
        description: profile.businessDescription || null,
        vertical: ws.verticalKey,
        verticalName: vertical?.name || null,
        region: profile.region || null,
        languages: profile.languages ?? [],
        tone: profile.tone || null,
        workingHours: profile.workingHours || null,
      },
      services: profile.services ?? [],
      attentionRules: profile.attentionRules ?? [],
    }

    const lines: string[] = []
    lines.push(`- Empresa: ${ctx.identity.name}`)
    if (ctx.identity.description) lines.push(`- Descripción: ${ctx.identity.description}`)
    if (ctx.identity.verticalName) lines.push(`- Vertical: ${ctx.identity.verticalName}`)
    if (ctx.identity.region) lines.push(`- Región: ${ctx.identity.region}`)
    if (ctx.identity.languages.length > 0) lines.push(`- Idiomas: ${ctx.identity.languages.join(", ")}`)
    if (ctx.services.length > 0) lines.push(`- Servicios: ${ctx.services.slice(0, 15).join(", ")}`)
    if (ctx.identity.tone) lines.push(`- Tono: ${ctx.identity.tone}`)
    if (ctx.identity.workingHours) lines.push(`- Horario: ${ctx.identity.workingHours}`)
    if (ctx.attentionRules.length > 0) {
      lines.push(`- Reglas de atención:`)
      for (const rule of ctx.attentionRules.slice(0, 10)) {
        lines.push(`  · ${rule}`)
      }
    }

    const block = `WORKSPACE (quién eres como empresa):\n${lines.join("\n")}`
    console.log(`\nContext block that Fanny would receive:\n`)
    console.log(block)
    console.log(`\nEstimated tokens: ~${Math.ceil(block.length / 4)}`)
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
