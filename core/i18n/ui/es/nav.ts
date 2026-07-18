import type { NavMessages } from "../types"

/**
 * Spanish source for the `nav` UI namespace — really translated (P4.2).
 * Entity keys are GENERIC Spanish fallbacks; vertical vocabulary (Clientas /
 * Agenda / Mensajes / Cobros for Finesse) overrides them at compose time, so
 * no vertical noun is ever hardcoded here.
 */
export const nav: NavMessages = {
  today: "Hoy",
  calendar: "Calendario",
  clients: "Clientes",
  inbox: "Bandeja de entrada",
  services: "Servicios",
  billing: "Facturación",
  team: "Equipo",
  settings: "Ajustes",
  tasks: "Tareas",
  finance: "Finanzas",
  marketing: "Marketing",
  more: "Más",
  new: "Nuevo",
  search: "Buscar",
  expandSidebar: "Expandir la navegación",
  collapseSidebar: "Contraer la navegación",
  openNavigation: "Abrir la navegación",
  closeNavigation: "Cerrar la navegación",
  navigationTitle: "Navegación",
  backToWorkspace: "Volver a 7F",
  mySalon: "Mi salón",
  helpers: {
    marketing: "Contenido, campañas y crecimiento",
    billing: "Facturas y pagos",
    forteLab: "Módulos y mejoras",
  },
  smartInbox: {
    // "Smart Inbox" and "by Fanny" are product/agent branding — kept as-is in
    // Spanish on purpose (proper names), but sourced from the catalog so the
    // decision is explicit and revisable.
    title: "Smart Inbox",
    byFanny: "by Fanny",
    groups: {
      work: "Trabajo",
      smartViews: "Vistas inteligentes",
      storage: "Almacenamiento",
    },
    items: {
      inbox: "Bandeja de entrada",
      needsAction: "Requiere acción",
      waiting: "En espera",
      done: "Resueltas",
      scheduled: "Programadas",
      opportunities: "Oportunidades",
      closed: "Cerradas",
      archived: "Archivadas",
      trash: "Papelera",
    },
  },
}
