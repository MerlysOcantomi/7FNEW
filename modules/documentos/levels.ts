import type { ModuleProgressionProfile } from "@core/registry"

export const moduleProgression: ModuleProgressionProfile = {
  moduleId: "documentos",
  defaultLevel: "basic",
  recommendedStart: "basic",
  levels: [
    {
      level: "basic",
      label: "Basic",
      summary: "Repositorio simple de documentos con categoria y relacion basica con entidades.",
      businessValue: "Centraliza archivos del workspace y evita dispersion en canales informales.",
      includedCapabilities: [
        "subida de documentos",
        "categorias",
        "relacion con clientes y proyectos",
        "vista de lista",
      ],
      suitableFor: [
        "equipos pequenos",
        "operacion con pocos documentos",
        "centralizacion basica",
      ],
      unlocksNext: [
        "busqueda avanzada",
        "versionado",
        "procesamiento con IA",
      ],
    },
    {
      level: "intermediate",
      label: "Intermediate",
      summary: "Documentos con busqueda, etiquetas y relaciones mas ricas con entidades.",
      businessValue: "Permite encontrar y contextualizar documentos con mas rapidez y precision.",
      includedCapabilities: [
        "busqueda por contenido",
        "etiquetas",
        "relaciones enriquecidas",
        "previsualizacion",
      ],
      suitableFor: [
        "operacion con volumen medio de documentos",
        "equipos que consultan documentos frecuentemente",
        "negocios con documentacion contractual o tecnica",
      ],
      unlocksNext: [
        "OCR y extraccion automatica",
        "flujo de aprobacion",
        "workspace knowledge base",
      ],
    },
    {
      level: "advanced",
      label: "Advanced",
      summary: "Documentos con procesamiento IA, extraccion automatica y base de conocimiento.",
      businessValue: "Convierte los documentos en fuente de conocimiento activa del workspace.",
      includedCapabilities: [
        "OCR y extraccion",
        "procesamiento con IA",
        "base de conocimiento del workspace",
        "flujo de aprobacion",
      ],
      suitableFor: [
        "negocios con documentacion intensiva",
        "operacion con necesidad de extraccion y clasificacion",
        "equipos que quieren construir conocimiento interno",
      ],
    },
  ],
}
