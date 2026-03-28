/**
 * Core personalization types.
 *
 * These types define the canonical vocabulary contract for visible
 * business language across the product. Internal IDs (routes, Prisma
 * models, API params) are NOT affected by this layer.
 */

export interface EntityLabel {
  singular: string
  plural: string
}

export type EntityKey =
  | "client"
  | "project"
  | "task"
  | "invoice"
  | "document"
  | "campaign"
  | "department"
  | "member"
  | "inbox"
  | "finance"
  | "billing"
  | "marketing"
  | "calendar"
  | "automation"

export type EntityVocabulary = Record<EntityKey, EntityLabel>

export type BusinessType =
  | "default"
  | "school"
  | "clinic"
  | "creator"
  | "service"

export type VocabularyOverrides = Partial<Record<EntityKey, Partial<EntityLabel>>>
