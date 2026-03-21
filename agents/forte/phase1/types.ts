import type {
  ModuleComplexityLevelName,
  ModuleProgressionProfile,
} from "@core/registry"

export type ForteBusinessType =
  | "agency"
  | "consultancy"
  | "education"
  | "clinic"
  | "creator"
  | "professional-services"
  | "community"
  | "general"

export type ForteBusinessSize = "solo" | "small-team" | "growing" | "established"

export type ForteRelationshipModel =
  | "clients"
  | "students"
  | "patients"
  | "members"
  | "leads"
  | "buyers"

export interface ForteRecommendationNeeds {
  crm?: boolean
  smartInbox?: boolean
  portal?: boolean
  projectDelivery?: boolean
  taskManagement?: boolean
  invoicing?: boolean
  financeControl?: boolean
  documents?: boolean
  contentMarketing?: boolean
  campaigns?: boolean
  automations?: boolean
  documentAnalysis?: boolean
  aiAssistance?: boolean
}

export interface ForteRecommendationInput {
  businessName?: string
  businessType: ForteBusinessType
  industry?: string
  size?: ForteBusinessSize
  serves?: ForteRelationshipModel[]
  needs?: ForteRecommendationNeeds
  painPoints?: string[]
  notes?: string[]
}

export type ForteCatalogKind = "module" | "engine" | "tool"
export type ForteCatalogSource = "manifest" | "phase1-profile"
export type ForteConfidence = "low" | "medium" | "high"
export type FortePriority = "core" | "recommended" | "optional"

export interface ForteCatalogEntry {
  id: string
  kind: ForteCatalogKind
  namespace: string
  name: string
  description: string
  provides: string[]
  dependencies: string[]
  optional: boolean
  source: ForteCatalogSource
  businessValue: string
  useCases: string[]
  maturityNote?: string
  progression?: ModuleProgressionProfile
}

export interface ForteCatalogSnapshot {
  modules: ForteCatalogEntry[]
  engines: ForteCatalogEntry[]
  tools: ForteCatalogEntry[]
}

export interface ForteInterpretedBusiness {
  summary: string
  businessType: ForteBusinessType
  industry?: string
  size?: ForteBusinessSize
  serves: ForteRelationshipModel[]
  keyNeeds: string[]
  inferredSignals: string[]
  painPoints: string[]
}

export interface ForteRecommendationItem {
  id: string
  kind: ForteCatalogKind
  namespace: string
  name: string
  priority: FortePriority
  reason: string
  provides: string[]
  dependencies: string[]
  source: ForteCatalogSource
  optional: boolean
  recommendedLevel?: ModuleComplexityLevelName
  availableLevels?: ModuleComplexityLevelName[]
}

export interface ForteVerticalSuggestion {
  id: string
  label: string
  reason: string
  status: "future-opportunity" | "generalist-first"
}

export interface ForteRecommendationOutput {
  interpretedBusiness: ForteInterpretedBusiness
  recommendationBase: {
    profile: string
    summary: string
    confidence: ForteConfidence
  }
  modules: ForteRecommendationItem[]
  engines: ForteRecommendationItem[]
  tools: ForteRecommendationItem[]
  coveredCapabilities: string[]
  gaps: string[]
  explanation: {
    headline: string
    why: string[]
    businessValue: string[]
    dependencyNotes: string[]
  }
  suggestedVertical?: ForteVerticalSuggestion
}
