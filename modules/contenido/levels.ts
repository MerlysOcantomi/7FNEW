import type { ModuleProgressionProfile } from "@core/registry"

export const moduleProgression: ModuleProgressionProfile = {
  moduleId: "contenido",
  defaultLevel: "basic",
  recommendedStart: "basic",
  levels: [
    {
      level: "basic",
      label: "Basic",
      summary: "Registro de piezas de contenido con estado editorial y categoria.",
      businessValue: "Ordena lo que se produce y da visibilidad sobre el flujo de contenido.",
      includedCapabilities: [
        "registro de piezas",
        "estado editorial",
        "categorias",
        "ideas de contenido",
      ],
      suitableFor: [
        "creadores individuales",
        "operacion editorial simple",
        "equipos sin calendario de publicacion formal",
      ],
      unlocksNext: [
        "calendario editorial",
        "relacion con campanas",
        "generacion asistida por IA",
      ],
    },
    {
      level: "intermediate",
      label: "Intermediate",
      summary: "Planificacion editorial con calendario, relacion con campanas y flujo de aprobacion.",
      businessValue: "Permite que el contenido deje de ser reactivo y se planifique con mas estructura.",
      includedCapabilities: [
        "calendario editorial",
        "relacion con campanas",
        "flujo de aprobacion",
        "asignacion de responsables",
      ],
      suitableFor: [
        "equipos de marketing",
        "agencias con produccion editorial",
        "negocios con presencia activa en canales",
      ],
      unlocksNext: [
        "generacion con IA",
        "metricas de rendimiento",
        "reutilizacion de contenido",
      ],
    },
    {
      level: "advanced",
      label: "Advanced",
      summary: "Contenido asistido por IA con metricas, reutilizacion y optimizacion editorial.",
      businessValue: "Convierte el contenido en una capa estrategica con produccion asistida y medicion real.",
      includedCapabilities: [
        "generacion asistida por IA",
        "metricas de rendimiento",
        "reutilizacion y reciclaje de piezas",
        "optimizacion editorial",
      ],
      suitableFor: [
        "operacion editorial a escala",
        "negocios con estrategia de contenido activa",
        "equipos que miden impacto de publicaciones",
      ],
    },
  ],
}
