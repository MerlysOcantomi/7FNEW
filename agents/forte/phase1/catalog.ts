import {
  ensurePilotManifestsRegistered,
  registry,
  type EngineManifest,
  type ModuleManifest,
  type ToolManifest,
} from "@core/registry"
import {
  resolveForteCapabilities,
  type ForteContext,
} from "@/agents/forte/runtime"
import { getModuleProgression } from "./module-levels"
import type { ForteCatalogEntry, ForteCatalogSnapshot } from "./types"

type Phase1Profile = Omit<ForteCatalogEntry, "source">

function mergeProvides(profileProvides: string[], manifestProvides?: string[]) {
  if (!manifestProvides || manifestProvides.length === 0) {
    return profileProvides
  }

  return Array.from(new Set([...manifestProvides, ...profileProvides]))
}

const MODULE_PROFILES: Phase1Profile[] = [
  {
    id: "usuarios",
    kind: "module",
    namespace: "core.usuarios",
    name: "Usuarios",
    description: "Gestion de usuarios internos y base operativa del sistema.",
    provides: ["users"],
    dependencies: ["core/db"],
    optional: false,
    businessValue: "Permite operar equipos y asignar responsabilidades dentro de 7F.",
    useCases: ["equipo interno", "roles basicos", "operacion diaria"],
  },
  {
    id: "clientes",
    kind: "module",
    namespace: "core.clientes",
    name: "Clientes",
    description: "Base relacional para clientes, leads y cuentas.",
    provides: ["crm", "relationships", "accounts"],
    dependencies: ["core/db"],
    optional: false,
    businessValue: "Centraliza relaciones comerciales y evita operar con contactos dispersos.",
    useCases: ["crm", "seguimiento comercial", "cartera de clientes"],
  },
  {
    id: "proyectos",
    kind: "module",
    namespace: "core.proyectos",
    name: "Proyectos",
    description: "Gestion de proyectos, entregables y seguimiento operativo.",
    provides: ["projects", "delivery", "coordination"],
    dependencies: ["core/db", "clientes"],
    optional: false,
    businessValue: "Da estructura al trabajo entregable y a la coordinacion entre cliente y equipo.",
    useCases: ["servicios", "entregables", "seguimiento por proyecto"],
  },
  {
    id: "tareas",
    kind: "module",
    namespace: "core.tareas",
    name: "Tareas",
    description: "Gestion de tareas, prioridades y trabajo accionable.",
    provides: ["tasks", "priorities", "execution"],
    dependencies: ["core/db", "proyectos"],
    optional: false,
    businessValue: "Convierte la operacion en acciones concretas, priorizadas y trazables.",
    useCases: ["trabajo diario", "backlog", "seguimiento operativo"],
  },
  {
    id: "facturacion",
    kind: "module",
    namespace: "core.facturacion",
    name: "Facturacion",
    description: "Gestion de facturas, estados de cobro y relacion con clientes/proyectos.",
    provides: ["invoicing", "billing", "collections"],
    dependencies: ["core/db", "clientes"],
    optional: false,
    businessValue: "Aterriza la parte comercial en cobros reales y seguimiento administrativo.",
    useCases: ["facturas", "cobros", "flujo de ingresos"],
  },
  {
    id: "finanzas",
    kind: "module",
    namespace: "core.finanzas",
    name: "Finanzas",
    description: "Control financiero operativo y visibilidad economica del negocio.",
    provides: ["finance", "cashflow", "visibility"],
    dependencies: ["core/db", "facturacion"],
    optional: true,
    businessValue: "Ayuda a leer salud financiera, flujo y sostenibilidad con mas claridad.",
    useCases: ["control financiero", "rentabilidad", "flujo de caja"],
  },
  {
    id: "documentos",
    kind: "module",
    namespace: "core.documentos",
    name: "Documentos",
    description: "Gestion documental ligada a clientes, proyectos y operaciones.",
    provides: ["documents", "files", "recordkeeping"],
    dependencies: ["core/db", "clientes"],
    optional: true,
    businessValue: "Ordena archivos clave y reduce friccion al trabajar con evidencia o soporte documental.",
    useCases: ["contratos", "archivos", "adjuntos operativos"],
  },
  {
    id: "inbox",
    kind: "module",
    namespace: "core.inbox",
    name: "Inbox",
    description: "Gestion conversacional e inteligencia operativa para entradas de negocio.",
    provides: ["inbox", "conversations", "lead-intelligence"],
    dependencies: ["core/db", "engines/ai"],
    optional: true,
    businessValue: "Convierte mensajes entrantes en conversaciones estructuradas y oportunidades accionables.",
    useCases: ["lead intake", "mensajeria operativa", "seguimiento inicial"],
  },
  {
    id: "contenido",
    kind: "module",
    namespace: "core.contenido",
    name: "Contenido",
    description: "Planificacion y produccion de piezas de contenido y banco de ideas.",
    provides: ["content", "editorial", "ideas"],
    dependencies: ["core/db"],
    optional: true,
    businessValue: "Da continuidad al marketing y convierte ideas en piezas publicables.",
    useCases: ["contenido", "editorial", "calendario creativo"],
  },
  {
    id: "campanas",
    kind: "module",
    namespace: "core.campanas",
    name: "Campanas",
    description: "Gestion de campanas y objetivos de marketing.",
    provides: ["campaigns", "marketing-plans", "growth"],
    dependencies: ["core/db", "contenido"],
    optional: true,
    businessValue: "Permite planificar acciones de crecimiento con objetivos y fechas claras.",
    useCases: ["marketing", "lanzamientos", "campanas multicanal"],
  },
  {
    id: "automatizaciones",
    kind: "module",
    namespace: "core.automatizaciones",
    name: "Automatizaciones",
    description: "Reglas y automatizaciones operativas sobre procesos del negocio.",
    provides: ["automations", "workflow", "follow-up"],
    dependencies: ["core/db"],
    optional: true,
    businessValue: "Reduce trabajo repetitivo y vuelve mas consistente la operacion.",
    useCases: ["procesos repetitivos", "recordatorios", "workflows"],
  },
]

