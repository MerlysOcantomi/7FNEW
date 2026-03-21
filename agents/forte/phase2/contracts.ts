import { z } from "zod"
import type { ForteRecommendationOutput } from "../phase1"

const forteBusinessTypeSchema = z.enum([
  "agency",
  "consultancy",
  "education",
  "clinic",
  "creator",
  "professional-services",
  "community",
  "general",
])

const forteBusinessSizeSchema = z.enum([
  "solo",
  "small-team",
  "growing",
  "established",
])

const forteRelationshipModelSchema = z.enum([
  "clients",
  "students",
  "patients",
  "members",
  "leads",
  "buyers",
])

export const forteRecommendationRequestSchema = z.object({
  business: z.object({
    businessName: z.string().trim().min(1).max(120).optional(),
    businessType: forteBusinessTypeSchema,
    industry: z.string().trim().min(1).max(120).optional(),
    size: forteBusinessSizeSchema.optional(),
    serves: z.array(forteRelationshipModelSchema).max(6).optional(),
    needs: z.object({
      crm: z.boolean().optional(),
      smartInbox: z.boolean().optional(),
      portal: z.boolean().optional(),
      projectDelivery: z.boolean().optional(),
      taskManagement: z.boolean().optional(),
      invoicing: z.boolean().optional(),
      financeControl: z.boolean().optional(),
      documents: z.boolean().optional(),
      contentMarketing: z.boolean().optional(),
      campaigns: z.boolean().optional(),
      automations: z.boolean().optional(),
      documentAnalysis: z.boolean().optional(),
      aiAssistance: z.boolean().optional(),
    }).optional(),
    painPoints: z.array(z.string().trim().min(1).max(240)).max(12).optional(),
    notes: z.array(z.string().trim().min(1).max(240)).max(12).optional(),
  }),
})

export type ForteRecommendationRequest = z.infer<typeof forteRecommendationRequestSchema>

export interface ForteRecommendationApiResponse {
  recommendation: ForteRecommendationOutput
  availableCapabilities: string[]
  catalogSummary: {
    modules: number
    engines: number
    tools: number
  }
  provisional: {
    usesPilotManifests: boolean
    usesPhase1Profiles: boolean
    notes: string[]
  }
}

export interface ForteRecommendationSurfaceInfo {
  endpoint: string
  method: "POST"
  requestSchema: "ForteRecommendationRequest"
  responseSchema: "ForteRecommendationApiResponse"
  exampleRequest: ForteRecommendationRequest
  availableCapabilities: string[]
  catalogSummary: {
    modules: number
    engines: number
    tools: number
  }
  provisional: {
    usesPilotManifests: boolean
    usesPhase1Profiles: boolean
    notes: string[]
  }
}

export const forteRecommendationExampleRequest: ForteRecommendationRequest = {
  business: {
    businessName: "Studio Norte",
    businessType: "agency",
    industry: "branding y comunicacion visual",
    size: "small-team",
    serves: ["clients", "leads"],
    needs: {
      crm: true,
      smartInbox: true,
      projectDelivery: true,
      taskManagement: true,
      invoicing: true,
      documents: true,
      contentMarketing: true,
      campaigns: true,
      automations: true,
      aiAssistance: true,
    },
    painPoints: [
      "seguimiento irregular de leads y mensajes",
      "proyectos y tareas repartidos en varias herramientas",
      "facturacion y documentos poco conectados con la operacion",
    ],
    notes: [
      "quiere una base generalista primero",
      "valora poder verticalizar despues",
    ],
  },
}
