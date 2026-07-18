import type { TeamMessages } from "../types"

/**
 * Spanish source for the `team` UI namespace — really translated.
 * Natural tú-form Spanish; the surface noun is the generic "Equipo"
 * (vocabulary overrides stay in the resolver layer). `roles` keys are the
 * persisted role VALUES — only the visible labels localize.
 */
export const team: TeamMessages = {
  title: "Equipo",
  description: "Gestiona a los miembros del equipo, sus roles, permisos y acceso al sistema.",
  newUser: "Nuevo usuario",
  roles: { admin: "Admin", gerente: "Gerente", miembro: "Miembro" },
  stats: { total: "Usuarios totales", active: "Activos", uniqueRoles: "Roles distintos" },
  empty: { title: "No hay usuarios", body: "No se encontraron usuarios en el sistema." },
  card: { projectsPlaceholder: "— proyectos" },
  deleteDialog: {
    title: "Eliminar usuario",
    description: (name) =>
      `¿Seguro que quieres eliminar a "${name}"? Esta acción no se puede deshacer.`,
    confirm: "Eliminar",
  },
  toasts: { deleted: "Usuario eliminado", deleteError: "No se pudo eliminar" },
  form: {
    titleNew: "Nuevo usuario",
    titleEdit: "Editar usuario",
    fields: {
      name: "Nombre *",
      email: "Email *",
      role: "Rol",
      status: "Estado",
      department: "Departamento",
    },
    namePlaceholder: "Nombre completo",
    emailPlaceholder: "usuario@empresa.com",
    departmentPlaceholder: "p. ej. Diseño, Desarrollo, Estrategia",
    errors: { nameRequired: "El nombre es obligatorio", emailRequired: "El email es obligatorio" },
    saving: "Guardando...",
    create: "Crear usuario",
    update: "Actualizar usuario",
    toasts: {
      created: "Usuario creado",
      updated: "Usuario actualizado",
      saveError: "No se pudo guardar el usuario",
    },
  },
}