const ENGINE_PROFILES: Phase1Profile[] = [
  {
    id: "ai",
    kind: "engine",
    namespace: "engine.ai",
    name: "AI Engine",
    description: "Motor reutilizable para analisis, prompts y generacion asistida.",
    provides: ["ai.ask", "ai.chat", "ai.prompts"],
    dependencies: [],
    optional: false,
    businessValue: "Habilita capacidades inteligentes reutilizables sin mezclar identidad de agente con infraestructura.",
    useCases: ["clasificacion", "generacion", "analisis semantico"],
  },
]

const TOOL_PROFILES: Phase1Profile[] = [
  {
    id: "scan",
    kind: "tool",
    namespace: "tool.scan",
    name: "Document Scan",
    description: "Analisis documental estructurado sobre texto extraido.",
    provides: ["document-analysis"],
    dependencies: ["engines/ai"],
    optional: true,
    businessValue: "Acelera lectura de documentos y extraccion de datos utiles para operar.",
    useCases: ["ocr + analisis", "clasificacion documental", "extraccion de datos"],
  },
]

function mergeModuleProfile(profile: Phase1Profile, manifest?: ModuleManifest): ForteCatalogEntry {
  return {
    ...profile,
    name: manifest?.name ?? profile.name,
    description: manifest?.description ?? profile.description,
    namespace: manifest?.namespace ?? profile.namespace,
    provides: mergeProvides(profile.provides, manifest?.provides),
    dependencies: manifest?.dependencies ?? profile.dependencies,
    optional: manifest?.optional ?? profile.optional,
    source: manifest ? "manifest" : "phase1-profile",
    progression: manifest?.progression ?? getModuleProgression(profile.id),
  }
}

function mergeEngineProfile(profile: Phase1Profile, manifest?: EngineManifest): ForteCatalogEntry {
  return {
    ...profile,
    name: manifest?.name ?? profile.name,
    description: manifest?.description ?? profile.description,
    namespace: manifest?.namespace ?? profile.namespace,
    provides: mergeProvides(profile.provides, manifest?.provides),
    dependencies: manifest?.dependencies ?? profile.dependencies,
    optional: manifest?.optional ?? profile.optional,
    source: manifest ? "manifest" : "phase1-profile",
  }
}

function mergeToolProfile(profile: Phase1Profile, manifest?: ToolManifest): ForteCatalogEntry {
  return {
    ...profile,
    name: manifest?.name ?? profile.name,
    description: manifest?.description ?? profile.description,
    namespace: manifest?.namespace ?? profile.namespace,
    provides: mergeProvides(profile.provides, manifest?.provides),
    dependencies: manifest?.dependencies ?? profile.dependencies,
    optional: manifest?.optional ?? profile.optional,
    source: manifest ? "manifest" : "phase1-profile",
  }
}

function toMap<T extends { id: string }>(entries: T[]) {
  return new Map(entries.map((entry) => [entry.id, entry]))
}

