import type { BusinessDomain } from "./domain-types"

/**
 * Maps natural-language intent text to relevant business domains.
 * Deterministic keyword rules — no AI, no inference beyond keyword matching.
 * Uses the same includesKeyword pattern as phase1/recommender.ts.
 */

interface DomainKeywordRule {
  domain: BusinessDomain
  keywords: string[]
}

const DOMAIN_KEYWORD_RULES: DomainKeywordRule[] = [
  {
    domain: "relationship",
    keywords: [
      "cliente", "clientes", "crm", "leads", "prospectos",
      "relacion", "cuentas", "seguimiento comercial", "cartera",
    ],
  },
  {
    domain: "communication",
    keywords: [
      "mensaje", "mensajes", "correo", "email", "whatsapp",
      "inbox", "conversacion", "conversaciones", "responder",
      "comunicacion",
    ],
  },
  {
    domain: "delivery",
    keywords: [
      "proyecto", "proyectos", "entregable", "entregables",
      "tarea", "tareas", "organizar", "seguimiento", "backlog",
      "equipo", "coordinacion", "prioridad", "prioridades",
    ],
  },
  {
    domain: "marketing",
    keywords: [
      "marketing", "campana", "campanas", "lanzamiento",
      "ads", "publicidad", "crecimiento", "captacion",
      "atraer", "visibilidad",
    ],
  },
  {
    domain: "content",
    keywords: [
      "contenido", "redes", "editorial", "blog", "newsletter",
      "social", "publicar", "creativo", "ideas",
    ],
  },
  {
    domain: "finance",
    keywords: [
      "factura", "facturas", "cobro", "cobros", "pago", "pagos",
      "finanzas", "rentabilidad", "cashflow", "flujo de caja",
      "margen", "gano dinero", "cotizacion", "ingresos",
    ],
  },
  {
    domain: "intelligence",
    keywords: [
      "automatizar", "automatizacion", "inteligencia", "ia",
      "analisis", "analizar", "ocr", "documentos", "extraer datos",
      "generar", "copilot",
    ],
  },
]

function includesKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword))
}

export function mapIntentToDomains(intentText: string): BusinessDomain[] {
  const normalized = intentText.toLowerCase()

  const matched: BusinessDomain[] = []
  for (const rule of DOMAIN_KEYWORD_RULES) {
    if (includesKeyword(normalized, rule.keywords)) {
      matched.push(rule.domain)
    }
  }

  return matched
}
