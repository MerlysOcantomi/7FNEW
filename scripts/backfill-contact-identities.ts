/**
 * INBOX-DATA-04B backfill 1/3 — ExternalIdentity + ContactIdentityLink from
 * existing Contact card values (email / telefono).
 *
 * Run: DATABASE_URL=... npx tsx scripts/backfill-contact-identities.ts
 *
 * Guarantees (approved design §8/§9):
 *   - per-workspace, batched, resumable (cursor by contact id);
 *   - idempotent: identities upsert on the routing key, links upsert on
 *     [externalIdentityId, contactId] — re-runs are no-ops;
 *   - NEVER auto-merges: several contacts sharing a value produce one
 *     identity with several confirmed links → the projection marks it
 *     ambiguous and the conflict is reported (hashed value, no raw PII);
 *   - never invents a phone country (conservative normalization).
 */

import { db } from "@core/db"
import {
  planIdentityBackfillForContact,
} from "@modules/inbox/backfill-planners"
import { hashIdentityValue } from "@modules/inbox/identity-resolution"
import { recomputeExternalIdentityResolution } from "@modules/inbox/identity-service"

const BATCH = 200

async function main() {
  const workspaces = await db.workspace.findMany({ select: { id: true } })
  let identitiesCreated = 0
  let linksCreated = 0
  let contactsSeen = 0
  const conflictReport: Array<{ workspaceId: string; valueHash: string; contacts: number }> = []

  for (const ws of workspaces) {
    let cursor: string | undefined
    for (;;) {
      const contacts = await db.contact.findMany({
        where: { workspaceId: ws.id },
        select: { id: true, email: true, telefono: true, nombre: true },
        orderBy: { id: "asc" },
        take: BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      })
      if (contacts.length === 0) break
      cursor = contacts[contacts.length - 1].id

      for (const contact of contacts) {
        contactsSeen += 1
        for (const plan of planIdentityBackfillForContact(contact)) {
          const { descriptor } = plan
          const identity = await db.externalIdentity.upsert({
            where: {
              workspaceId_channel_provider_scopeKey_externalKey: {
                workspaceId: ws.id,
                channel: descriptor.channel,
                provider: descriptor.provider,
                scopeKey: descriptor.scopeKey,
                externalKey: descriptor.externalKey,
              },
            },
            create: {
              workspaceId: ws.id,
              channel: descriptor.channel,
              provider: descriptor.provider,
              scopeKey: descriptor.scopeKey,
              kind: descriptor.kind,
              externalKey: descriptor.externalKey,
              displayValue: plan.displayValue,
              metadata: plan.metadata ? JSON.stringify(plan.metadata) : null,
            },
            update: {},
            select: { id: true, createdAt: true, updatedAt: true },
          })
          if (identity.createdAt.getTime() === identity.updatedAt.getTime()) identitiesCreated += 1

          const existingLink = await db.contactIdentityLink.findUnique({
            where: {
              externalIdentityId_contactId: {
                externalIdentityId: identity.id,
                contactId: contact.id,
              },
            },
            select: { id: true },
          })
          if (!existingLink) {
            /**
             * A contact card claiming its own value is a confirmed claim
             * (source "backfill"). When several contacts claim the same
             * value, several confirmed links exist and the projection marks
             * the identity ambiguous — by design, no auto-merge.
             */
            await db.contactIdentityLink.create({
              data: {
                workspaceId: ws.id,
                externalIdentityId: identity.id,
                contactId: contact.id,
                status: "confirmed",
                source: "backfill",
                confirmedAt: new Date(),
              },
            })
            linksCreated += 1
          }
          const projection = await recomputeExternalIdentityResolution(identity.id)
          if (projection?.resolutionStatus === "ambiguous") {
            const links = await db.contactIdentityLink.count({
              where: { externalIdentityId: identity.id, status: "confirmed" },
            })
            conflictReport.push({
              workspaceId: ws.id,
              valueHash: hashIdentityValue(descriptor.externalKey),
              contacts: links,
            })
          }
        }
      }
    }
  }

  // Deduplicate conflict entries (same identity reported once per touching contact).
  const conflicts = [...new Map(conflictReport.map((c) => [`${c.workspaceId}:${c.valueHash}`, c])).values()]

  console.warn("[backfill:identities] done", {
    workspaces: workspaces.length,
    contactsSeen,
    identitiesCreated,
    linksCreated,
    ambiguousIdentities: conflicts.length,
  })
  for (const conflict of conflicts) {
    console.warn("[backfill:identities] ambiguous shared value", conflict)
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[backfill:identities] FAILED:", err)
    process.exit(1)
  })
