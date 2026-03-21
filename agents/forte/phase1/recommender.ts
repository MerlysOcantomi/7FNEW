import { getFortePhase1Catalog } from "./catalog"
import type {
  ForteCatalogEntry,
  ForteCatalogKind,
  ForteConfidence,
  ForteRecommendationInput,
  ForteRecommendationItem,
  ForteRecommendationOutput,
  ForteRelationshipModel,
  ForteVerticalSuggestion,
} from "./types"

interface NormalizedSignals {
  crm: boolean
  smartInbox: boolean
  portal: boolean
  projectDelivery: boolean
  taskManagement: boolean
  invoicing: boolean
  financeControl: boolean
  documents: boolean
  contentMarketing: boolean
  campaigns: boolean
  automations: boolean
  documentAnalysis: boolean
  aiAssistance: boolean
}

interface NormalizedInput {
  summary: string
  serves: ForteRelationshipModel[]
  painPoints: string[]
  inferredSignals: string[]
  explicitSignals: string[]
  signals: NormalizedSignals
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values))
}

function includesKeyword(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword))
}

function inferServes(input: ForteRecommendationInput): ForteRelationshipModel[] {
  const serves = [...(input.serves ?? [])]
  const haystack = `${input.industry ?? ""} ${(input.painPoints ?? []).join(" ")} ${(input.notes ?? []).join(" ")}`
    .toLowerCase()

  if (includesKeyword(haystack, ["paciente", "pacientes", "clinica", "salud", "consulta"])) {
    serves.push("patients")
  }
  if (includesKeyword(haystack, ["alumno", "alumnos", "curso", "academia", "formacion"])) {
    serves.push("students")
  }
  if (includesKeyword(haystack, ["miembro", "miembros", "comunidad", "membership"])) {
    serves.push("members")
  }
  if (includesKeyword(haystack, ["lead", "leads", "prospecto", "prospectos"])) {
    serves.push("leads")
  }
  if (includesKeyword(haystack, ["cliente", "clientes", "cuentas"])) {
    serves.push("clients")
  }
  if (includesKeyword(haystack, ["comprador", "compradores", "tienda", "ecommerce"])) {
    serves.push("buyers")
  }

  return unique(serves)
}

