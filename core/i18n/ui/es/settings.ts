import type { SettingsMessages } from "../types"

/**
 * Spanish source for the `settings` UI namespace — fully translated (P4.1
 * scope: language controls, Account Center chrome, Administración chrome).
 * Same typed contract as English; a missing key is a compile error.
 *
 * Terminology: `Workspace.config.locale` is presented to operators as
 * "Idioma del negocio" (the business language) — clearer for salon owners
 * than the technical "workspace" framing, and consistent with the
 * "Usar el idioma del negocio" action.
 */
export const settings: SettingsMessages = {
  title: "Ajustes",
  language: {
    appLabel: "Idioma de la aplicación",
    appDescription: "Se usa en tu interfaz personal de 7F.",
    workspaceLabel: "Idioma del negocio",
    workspaceDescription:
      "Se usa en mensajes a clientes, emails, portal y valores predeterminados del workspace.",
    followingDefault: "Sin preferencia personal — sigues el idioma del negocio.",
    useWorkspaceLanguage: "Usar el idioma del negocio",
    clearedToast: "Ahora sigues el idioma del negocio",
    updatedToast: "Idioma de la aplicación actualizado",
    updateErrorTitle: "No se pudo guardar tu idioma",
    updateErrorBody: "Inténtalo de nuevo.",
    workspaceUpdatedToast: "Idioma del negocio actualizado",
    workspaceUpdateErrorTitle: "No se pudo guardar el idioma del negocio",
    workspaceReadOnly: "Solo los administradores del workspace pueden cambiarlo.",
  },
  accountCenter: {
    workspacesSection: "Workspaces",
    currentWorkspace: "Workspace actual",
    youAreHere: "Estás aquí",
    switchWorkspace: "Cambiar de workspace",
    noOtherWorkspaces: "No hay otros workspaces disponibles",
    workspacesLoadError: "No se pudieron cargar los workspaces. Vuelve a abrir el panel.",
    loadingWorkspace: "Cargando workspace…",
    noActiveWorkspace: "Sin workspace activo",
    platformSection: "Plataforma",
    platformDescription: "Plano de control (no es un workspace)",
    settingsSection: "Ajustes",
    languageSection: "Idioma",
    appearanceSection: "Apariencia",
    appearanceNote:
      "Midnight es el tema predeterminado. Lavender Mist es un tema claro en desarrollo — algunas zonas pueden mostrar todavía estilos oscuros.",
    comingSoon: "Pronto",
    signOut: "Cerrar sesión",
    signOutDescription: "Cierra la sesión en este dispositivo",
    items: {
      workspaceSettings: {
        label: "Ajustes del workspace",
        description: "Configuración general del workspace",
      },
      members: { label: "Miembros", description: "Invitaciones y roles del equipo" },
      planUsage: { label: "Plan y consumo", description: "Plan actual, consumo y facturación" },
      profile: { label: "Mi perfil", description: "Datos personales y preferencias" },
      security: {
        label: "Seguridad de la cuenta",
        description: "Sesiones activas y autenticación",
      },
    },
  },
  adminPage: {
    eyebrow: "Ajustes",
    title: "Ajustes del workspace",
    subtitle:
      "Revisa las capacidades principales, los packs opcionales y las mejoras avanzadas de este workspace.",
    adminOnlyNotice: "Necesitas acceso de administrador o propietario para cambiar los ajustes.",
    emailChannelsLink: "Canales de email",
    emailChannelsNote: "— buzones IMAP/SMTP de este workspace.",
  },
}
