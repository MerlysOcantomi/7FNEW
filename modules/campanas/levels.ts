import type { ModuleProgressionProfile } from "@core/registry"

export const moduleProgression: ModuleProgressionProfile = {
  moduleId: "campanas",
  defaultLevel: "basic",
  recommendedStart: "basic",
  levels: [
    {
      level: "basic",
      label: "Basic",
      summary: "Registro de campanas con estado, objetivo y periodo.",
      businessValue: "Da orden minimo a las iniciativas de marketing y permite hacer seguimiento nominal.",
      includedCapabilities: [
        "registro de campanas",
        "estado y objetivo",
        "periodo de vigencia",
        "descripcion basica",
      ],
      suitableFor: [
        "negocios con pocas campanas al ano",
        "operacion de marketing simple",
        "equipos sin herramienta de marketing dedicada",
      ],
      unlocksNext: [
        "relacion con contenido",
        "seguimiento de resultados",
        "presupuesto de campana",
      ],
    },
    {
      level: "intermediate",
      label: "Intermediate",
      summary: "Campanas conectadas con contenido, presupuesto y seguimiento de resultados.",
      businessValue: "Permite que las campanas sean unidades de coordinacion con visibilidad de esfuerzo y resultado.",
      includedCapabilities: [
        "relacion con contenido",
        "presupuesto de campana",
        "seguimiento de resultados",
        "asignacion de responsables",
      ],
      suitableFor: [
        "equipos de marketing activos",
        "negocios con campanas recurrentes",
        "operacion con presupuesto de marketing asignado",
      ],
      unlocksNext: [
        "automatizacion de campanas",
        "metricas de rendimiento",
        "segmentacion de audiencia",
      ],
    },
    {
      level: "advanced",
      label: "Advanced",
      summary: "Campanas con automatizacion, segmentacion y metricas avanzadas.",
      businessValue: "Convierte las campanas en una capa estrategica con ejecucion coordinada y medicion de impacto.",
      includedCapabilities: [
        "automatizacion de flujos",
        "segmentacion de audiencia",
        "metricas de rendimiento",
        "coordinacion multi-canal",
      ],
      suitableFor: [
        "operacion de marketing a escala",
        "negocios con multiples campanas simultaneas",
        "equipos que miden ROI de marketing",
      ],
    },
  ],
}
