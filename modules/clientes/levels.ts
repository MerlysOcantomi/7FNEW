import type { ModuleProgressionProfile } from "@core/registry"

export const moduleProgression: ModuleProgressionProfile = {
  moduleId: "clientes",
  defaultLevel: "basic",
  recommendedStart: "basic",
  levels: [
    {
      level: "basic",
      label: "Basic",
      summary: "Base simple para registrar clientes, estado y consulta rapida.",
      businessValue: "Ordena la cartera minima y evita operar contactos importantes en canales dispersos.",
      includedCapabilities: [
        "ficha simple",
        "lista con estado y tipo",
        "busqueda basica",
      ],
      suitableFor: [
        "operacion inicial",
        "equipo pequeno",
        "cartera reducida o simple",
      ],
      unlocksNext: [
        "seguimiento comercial",
        "historial conectado con proyectos y facturas",
      ],
    },
    {
      level: "intermediate",
      label: "Intermediate",
      summary: "Relaciona clientes con proyectos, facturas, notas y seguimiento operativo.",
      businessValue: "Permite que la relacion comercial deje de ser solo una agenda y se convierta en contexto operativo real.",
      includedCapabilities: [
        "historial operativo",
        "relacion con proyectos",
        "relacion con facturacion",
        "notas profesionales",
      ],
      suitableFor: [
        "servicios recurrentes",
        "seguimiento comercial activo",
        "operacion con varias cuentas por atender",
      ],
      unlocksNext: [
        "pipeline y scoring",
        "segmentacion mas rica",
      ],
    },
    {
      level: "advanced",
      label: "Advanced",
      summary: "Vision enriquecida del cliente con scoring, segmentacion y seguimiento mas inteligente.",
      businessValue: "Convierte la base de clientes en una capa de decision para crecimiento, priorizacion y retencion.",
      includedCapabilities: [
        "scoring",
        "segmentacion",
        "senales de seguimiento",
        "vision 360 del cliente",
      ],
      suitableFor: [
        "equipos comerciales",
        "negocios con leads y cartera activa",
        "operacion con seguimiento complejo",
      ],
    },
  ],
}
