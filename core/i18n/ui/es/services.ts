import type { ServicesMessages } from "../types"

/**
 * Spanish source for the `services` UI namespace — really translated.
 * Natural tú-form Spanish; visible labels only.
 */
export const services: ServicesMessages = {
  title: "Servicios",
  description:
    "El catálogo de lo que ofrece tu negocio. Tus agentes usan los servicios activos para entender qué vendes. Solo los servicios activos se comparten con ellos.",
  loading: { description: "Cargando…", body: "Cargando servicios…" },
  add: {
    heading: "Añadir servicio",
    namePlaceholder: "Nombre del servicio…",
    categoryOptionalPlaceholder: "Categoría (opcional)",
    button: "Añadir",
  },
  list: {
    empty: "Aún no hay servicios. Añade el primero arriba.",
    counts: (total, active) =>
      `${total} servicio${total !== 1 ? "s" : ""} · ${active} activo${active !== 1 ? "s" : ""}`,
    categoryPlaceholder: "Categoría",
    active: "Activo",
    inactive: "Inactivo",
    removeAria: (name) => `Eliminar ${name}`,
  },
  save: { button: "Guardar servicios", saving: "Guardando…", saved: "Guardado" },
  errors: {
    load: "No se pudo cargar el catálogo de servicios",
    save: "No se pudo guardar el catálogo",
  },
}
