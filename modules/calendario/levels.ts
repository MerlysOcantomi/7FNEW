import type { ModuleProgressionProfile } from "@core/registry"

export const moduleProgression: ModuleProgressionProfile = {
  moduleId: "calendario",
  defaultLevel: "basic",
  recommendedStart: "basic",
  levels: [
    {
      level: "basic",
      label: "Basic",
      summary: "Vista de calendario con eventos simples y fechas clave.",
      businessValue: "Da orden temporal minimo a la operacion del workspace.",
      includedCapabilities: [
        "vista mensual y semanal",
        "eventos manuales",
        "fechas clave",
      ],
      suitableFor: [
        "operacion con pocas citas",
        "equipos pequenos",
        "referencia temporal basica",
      ],
      unlocksNext: [
        "relacion con tareas y proyectos",
        "recordatorios",
        "eventos recurrentes",
      ],
    },
    {
      level: "intermediate",
      label: "Intermediate",
      summary: "Calendario conectado con tareas, proyectos y recordatorios automaticos.",
      businessValue: "Hace que el calendario refleje la realidad operativa y no solo citas aisladas.",
      includedCapabilities: [
        "relacion con tareas y proyectos",
        "recordatorios",
        "eventos recurrentes",
        "vista por responsable",
      ],
      suitableFor: [
        "equipos con coordinacion temporal",
        "servicios con citas y entregas",
        "operacion con deadlines compartidos",
      ],
      unlocksNext: [
        "sincronizacion externa",
        "disponibilidad",
        "vista de carga temporal",
      ],
    },
    {
      level: "advanced",
      label: "Advanced",
      summary: "Calendario inteligente con carga temporal, disponibilidad y sincronizacion.",
      businessValue: "Permite gestionar la capacidad temporal del equipo y conectar con herramientas externas.",
      includedCapabilities: [
        "sincronizacion con calendario externo",
        "vista de disponibilidad",
        "carga temporal por persona",
        "automatizacion de agendamiento",
      ],
      suitableFor: [
        "equipos con alta coordinacion temporal",
        "negocios con citas y reservas",
        "operacion multi-persona con agendas compartidas",
      ],
    },
  ],
}