function normalizeInput(input: ForteRecommendationInput): NormalizedInput {
  const haystack = `${(input.painPoints ?? []).join(" ")} ${(input.notes ?? []).join(" ")} ${input.industry ?? ""}`.toLowerCase()
  const serves = inferServes(input)
  const inferredSignals: string[] = []
  const explicitSignals = Object.entries(input.needs ?? {})
    .filter(([, enabled]) => enabled)
    .map(([key]) => key)

  const signals: NormalizedSignals = {
    crm: input.needs?.crm ?? serves.length > 0,
    smartInbox: input.needs?.smartInbox ?? includesKeyword(haystack, [
      "inbox",
      "mensajes",
      "whatsapp",
      "correo",
      "email",
      "lead",
      "responder",
      "conversaciones",
    ]),
    portal: input.needs?.portal ?? includesKeyword(haystack, ["portal", "autoservicio", "cliente entra"]),
    projectDelivery: input.needs?.projectDelivery ?? (
      input.businessType === "agency"
      || input.businessType === "consultancy"
      || input.businessType === "professional-services"
      || input.businessType === "creator"
    ),
    taskManagement: input.needs?.taskManagement ?? includesKeyword(haystack, [
      "tareas",
      "seguimiento",
      "prioridades",
      "backlog",
      "equipo",
    ]),
    invoicing: input.needs?.invoicing ?? includesKeyword(haystack, [
      "factura",
      "facturas",
      "cobros",
      "pagos",
      "cotizacion",
    ]),
    financeControl: input.needs?.financeControl ?? includesKeyword(haystack, [
      "finanzas",
      "rentabilidad",
      "cashflow",
      "flujo de caja",
      "margen",
    ]),
    documents: input.needs?.documents ?? includesKeyword(haystack, [
      "documentos",
      "contratos",
      "archivos",
      "pdf",
      "expedientes",
    ]),
    contentMarketing: input.needs?.contentMarketing ?? includesKeyword(haystack, [
      "contenido",
      "redes",
      "editorial",
      "blog",
      "newsletter",
      "social",
    ]),
    campaigns: input.needs?.campaigns ?? includesKeyword(haystack, [
      "campana",
      "campanas",
      "lanzamiento",
      "ads",
      "marketing",
    ]),
    automations: input.needs?.automations ?? includesKeyword(haystack, [
      "automat",
      "manual",
      "repetitivo",
      "seguimiento automatico",
    ]),
    documentAnalysis: input.needs?.documentAnalysis ?? includesKeyword(haystack, [
      "ocr",
      "analizar documentos",
      "extraer datos",
      "leer pdf",
      "clasificar documentos",
    ]),
    aiAssistance: input.needs?.aiAssistance ?? includesKeyword(haystack, [
      "ia",
      "inteligencia",
      "copilot",
      "analisis",
      "generar",
      "automat",
    ]),
  }

  if (signals.projectDelivery && !signals.taskManagement) {
    signals.taskManagement = true
    inferredSignals.push("taskManagement")
  }

  if (signals.campaigns && !signals.contentMarketing) {
    signals.contentMarketing = true
    inferredSignals.push("contentMarketing")
  }

  if (signals.documentAnalysis && !signals.documents) {
    signals.documents = true
    inferredSignals.push("documents")
  }

  if ((signals.smartInbox || signals.documentAnalysis || signals.contentMarketing || signals.automations) && !signals.aiAssistance) {
    signals.aiAssistance = true
    inferredSignals.push("aiAssistance")
  }

  if ((signals.invoicing || signals.portal) && !signals.crm) {
    signals.crm = true
    inferredSignals.push("crm")
  }

  const businessLabel = input.businessName ? `${input.businessName}` : "este negocio"
  const relationshipLabel = serves.length > 0 ? ` que trabaja con ${serves.join(", ")}` : ""

  return {
    summary: `${businessLabel} se interpreta como un negocio de tipo ${input.businessType}${relationshipLabel}.`,
    serves,
    painPoints: input.painPoints ?? [],
    inferredSignals,
    explicitSignals,
    signals,
  }
}

function getCatalogEntry(kind: ForteCatalogKind, id: string, catalog: ReturnType<typeof getFortePhase1Catalog>) {
  if (kind === "module") return catalog.modules.find((entry) => entry.id === id)
  if (kind === "engine") return catalog.engines.find((entry) => entry.id === id)
  return catalog.tools.find((entry) => entry.id === id)
}

function toRecommendationItem(
  entry: ForteCatalogEntry,
  priority: ForteRecommendationItem["priority"],
  reason: string,
): ForteRecommendationItem {
  return {
    id: entry.id,
    kind: entry.kind,
    namespace: entry.namespace,
    name: entry.name,
    priority,
    reason,
    provides: entry.provides,
    dependencies: entry.dependencies,
    source: entry.source,
    optional: entry.optional,
  }
}

function addRecommendation(
  collection: ForteRecommendationItem[],
  entry: ForteCatalogEntry | undefined,
  priority: ForteRecommendationItem["priority"],
  reason: string,
) {
  if (!entry || collection.some((item) => item.id === entry.id)) return
  collection.push(toRecommendationItem(entry, priority, reason))
}

function getSuggestedVertical(serves: ForteRelationshipModel[]): ForteVerticalSuggestion | undefined {
  if (serves.includes("students")) {
    return {
      id: "education",
      label: "Educacion",
      reason: "La operacion parece orientada a alumnos, cursos o seguimiento academico.",
      status: "future-opportunity",
    }
  }

  if (serves.includes("patients")) {
    return {
      id: "clinic",
      label: "Clinica",
      reason: "La operacion sugiere procesos centrados en pacientes, historial y documentos sensibles.",
      status: "future-opportunity",
    }
  }

  if (serves.includes("members")) {
    return {
      id: "membership",
      label: "Membership",
      reason: "Hay senales de comunidad o membresias que podrian pedir reglas mas especificas a futuro.",
      status: "future-opportunity",
    }
  }

  if (serves.includes("buyers")) {
    return {
      id: "commerce",
      label: "Commerce",
      reason: "El negocio parece orientado a compradores y podria verticalizarse hacia comercio despues.",
      status: "future-opportunity",
    }
  }

  return {
    id: "generalist-core",
    label: "Base generalista",
    reason: "Todavia no hay una vertical dominante; conviene partir de un core generalista y especializar despues.",
    status: "generalist-first",
  }
}

