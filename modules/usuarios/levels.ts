import type { ModuleProgressionProfile } from "@core/registry"

export const moduleProgression: ModuleProgressionProfile = {
  moduleId: "usuarios",
  defaultLevel: "basic",
  recommendedStart: "basic",
  levels: [
    {
      level: "basic",
      label: "Basic",
      summary: "Gestion basica de usuarios con roles y acceso al workspace.",
      businessValue: "Permite controlar quien accede al sistema y con que permisos minimos.",
      includedCapabilities: [
        "registro de usuarios",
        "roles basicos",
        "acceso por workspace",
        "perfil simple",
      ],
      suitableFor: [
        "equipos pequenos",
        "operacion con pocos usuarios",
        "control de acceso basico",
      ],
      unlocksNext: [
        "permisos por modulo",
        "equipos",
        "actividad de usuario",
      ],
    },
    {
      level: "intermediate",
      label: "Intermediate",
      summary: "Permisos mas granulares, equipos y seguimiento de actividad por usuario.",
      businessValue: "Permite delegar con control y saber quien hace que dentro del workspace.",
      includedCapabilities: [
        "permisos por modulo",
        "equipos",
        "seguimiento de actividad",
        "gestion de invitaciones",
      ],
      suitableFor: [
        "equipos medianos",
        "operacion con delegacion activa",
        "negocios con multiples roles",
      ],
      unlocksNext: [
        "politicas de acceso",
        "auditoria completa",
        "SSO",
      ],
    },
    {
      level: "advanced",
      label: "Advanced",
      summary: "Gobierno de usuarios con politicas de acceso, auditoria y gestion avanzada.",
      businessValue: "Da control completo sobre acceso, trazabilidad y gobernanza del workspace.",
      includedCapabilities: [
        "politicas de acceso",
        "auditoria",
        "SSO / autenticacion avanzada",
        "gestion masiva de usuarios",
      ],
      suitableFor: [
        "organizaciones con requisitos de compliance",
        "operacion multi-equipo",
        "negocios con gobernanza de acceso",
      ],
    },
  ],
}
