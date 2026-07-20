import type { AgentManifest } from "@core/registry"

/**
 * Freya — transversal creative agent (Mr Forte Lab). FOUNDATION manifest.
 *
 * Freya's capabilities are consumed by Sevenef Presence, Finesse, Growth,
 * Magazine and future verticals. For Presence she prepares site style proposals
 * and assesses photos. This manifest is registry/contract metadata only — the
 * runtime capabilities live behind the interchangeable providers in
 * `engines/presence/freya.ts`. Consistent with the roster honesty rule, Freya is
 * "coming online" (suggest-only, approval required); nothing here auto-executes.
 *
 * Identity mirrors the existing roster entry (`modules/agents/roster.ts`):
 * id `freya`, Creative Studio, rose accent.
 */
export const manifest: AgentManifest = {
  id: "freya",
  name: "Freya",
  description:
    "Transversal creative agent (Mr Forte Lab). Prepares site style proposals from the Business Profile and assesses photos for Sevenef Presence; her creative capabilities are shared across verticals.",
  version: "0.1.0",
  kind: "agent",
  namespace: "agent.freya",
  role: "generative",
  modules: [],
  engines: ["presence", "ai"],
  tools: [],
  primarySection: "contenido",
  personality: {
    tone: "creative, warm, precise",
    style: "visual clarity with brand sensibility",
    traits: [
      "brand-aware",
      "photo-literate",
      "proposes options without deciding for the client",
    ],
  },
  policy: {
    canWrite: false,
    canExecuteTools: false,
    canDelegateToAgents: false,
    canAccessExternalSources: false,
    requiresApproval: true,
    maxAutonomyLevel: "suggest",
  },
  knowledgePriority: {
    workspaceKnowledge: 1,
    verticalSpecialization: 2,
    externalIntelligence: 3,
  },
}
