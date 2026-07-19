/**
 * DB orchestration for external identities (INBOX-DATA-04B). Thin layer over
 * the pure helpers in `identity-resolution.ts` — the pure-planner pattern
 * from docs/inbox-pipeline-testing.md.
 *
 * `recomputeExternalIdentityResolution` is THE ONLY code path allowed to
 * write `ExternalIdentity.resolutionStatus` / `primaryContactId`. Every
 * link mutation (confirm, reject, manual correction, merge, contact
 * deletion side-effects) must call it afterwards.
 */

import { db } from "@core/db"
import {
  buildIdentityDescriptor,
  hashIdentityValue,
  planContactForInbound,
  projectIdentityResolution,
  PROVISIONAL_LINK_SOURCE,
  type IdentityDescriptor,
  type IdentityLinkLike,
} from "./identity-resolution"

/**
 * Recompute and persist the resolution projection for one identity from its
 * CURRENT links. Idempotent: writes only when the projection changed.
 * Returns the projection.
 */
export async function recomputeExternalIdentityResolution(identityId: string) {
  const identity = await db.externalIdentity.findUnique({
    where: { id: identityId },
    select: { id: true, resolutionStatus: true, primaryContactId: true },
  })
  if (!identity) return null
  const links = await db.contactIdentityLink.findMany({
    where: { externalIdentityId: identityId },
    select: { contactId: true, status: true, source: true },
  })
  const projection = projectIdentityResolution(links as IdentityLinkLike[])
  if (
    projection.resolutionStatus !== identity.resolutionStatus ||
    projection.primaryContactId !== identity.primaryContactId
  ) {
    await db.externalIdentity.update({
      where: { id: identityId },
      data: {
        resolutionStatus: projection.resolutionStatus,
        primaryContactId: projection.primaryContactId,
      },
    })
  }
  return projection
}

export interface RecordInboundIdentityInput {
  workspaceId: string
  descriptor: IdentityDescriptor
  displayValue?: string | null
  /**
   * Contact the LEGACY ingestion path resolved for this message (dual-write
   * phase: the existing contact logic stays authoritative for conversation
   * attachment; identities record the association). Optional.
   */
  contactId?: string | null
  /** Extra metadata JSON fields to persist on first sight (no secrets). */
  metadata?: Record<string, unknown> | null
}

/**
 * Upsert an identity on its routing key and record the association evidence
 * for the contact the legacy path resolved:
 *   - identity with NO links + a contact → link `confirmed`/`ingestion`
 *     (deterministic single match, per design "exactly one match → link");
 *   - identity already linked to that same contact → refresh only;
 *   - identity confirmed for ANOTHER contact → add a `suggested` link
 *     (conflict evidence), NEVER relink; conflict reported with hashed
 *     value (no raw PII in logs).
 * Always recomputes the projection afterwards. Best-effort: failures here
 * must never block message ingestion (callers wrap in try/catch).
 */
export async function recordInboundIdentity(input: RecordInboundIdentityInput) {
  const { workspaceId, descriptor } = input
  const identity = await db.externalIdentity.upsert({
    where: {
      workspaceId_channel_provider_scopeKey_externalKey: {
        workspaceId,
        channel: descriptor.channel,
        provider: descriptor.provider,
        scopeKey: descriptor.scopeKey,
        externalKey: descriptor.externalKey,
      },
    },
    create: {
      workspaceId,
      channel: descriptor.channel,
      provider: descriptor.provider,
      scopeKey: descriptor.scopeKey,
      kind: descriptor.kind,
      externalKey: descriptor.externalKey,
      displayValue: input.displayValue ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
    update: {
      lastSeenAt: new Date(),
      ...(input.displayValue ? { displayValue: input.displayValue } : {}),
    },
    select: { id: true, resolutionStatus: true, primaryContactId: true },
  })

  if (input.contactId) {
    const existing = await db.contactIdentityLink.findUnique({
      where: {
        externalIdentityId_contactId: {
          externalIdentityId: identity.id,
          contactId: input.contactId,
        },
      },
      select: { id: true, status: true },
    })
    if (!existing) {
      const others = await db.contactIdentityLink.count({
        where: { externalIdentityId: identity.id, status: { not: "rejected" } },
      })
      const status = others === 0 ? "confirmed" : "suggested"
      await db.contactIdentityLink.create({
        data: {
          workspaceId,
          externalIdentityId: identity.id,
          contactId: input.contactId,
          status,
          source: "ingestion",
          ...(status === "confirmed" ? { confirmedAt: new Date() } : {}),
        },
      })
      if (status === "suggested") {
        // Conflict evidence — hashed value only, never raw PII.
        console.warn("[inbox:identity] conflicting association", {
          workspaceId,
          identityId: identity.id,
          valueHash: hashIdentityValue(descriptor.externalKey),
          contactId: input.contactId,
        })
      }
    }
  }

  const projection = await recomputeExternalIdentityResolution(identity.id)
  return { identityId: identity.id, projection }
}

/**
 * Resolve which contact should host an inbound message for an identity that
 * routing found (or just created). Applies `planContactForInbound`; creates
 * the provisional contact (ONE per identity, explicitly marked) when the
 * plan asks for it. Returns the contact id.
 */
export async function ensureContactForIdentity(options: {
  workspaceId: string
  identityId: string
  displayName?: string | null
}): Promise<string | null> {
  const identity = await db.externalIdentity.findUnique({
    where: { id: options.identityId },
    select: { id: true, resolutionStatus: true, primaryContactId: true, channel: true },
  })
  if (!identity || identity.id === undefined) return null
  const links = await db.contactIdentityLink.findMany({
    where: { externalIdentityId: identity.id },
    select: { contactId: true, status: true, source: true },
  })
  const plan = planContactForInbound(identity, links as IdentityLinkLike[])
  if (plan.action !== "create_provisional") return plan.contactId

  const contact = await db.contact.create({
    data: {
      workspaceId: options.workspaceId,
      nombre: options.displayName ?? null,
      canal: identity.channel,
      tipo: "visitante",
      // Explicit provisional marker — NOT conflated with the commercial
      // "visitante" tipo, which real visitor flows also use.
      metadata: JSON.stringify({ provisionalForIdentity: identity.id }),
    },
    select: { id: true },
  })
  await db.contactIdentityLink.create({
    data: {
      workspaceId: options.workspaceId,
      externalIdentityId: identity.id,
      contactId: contact.id,
      status: "suggested",
      source: PROVISIONAL_LINK_SOURCE,
    },
  })
  await recomputeExternalIdentityResolution(identity.id)
  return contact.id
}

export { buildIdentityDescriptor }
