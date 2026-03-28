/**
 * Persistent snapshot store for Forte workspace analysis.
 *
 * Stores the latest structured business analysis per workspace.
 * This is memory, not analytics — one workspace, one latest snapshot.
 *
 * Payload is serialized as JSON in a String field following repo conventions.
 */

import { db } from "@core/db"
import type { DomainState } from "./domain-types"
import type { GuidedRecommendationTarget } from "./recommendation-routing"
import type { WorkspaceMaturity } from "./improvements-loader"

// ── Snapshot shape ────────────────────────────────────────────────────────────

export interface ForteAnalysisSnapshot {
  workspaceId: string
  analyzedAt: string
  maturity: WorkspaceMaturity
  domains: DomainState[]
  topPriorities: GuidedRecommendationTarget[]
  recommendedNextMove: GuidedRecommendationTarget | null
  version: number
}

const CURRENT_VERSION = 1

// ── Serialization helpers ─────────────────────────────────────────────────────

interface SnapshotPayload {
  domains: DomainState[]
  topPriorities: GuidedRecommendationTarget[]
  recommendedNextMove: GuidedRecommendationTarget | null
}

function serializePayload(p: SnapshotPayload): string {
  return JSON.stringify(p)
}

function deserializePayload(raw: string): SnapshotPayload {
  return JSON.parse(raw) as SnapshotPayload
}

// ── Store operations ──────────────────────────────────────────────────────────

export async function upsertForteSnapshot(
  snapshot: Omit<ForteAnalysisSnapshot, "analyzedAt" | "version">,
): Promise<void> {
  const payload = serializePayload({
    domains: snapshot.domains,
    topPriorities: snapshot.topPriorities,
    recommendedNextMove: snapshot.recommendedNextMove,
  })

  await db.forteSnapshot.upsert({
    where: { workspaceId: snapshot.workspaceId },
    create: {
      workspaceId: snapshot.workspaceId,
      maturity: snapshot.maturity,
      payload,
      version: CURRENT_VERSION,
      analyzedAt: new Date(),
    },
    update: {
      maturity: snapshot.maturity,
      payload,
      version: CURRENT_VERSION,
      analyzedAt: new Date(),
    },
  })
}

export async function getLatestForteSnapshot(
  workspaceId: string,
): Promise<ForteAnalysisSnapshot | null> {
  const row = await db.forteSnapshot.findUnique({
    where: { workspaceId },
  })

  if (!row) return null

  const parsed = deserializePayload(row.payload)

  return {
    workspaceId: row.workspaceId,
    analyzedAt: row.analyzedAt.toISOString(),
    maturity: row.maturity as WorkspaceMaturity,
    domains: parsed.domains,
    topPriorities: parsed.topPriorities,
    recommendedNextMove: parsed.recommendedNextMove,
    version: row.version,
  }
}

export async function deleteForteSnapshot(
  workspaceId: string,
): Promise<void> {
  await db.forteSnapshot.deleteMany({
    where: { workspaceId },
  })
}
