import type { ModuleProgressionProfile } from "@core/registry"

export const moduleProgression: ModuleProgressionProfile = {
  moduleId: "tareas",
  defaultLevel: "basic",
  recommendedStart: "basic",
  levels: [
    {
      level: "basic",
      label: "Basic",
      summary: "Lista de tareas con estado, prioridad y asignacion simple.",
      businessValue: "Ordena el trabajo pendiente y da visibilidad minima sobre lo que hay que hacer.",
      includedCapabilities: [
        "lista de tareas",
        "estado basico",
        "prioridad",
        "asignacion simple",
      ],
      suitableFor: [
        "equipos pequenos",
        "operacion por entregables simples",
        "seguimiento personal",
      ],
      unlocksNext: [
        "relacion con proyectos",
        "fechas y seguimiento",
        "subtareas",
      ],
    },
    {
      level: "intermediate",
      label: "Intermediate",
      summary: "Tareas conectadas a proyectos con fechas, subtareas y seguimiento operativo.",
      businessValue: "Permite coordinar trabajo real dentro de proyectos y hacer seguimiento con mas estructura.",
      includedCapabilities: [
        "relacion con proyectos",
        "fechas de vencimiento",
        "subtareas",
        "comentarios",
        "filtros avanzados",
      ],
      suitableFor: [
        "equipos con varios proyectos activos",
        "operacion con deadlines",
        "coordinacion entre responsables",
      ],
      unlocksNext: [
        "dependencias entre tareas",
        "automatizacion de estados",
        "carga de trabajo",
      ],
    },
    {
      level: "advanced",
      label: "Advanced",
      summary: "Gestion avanzada con dependencias, carga de trabajo y automatizacion de flujos.",
      businessValue: "Convierte las tareas en una capa de coordinacion operativa con vision de capacidad y flujo.",
      includedCapabilities: [
        "dependencias",
        "carga de trabajo",
        "automatizacion de estados",
        "vistas multiples",
      ],
      suitableFor: [
        "operacion compleja multi-equipo",
        "servicios con alta coordinacion",
        "seguimiento con presion de tiempos",
      ],
    },
  ],
}