function buildCatalogSnapshot(
  moduleManifests: ModuleManifest[],
  engineManifests: EngineManifest[],
  toolManifests: ToolManifest[],
): ForteCatalogSnapshot {
  const moduleMap = toMap(moduleManifests)
  const engineMap = toMap(engineManifests)
  const toolMap = toMap(toolManifests)

  const phase1Modules = MODULE_PROFILES
    .filter((profile) => moduleMap.has(profile.id))
    .map((profile) => mergeModuleProfile(profile, moduleMap.get(profile.id)))

  const manifestOnlyModules = moduleManifests
    .filter((manifest) => !MODULE_PROFILES.some((profile) => profile.id === manifest.id))
    .map<ForteCatalogEntry>((manifest) => ({
      id: manifest.id,
      kind: "module",
      namespace: manifest.namespace ?? `core.${manifest.id}`,
      name: manifest.name,
      description: manifest.description,
      provides: manifest.provides ?? manifest.models,
      dependencies: manifest.dependencies,
      optional: manifest.optional ?? false,
      source: "manifest",
      businessValue: `Capacidad operativa expuesta por el modulo ${manifest.name}.`,
      useCases: manifest.provides ?? manifest.models,
      progression: manifest.progression ?? getModuleProgression(manifest.id),
    }))

  const phase1Engines = ENGINE_PROFILES
    .filter((profile) => engineMap.has(profile.id))
    .map((profile) => mergeEngineProfile(profile, engineMap.get(profile.id)))

  const manifestOnlyEngines = engineManifests
    .filter((manifest) => !ENGINE_PROFILES.some((profile) => profile.id === manifest.id))
    .map<ForteCatalogEntry>((manifest) => ({
      id: manifest.id,
      kind: "engine",
      namespace: manifest.namespace ?? `engine.${manifest.id}`,
      name: manifest.name,
      description: manifest.description,
      provides: manifest.provides,
      dependencies: manifest.dependencies,
      optional: manifest.optional ?? false,
      source: "manifest",
      businessValue: `Capacidad transversal expuesta por el engine ${manifest.name}.`,
      useCases: manifest.provides,
    }))

  const phase1Tools = TOOL_PROFILES
    .filter((profile) => toolMap.has(profile.id))
    .map((profile) => mergeToolProfile(profile, toolMap.get(profile.id)))

  const manifestOnlyTools = toolManifests
    .filter((manifest) => !TOOL_PROFILES.some((profile) => profile.id === manifest.id))
    .map<ForteCatalogEntry>((manifest) => ({
      id: manifest.id,
      kind: "tool",
      namespace: manifest.namespace ?? `tool.${manifest.id}`,
      name: manifest.name,
      description: manifest.description,
      provides: manifest.provides ?? [manifest.id],
      dependencies: manifest.dependencies,
      optional: manifest.optional ?? false,
      source: "manifest",
      businessValue: `Utilidad registrada para ${manifest.name}.`,
      useCases: manifest.provides ?? [manifest.id],
    }))

  return {
    modules: [...phase1Modules, ...manifestOnlyModules],
    engines: [...phase1Engines, ...manifestOnlyEngines],
    tools: [...phase1Tools, ...manifestOnlyTools],
  }
}

export function getFortePhase1Catalog(): ForteCatalogSnapshot {
  ensurePilotManifestsRegistered()
  return buildCatalogSnapshot(
    registry.getAllModules(),
    registry.getAllEngines(),
    registry.getAllTools(),
  )
}

export async function getFortePhase1CatalogForContext(
  context: ForteContext,
): Promise<ForteCatalogSnapshot> {
  const effective = await resolveForteCapabilities({ context })
  return buildCatalogSnapshot(
    effective.modules,
    effective.engines,
    effective.registryTools,
  )
}

export function getAvailableForteCapabilities(): string[] {
  const catalog = getFortePhase1Catalog()
  const capabilities = [
    ...catalog.modules.flatMap((entry) => entry.provides),
    ...catalog.engines.flatMap((entry) => entry.provides),
    ...catalog.tools.flatMap((entry) => entry.provides),
  ]

  return Array.from(new Set(capabilities)).sort()
}

export async function getAvailableForteCapabilitiesForContext(
  context: ForteContext,
): Promise<string[]> {
  const catalog = await getFortePhase1CatalogForContext(context)
  const capabilities = [
    ...catalog.modules.flatMap((entry) => entry.provides),
    ...catalog.engines.flatMap((entry) => entry.provides),
    ...catalog.tools.flatMap((entry) => entry.provides),
  ]

  return Array.from(new Set(capabilities)).sort()
}
