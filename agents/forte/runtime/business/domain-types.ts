export type BusinessDomain =
  | "communication"
  | "relationship"
  | "delivery"
  | "marketing"
  | "content"
  | "finance"
  | "intelligence"

export type DomainLevel = "none" | "basic" | "intermediate" | "advanced"

export interface DomainState {
  domain: BusinessDomain
  level: DomainLevel
  strength: number

  supportingSignals: string[]
  supportingModules: string[]

  missingCapabilities: string[]

  notes?: string[]
}
