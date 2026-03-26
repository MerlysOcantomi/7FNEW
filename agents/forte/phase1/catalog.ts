import {
  ensurePilotManifestsRegistered,
  registry,
  type EngineManifest,
  type ModuleManifest,
  type ToolManifest,
} from "@core/registry"
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

export function getFortePhase1Catalog(): ForteCatalogSnapshot {
  ensurePilotManifestsRegistered()

  const moduleManifests = toMap(registry.getAllModules())
  const engineManifests = toMap(registry.getAllEngines())
  const toolManifests = toMap(registry.getAllTools())

  return {
    modules: MODULE_PROFILES.map((profile) =>
      mergeModuleProfile(profile, moduleManifests.get(profile.id)),
    ),
    engines: ENGINE_PROFILES.map((profile) =>
      mergeEngineProfile(profile, engineManifests.get(profile.id)),
    ),
    tools: TOOL_PROFILES.map((profile) =>
      mergeToolProfile(profile, toolManifests.get(profile.id)),
    ),
  }
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
