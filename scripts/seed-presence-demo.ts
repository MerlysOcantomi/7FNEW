/**
 * Sevenef Presence — controlled demo seeder (PRESENCE-03).
 *
 * Creates ONE safe, self-contained demo: a workspace with a rich Business
 * Profile + service catalog + a WhatsApp channel, and a PUBLISHED PresenceSite
 * on the `business-site-standard` template so the public renderer can be
 * exercised end to end at `/sites/demo-studio`.
 *
 * Safety & conventions:
 *   - NO real client data. All content is neutral placeholder demo data; the
 *     gallery images are inline SVG data-URIs (not stock photos, not real work
 *     samples). The phone is a documentation-style number.
 *   - Marked with `Workspace.config.demo = true` (the repo's demo convention).
 *   - Idempotent: re-running upserts by slug and never duplicates rows.
 *   - Cleanable: `clean` deletes the demo workspace (cascade removes site,
 *     media, domain, publication, subscription, channels).
 *   - NEVER auto-runs. It is a manual script, never imported by the app, and the
 *     mutating modes require an explicit confirmation env var so it cannot run
 *     by accident in production.
 *
 * Usage:
 *   npx tsx scripts/seed-presence-demo.ts status
 *   PRESENCE_DEMO_CONFIRM=SEED  npx tsx scripts/seed-presence-demo.ts seed
 *   PRESENCE_DEMO_CONFIRM=CLEAN npx tsx scripts/seed-presence-demo.ts clean
 */

import "dotenv/config"
import { db } from "@core/db"
import { getOrCreateSiteForWorkspace, publishSite, recordMedia } from "@engines/presence/repository"

const WORKSPACE_SLUG = "presence-demo"
const SITE_SLUG = "demo-studio"
const WA_NUMBER = "+34 600 000 000" // documentation-style demo number

const DEMO_CONFIG = {
  demo: true,
  presenceDemo: true,
  businessProfile: {
    businessName: "Estudio Aurora",
    businessDescription: "A calm, modern studio for everyday self-care in the heart of the city.",
    workingHours: "Mon–Fri 9:00–19:00\nSat 10:00–14:00",
    region: "Madrid, Spain",
  },
  serviceCatalog: [
    { id: "svc-consultation", name: "Consultation", category: "General", active: true },
    { id: "svc-signature", name: "Signature Treatment", category: "Care", active: true },
    { id: "svc-express", name: "Express Session", category: "Care", active: true },
    { id: "svc-legacy", name: "Retired Service", category: "General", active: false },
  ],
}

/** A tiny inline placeholder tile (NOT a photo of real work). */
function demoTile(label: string, from: string, to: string): string {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='800'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/></linearGradient></defs>` +
    `<rect width='800' height='800' fill='url(#g)'/>` +
    `<text x='50%' y='50%' fill='#ffffff' font-family='sans-serif' font-size='42' text-anchor='middle' opacity='0.85'>${label}</text>` +
    `</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const DEMO_MEDIA = [
  { storageKey: "presence-demo/tile-1.svg", url: demoTile("Studio", "#b08968", "#7f5539"), purpose: "gallery" },
  { storageKey: "presence-demo/tile-2.svg", url: demoTile("Detail", "#9c6644", "#582f0e"), purpose: "gallery" },
]

async function findDemoWorkspace() {
  return db.workspace.findUnique({ where: { slug: WORKSPACE_SLUG } })
}

async function seed() {
  if (process.env.PRESENCE_DEMO_CONFIRM !== "SEED") {
    console.error("Refusing to seed: set PRESENCE_DEMO_CONFIRM=SEED to confirm.")
    process.exit(1)
  }

  const ws = await db.workspace.upsert({
    where: { slug: WORKSPACE_SLUG },
    create: { nombre: "Estudio Aurora (Presence demo)", slug: WORKSPACE_SLUG, plan: "enterprise", config: JSON.stringify(DEMO_CONFIG) },
    update: { config: JSON.stringify(DEMO_CONFIG), plan: "enterprise" },
  })
  console.log(`workspace: ${ws.id} (${ws.slug})`)

  // WhatsApp channel (keyed by [workspaceId, externalAccountId]).
  const waAddress = WA_NUMBER
  const existingWa = await db.channelConnection.findFirst({ where: { workspaceId: ws.id, externalAccountId: waAddress } })
  if (!existingWa) {
    await db.channelConnection.create({
      data: { workspaceId: ws.id, channelType: "whatsapp", provider: "meta", name: "WhatsApp (demo)", externalAccountId: waAddress, status: "connected" },
    })
  }

  const site = await getOrCreateSiteForWorkspace(ws.id, { slug: SITE_SLUG })
  await db.presenceSite.update({
    where: { id: site.id },
    data: { templateId: "business-site-standard", templateVersion: "0.1.0", themeKey: "rose-nude" },
  })

  // Media: reset demo tiles idempotently, then recreate as approved gallery.
  await db.presenceMedia.deleteMany({ where: { workspaceId: ws.id, storageKey: { startsWith: "presence-demo/" } } })
  for (const m of DEMO_MEDIA) {
    await recordMedia(ws.id, { siteId: site.id, kind: "photo", purpose: m.purpose, storageKey: m.storageKey, url: m.url, width: 800, height: 800, reviewStatus: "use" })
  }

  const fresh = await db.presenceSite.findUnique({ where: { id: site.id } })
  if (fresh && fresh.status !== "published") {
    await publishSite(ws.id, site.id, "demo_publish")
  }

  console.log(`site: ${site.id} slug=${SITE_SLUG} status=published`)
  console.log(`\nResolvable at: /sites/${SITE_SLUG}`)
}

async function clean() {
  if (process.env.PRESENCE_DEMO_CONFIRM !== "CLEAN") {
    console.error("Refusing to clean: set PRESENCE_DEMO_CONFIRM=CLEAN to confirm.")
    process.exit(1)
  }
  const ws = await findDemoWorkspace()
  if (!ws) {
    console.log("No demo workspace present. Nothing to clean.")
    return
  }
  await db.workspace.delete({ where: { id: ws.id } }) // cascade removes all Presence rows
  console.log(`Deleted demo workspace ${ws.id} (${ws.slug}) and all cascaded Presence rows.`)
}

async function status() {
  const ws = await findDemoWorkspace()
  if (!ws) {
    console.log("demo workspace: ABSENT")
    return
  }
  const site = await db.presenceSite.findUnique({ where: { workspaceId: ws.id } })
  const media = await db.presenceMedia.count({ where: { workspaceId: ws.id } })
  console.log(`demo workspace: ${ws.id} (${ws.slug})`)
  console.log(`site: ${site ? `${site.slug} status=${site.status} template=${site.templateId}@${site.templateVersion} theme=${site.themeKey}` : "ABSENT"}`)
  console.log(`media rows: ${media}`)
}

async function main() {
  const mode = process.argv[2] ?? "status"
  if (mode === "seed") await seed()
  else if (mode === "clean") await clean()
  else if (mode === "status") await status()
  else {
    console.error(`Unknown mode "${mode}". Use: status | seed | clean`)
    process.exit(1)
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("presence-demo error:", e instanceof Error ? e.message : e)
    process.exit(1)
  })
