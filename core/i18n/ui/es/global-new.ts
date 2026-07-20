import type { GlobalNewMessages } from "../types"

/**
 * Spanish source for the `globalNew` UI namespace — chrome + creation-action
 * copy, fully translated.
 */
export const globalNew: GlobalNewMessages = {
  trigger: "Nuevo",
  title: "Nuevo",
  subtitle: "Crea en todo tu workspace",
  close: "Cerrar el panel Nuevo",
  groups: {
    capture: "Capturar",
    work: "Trabajo",
    assets: "Recursos",
    vertical: "Vertical",
  },
  items: {
    conversation: {
      label: "Nueva conversación",
      description: "Abre la bandeja para iniciar o continuar trabajo",
    },
    manualIntake: {
      label: "Entrada manual",
      description: "Captura información sin estructurar con enrutado por IA",
    },
    request: {
      label: "Nueva solicitud",
      description: "Revisa y gestiona las solicitudes del portal",
    },
    quickNote: {
      label: "Nota rápida",
      description: "Captura veloz como tarea o recordatorio",
    },
    client: {
      label: "Nuevo cliente",
      description: "Añade una cuenta o un prospecto",
    },
    project: {
      label: "Nuevo proyecto",
      description: "Planifica trabajo de entrega",
    },
    task: {
      label: "Nueva tarea",
      description: "Sigue el trabajo de ejecución",
    },
    invoice: {
      label: "Nueva factura",
      description: "Facturación y cobros",
    },
    document: {
      label: "Nuevo documento",
      description: "Biblioteca y archivos estructurados",
    },
    upload: {
      label: "Subir archivo",
      description: "Añade archivos al workspace",
    },
    contentCampaign: {
      label: "Nuevo contenido / campaña",
      description: "Contenido de marketing y campañas",
    },
  },
}
