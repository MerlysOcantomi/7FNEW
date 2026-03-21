import type { ModuleProgressionProfile } from "@core/registry"

export const moduleProgression: ModuleProgressionProfile = {
  moduleId: "proyectos",
  defaultLevel: "basic",
  recommendedStart: "intermediate",
  levels: [
    {
      level: "basic",
      label: "Basic",
      summary: "Gestion simple de proyectos con estado, prioridad y lista operativa.",
      businessValue: "Da una vista ordenada del trabajo activo sin exigir una coordinacion compleja desde el inicio.",
      includedCapabilities: [
        "lista de proyectos",
        "estado basico",
        "prioridad",
        "descripcion simple",
      ],
      suitableFor: [
        "operacion inicial por entregables",
        "seguimiento sencillo",
        "pocos proyectos simultaneos",
      ],
      unlocksNext: [
        "responsables",
        "fechas y seguimiento",
        "relacion estructurada con clientes",
      ],
    },
    {
      level: "intermediate",
      label: "Intermediate",
      summary: "Coordina responsables, fechas, cliente, tareas y seguimiento real del delivery.",
      businessValue: "Hace que el proyecto sea una unidad operativa completa y no solo un contenedor nominal.",
      includedCapabilities: [
        "relacion con clientes",
        "tareas conectadas",
        "fechas y progreso",
        "visibilidad por usuario",
        "documentos y notas ligados al proyecto",
      ],
      suitableFor: [
        "agencias",
        "consultoria",
        "equipos con entregables recurrentes",
      ],
      unlocksNext: [
        "timeline y dependencias",
        "costes y rentabilidad",
        "automatizacion coordinada",
      ],
    },
    {
      level: "advanced",
      label: "Advanced",
      summary: "Gobierno operativo mas profundo con dependencias, rentabilidad y coordinacion compleja.",
      businessValue: "Permite que proyectos complejos se gestionen con mas criterio economico y automatizacion operacional.",
      includedCapabilities: [
        "timeline",
        "dependencias",
        "costes y rentabilidad",
        "automatizaciones de coordinacion",
      ],
      suitableFor: [
        "operacion multi-equipo",
        "servicios con alta coordinacion",
        "seguimiento con presion de margen y tiempos",
      ],
    },
  ],
}
