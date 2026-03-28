/**
 * UI-only capability presentation metadata.
 *
 * This file maps backend capability IDs to human-readable labels,
 * descriptions, impact statements, and suggested actions for display
 * in the Forte Improvements surface.
 *
 * This is NOT a semantic source of truth. The canonical signal and
 * capability definitions live in:
 *   - agents/forte/semantic/README.md
 *   - agents/forte/runtime/business/signals.ts
 *
 * If a capability ID changes in the backend, update this file to match.
 */

export interface CapabilityPresentation {
  label: string
  description: string
  impact: string
  action: string
}

export const CAPABILITY_META: Record<string, CapabilityPresentation> = {
  crm: {
    label: "Client Relationship Management",
    description: "Track interactions, follow-ups, and client lifecycle systematically",
    impact: "Without this, relationships depend on memory and scattered notes",
    action: "Enable CRM capabilities",
  },
  smartInbox: {
    label: "Smart Inbox",
    description: "Centralized communication hub with AI-powered routing",
    impact: "Messages get lost or delayed without a structured entry point",
    action: "Activate Smart Inbox",
  },
  portal: {
    label: "Client Portal",
    description: "Give clients visibility into project progress and deliverables",
    impact: "Clients can't see their work status, increasing support requests",
    action: "Set up client portal",
  },
  projectDelivery: {
    label: "Project Delivery",
    description: "Structured project management with phases and milestones",
    impact: "Work happens without clear deadlines, phases, or accountability",
    action: "Configure project workflows",
  },
  taskManagement: {
    label: "Task Management",
    description: "Organized task tracking with assignments and deadlines",
    impact: "Tasks fall through the cracks without a tracking system",
    action: "Enable task management",
  },
  invoicing: {
    label: "Invoicing",
    description: "Generate and track invoices for clients and projects",
    impact: "Revenue collection is manual and hard to track",
    action: "Set up invoicing",
  },
  financeControl: {
    label: "Financial Control",
    description: "Track expenses, margins, and overall financial health",
    impact: "You can't tell if a project is profitable or if expenses are growing",
    action: "Enable expense tracking",
  },
  documents: {
    label: "Document Management",
    description: "Organize, store, and share project documents",
    impact: "Files are scattered across tools with no central access",
    action: "Enable document system",
  },
  contentMarketing: {
    label: "Content System",
    description: "Plan and create content to build audience and authority",
    impact: "Growth depends entirely on referrals — no scalable reach",
    action: "Activate content module",
  },
  campaigns: {
    label: "Campaign Management",
    description: "Run structured marketing campaigns with tracking",
    impact: "Outreach is ad-hoc with no way to measure what works",
    action: "Set up campaign tools",
  },
  automations: {
    label: "Automations",
    description: "Rules and workflows that handle repetitive tasks automatically",
    impact: "Repetitive work consumes time that could go to higher-value tasks",
    action: "Configure automation rules",
  },
  documentAnalysis: {
    label: "Document Analysis",
    description: "AI-powered analysis and extraction from documents",
    impact: "Insights trapped in documents remain invisible to the system",
    action: "Enable document intelligence",
  },
  aiAssistance: {
    label: "AI Assistance",
    description: "AI-powered help for interpretation, content, and decisions",
    impact: "Manual interpretation of data and content slows everything down",
    action: "Activate AI assistant",
  },
}

export function getCapabilityMeta(capabilityId: string): CapabilityPresentation | null {
  return CAPABILITY_META[capabilityId] ?? null
}

export function getCapabilityLabel(capabilityId: string): string {
  return CAPABILITY_META[capabilityId]?.label ?? capabilityId
}

export function getCapabilityAction(capabilityId: string): string {
  return CAPABILITY_META[capabilityId]?.action ?? `Enable ${capabilityId}`
}