function getConfidence(normalized: NormalizedInput): ForteConfidence {
  const explicitCount = normalized.explicitSignals.length
  const inferredCount = normalized.inferredSignals.length

  if (explicitCount >= 4) return "high"
  if (explicitCount >= 2 || inferredCount >= 3) return "medium"
  return "low"
}

function getBaseProfile(normalized: NormalizedInput) {
  if (normalized.signals.contentMarketing || normalized.signals.campaigns) {
    return {
      profile: "content-led-ops",
      summary: "Base orientada a operaciones comerciales y produccion de contenido.",
    }
  }

  if (normalized.signals.smartInbox || normalized.signals.crm) {
    return {
      profile: "relationship-led-ops",
      summary: "Base centrada en relaciones, entrada de demanda y seguimiento operacional.",
    }
  }

  if (normalized.signals.projectDelivery || normalized.signals.taskManagement) {
    return {
      profile: "delivery-ops",
      summary: "Base orientada a coordinar entregables, proyectos y ejecucion.",
    }
  }

  return {
    profile: "general-core",
    summary: "Base generalista para operar negocio, equipo y crecimiento incremental.",
  }
}

export function recommendForteArchitecture(
  input: ForteRecommendationInput,
): ForteRecommendationOutput {
  const catalog = getFortePhase1Catalog()
  const normalized = normalizeInput(input)

  const modules: ForteRecommendationItem[] = []
  const engines: ForteRecommendationItem[] = []
  const tools: ForteRecommendationItem[] = []
  const why: string[] = []
  const businessValue: string[] = []
  const dependencyNotes: string[] = []
  const gaps: string[] = []

  addRecommendation(
    modules,
    getCatalogEntry("module", "usuarios", catalog),
    "core",
    "Da una base minima para operar con equipo, responsables y usuarios internos.",
  )

  if (normalized.signals.crm) {
    addRecommendation(
      modules,
      getCatalogEntry("module", "clientes", catalog),
      "core",
      "Centraliza relaciones con clientes, leads o cuentas para que el negocio no opere en hojas sueltas.",
    )
  }

  if (normalized.signals.projectDelivery) {
    addRecommendation(
      modules,
      getCatalogEntry("module", "proyectos", catalog),
      "core",
      "Ordena entregables y seguimiento de trabajo por cliente o iniciativa.",
    )
    why.push("Hay una necesidad clara de coordinar trabajo entregable o seguimiento por iniciativas.")
  }

  if (normalized.signals.taskManagement) {
    addRecommendation(
      modules,
      getCatalogEntry("module", "tareas", catalog),
      normalized.signals.projectDelivery ? "core" : "recommended",
      "Convierte la operacion en acciones concretas, prioridades y seguimiento diario.",
    )
  }

  if (normalized.signals.invoicing) {
    addRecommendation(
      modules,
      getCatalogEntry("module", "facturacion", catalog),
      "recommended",
      "Ayuda a aterrizar cobros, estados y relacion con clientes o proyectos.",
    )
  }

  if (normalized.signals.financeControl) {
    addRecommendation(
      modules,
      getCatalogEntry("module", "finanzas", catalog),
      "recommended",
      "Aporta visibilidad financiera para tomar decisiones y entender rentabilidad.",
    )
  }

  if (normalized.signals.documents) {
    addRecommendation(
      modules,
      getCatalogEntry("module", "documentos", catalog),
      "recommended",
      "Da orden a contratos, adjuntos y archivos operativos del negocio.",
    )
  }

  if (normalized.signals.smartInbox) {
    addRecommendation(
      modules,
      getCatalogEntry("module", "inbox", catalog),
      "recommended",
      "Permite convertir entradas y mensajes en conversaciones con seguimiento real.",
    )
    why.push("Hay senales de friccion en comunicacion, seguimiento o captacion de demanda.")
  }

  if (normalized.signals.contentMarketing) {
    addRecommendation(
      modules,
      getCatalogEntry("module", "contenido", catalog),
      "recommended",
      "Conviene si el negocio necesita sostener una maquina editorial o de contenido constante.",
    )
  }

  if (normalized.signals.campaigns) {
    addRecommendation(
      modules,
      getCatalogEntry("module", "campanas", catalog),
      "recommended",
      "Ayuda a organizar iniciativas de marketing con objetivos, fechas y piezas relacionadas.",
    )
  }

  if (normalized.signals.automations) {
    addRecommendation(
      modules,
      getCatalogEntry("module", "automatizaciones", catalog),
      "recommended",
      "Reduce trabajo repetitivo y prepara procesos que luego se puedan activar con mas precision.",
    )
  }

  if (normalized.signals.aiAssistance) {
    addRecommendation(
      engines,
      getCatalogEntry("engine", "ai", catalog),
      "recommended",
      "Hace posible clasificacion, analisis y generacion asistida sin acoplar la decision a un prompt unico.",
    )
    why.push("Hay necesidades donde la capa AI aporta valor real: analisis, generacion o automatizacion.")
  }

  if (normalized.signals.documentAnalysis) {
    addRecommendation(
      tools,
      getCatalogEntry("tool", "scan", catalog),
      "recommended",
      "Encaja cuando hay que leer documentos, extraer datos o clasificar informacion entrante.",
    )
  }

  const coveredCapabilities = unique([
    ...modules.flatMap((item) => item.provides),
    ...engines.flatMap((item) => item.provides),
    ...tools.flatMap((item) => item.provides),
  ]).sort()

  const vertical = getSuggestedVertical(normalized.serves)
  const base = getBaseProfile(normalized)
  const confidence = getConfidence(normalized)

  if (normalized.signals.portal) {
    gaps.push("El portal aparece como necesidad, pero esta phase 1 solo recomienda estructura; no activa superficies ni runtime.")
  }

  if (vertical?.status === "future-opportunity") {
    gaps.push(`Se detecta potencial de verticalizacion hacia ${vertical.label}, pero todavia conviene partir desde una base generalista de core.`)
  }

  if (normalized.signals.smartInbox && !normalized.signals.crm) {
    gaps.push("Si el inbox crece como canal principal, probablemente convendra reforzar el modelo de relacion y seguimiento comercial.")
  }

  if (normalized.signals.documentAnalysis && !normalized.signals.aiAssistance) {
    gaps.push("El analisis documental gana mucho mas valor cuando se combina con IA y contexto de negocio.")
  }

  businessValue.push(
    ...unique(
      [...modules, ...engines, ...tools]
        .map((item) => getCatalogEntry(item.kind, item.id, catalog)?.businessValue)
        .filter((value): value is string => Boolean(value)),
    ),
  )

  dependencyNotes.push(
    ...unique(
      [...modules, ...engines, ...tools]
        .flatMap((item) =>
          item.dependencies.map((dependency) => `${item.name} depende de ${dependency}.`),
        ),
    ),
  )

  if (modules.some((item) => item.id === "inbox") && !engines.some((item) => item.id === "ai")) {
    dependencyNotes.push("Inbox tiene mucho mas sentido cuando el engine AI acompana la clasificacion y el resumen.")
  }

  return {
    interpretedBusiness: {
      summary: normalized.summary,
      businessType: input.businessType,
      industry: input.industry,
      size: input.size,
      serves: normalized.serves,
      keyNeeds: Object.entries(normalized.signals)
        .filter(([, enabled]) => enabled)
        .map(([key]) => key),
      inferredSignals: normalized.inferredSignals,
      painPoints: normalized.painPoints,
    },
    recommendationBase: {
      profile: base.profile,
      summary: base.summary,
      confidence,
    },
    modules,
    engines,
    tools,
    coveredCapabilities,
    gaps,
    explanation: {
      headline: `Mr. Forte recomienda una base ${base.profile} para ${input.businessName ?? "este negocio"}.`,
      why: unique([
        ...why,
        normalized.signals.crm
          ? "El negocio necesita una base clara para relaciones, cuentas o seguimiento comercial."
          : "La base puede mantenerse ligera mientras se valida el flujo operativo principal.",
      ]),
      businessValue,
      dependencyNotes,
    },
    suggestedVertical: vertical,
  }
}
