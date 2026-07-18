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
}
