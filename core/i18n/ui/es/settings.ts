import type { SettingsMessages } from "../types"

/**
 * Spanish source for the `settings` UI namespace — fully translated (P4.1
 * scope: language controls, Account Center chrome, Administración chrome).
 * Same typed contract as English; a missing key is a compile error.
 *
 * Terminology: `Workspace.config.locale` is presented to operators as
 * "Idioma del negocio" (the business language) — clearer for salon owners
 * than the technical "workspace" framing. It governs customer-facing output
 * only; the personal interface follows User.locale → browser → English.
 */
export const settings: SettingsMessages = {
  title: "Ajustes",
  language: {
    appLabel: "Idioma de la aplicación",
    appDescription: "Se usa en tu interfaz personal de 7F.",
    workspaceLabel: "Idioma del negocio",
    workspaceDescription:
      "Se usa en mensajes a clientes, emails, portal y contenido público. Nunca cambia lo que ve cada miembro del equipo en la aplicación.",
    followingDefault: "Sin preferencia personal — sigues el idioma de tu navegador.",
    useDeviceLanguage: "Usar el idioma de mi dispositivo",
    clearedToast: "Ahora sigues el idioma de tu dispositivo",
    updatedToast: "Idioma de la aplicación actualizado",
    updateErrorTitle: "No se pudo guardar tu idioma",
    updateErrorBody: "Inténtalo de nuevo.",
    workspaceUpdatedToast: "Idioma del negocio actualizado",
    workspaceUpdateErrorTitle: "No se pudo guardar el idioma del negocio",
    workspaceReadOnly: "Solo los administradores del workspace pueden cambiarlo.",
    inProgressNote: "Traducción en progreso. Algunas áreas todavía pueden aparecer en inglés.",
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
      businessProfile: {
        label: "Perfil del negocio",
        description: "Identidad, servicios y contexto del negocio",
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
  businessProfilePage: {
    title: "Perfil del negocio",
    description:
      "Define la identidad de tu negocio. Este contexto ayuda a Fanny y a otros agentes a entender quién eres y qué ofreces.",
    loading: "Cargando perfil...",
    loadError: "No se pudo cargar el perfil del negocio",
    saveError: "No se pudo guardar el perfil",
    save: "Guardar perfil",
    saving: "Guardando...",
    saved: "Guardado",
    add: "Añadir",
    tabs: {
      profile: "Perfil",
      channels: "Canales",
      aria: "Secciones del perfil del negocio",
    },
    operatingContext: {
      title: "Contexto operativo",
      description:
        "Reglas que Fanny debe tener en cuenta al clasificar, resumir y sugerir trabajo. Ejemplos: las preguntas sobre pagos requieren revisión, las quejas urgentes necesitan atención del equipo, los nuevos leads deben recibir una tarea de seguimiento.",
    },
    fields: {
      businessName: {
        label: "Nombre del negocio",
        hint: "Cómo conocen tus clientes tu negocio",
        placeholder: "p. ej. Skina Studio",
      },
      businessDescription: {
        label: "Descripción",
        hint: "Breve descripción de lo que hace tu negocio",
        placeholder: "p. ej. Estudio de diseño web, branding y desarrollo digital",
      },
      services: {
        label: "Servicios",
        hint: (max) => `Lo que ofrece tu negocio (máx. ${max})`,
        placeholder: "Añadir un servicio...",
        removeAria: (name) => `Quitar ${name}`,
      },
      tone: {
        label: "Tono",
        hint: "Cómo deben comunicarse los agentes en nombre de tu negocio",
        placeholder: "p. ej. profesional, cercano y directo",
      },
      languages: {
        label: "Idiomas",
        hint: "Idiomas en los que trabaja tu negocio",
        placeholder: "Añadir un idioma...",
        removeAria: (name) => `Quitar ${name}`,
      },
      region: {
        label: "Región o mercado",
        hint: "Dónde trabajas principalmente o a qué público atiendes",
        placeholder: "p. ej. España y LATAM, DACH, remoto internacional",
      },
      workingHours: {
        label: "Horario de atención",
        hint: "Cuándo pueden esperar una respuesta tus clientes",
        placeholder: "p. ej. L–V 9:00–18:00 CET; urgencias solo por teléfono",
      },
      attentionRules: {
        label: "Reglas de atención",
        hint: (max) => `Indicaciones breves sobre cómo tratar determinados mensajes (máx. ${max})`,
        placeholder: "Añadir una regla...",
        removeAria: (rule) => `Quitar regla: ${rule}`,
      },
    },
  },
  businessProfileChannelsPage: {
    title: "Canales",
    description:
      "Por dónde pueden contactar los clientes con tu negocio y qué identidad ve cada canal. Las conversaciones del día a día viven en el Inbox.",
    loading: "Cargando canales...",
    loadError: "No se pudieron cargar tus canales",
    retry: "Reintentar",
    groups: {
      connected: {
        title: "Canales conectados",
        description: "Activos ahora: los mensajes llegan a tu Inbox.",
      },
      actionable: {
        title: "Listos para conectar",
        description: "Canales que puedes configurar ahora o que necesitan tu atención.",
      },
      future: {
        title: "Más canales",
        description: "Aún no disponibles: no hay nada que configurar hasta que llegue cada integración.",
      },
    },
    status: {
      connected: "Conectado",
      available: "Listo para conectar",
      setup_required: "Completar configuración",
      pending: "Pendiente",
      error: "Error de conexión",
      plan_locked: "No incluido en tu plan",
      coming_soon: "Próximamente",
      disabled: "Desactivado",
    },
    channelDescriptions: {
      email: "Envía y recibe correo desde la dirección de tu negocio",
      web_chat: "Chatea con las visitas de tu web",
      portal: "Conversaciones con clientes desde su portal",
      whatsapp: "Escribe con tus clientes por WhatsApp",
      instagram: "Responde los mensajes directos de Instagram",
      messenger: "Responde los mensajes de Facebook Messenger",
      tiktok: "Responde los mensajes directos de TikTok",
      sms: "Mensajes de texto a números de teléfono",
    },
    actions: {
      connect_email: "Conectar correo",
      manage_email_connections: "Gestionar cuentas",
      connect_another_email: "Conectar otro correo",
      review_email_connection: "Revisar conexión",
      activate_web_chat: "Activar chat web",
      enable_web_chat_reception: "Activar recepción",
      disable_web_chat_reception: "Desactivar recepción",
      open_inbox: "Abrir Inbox",
    },
    emailAccounts: {
      title: "Cuentas de correo",
      connectedCount: (count) =>
        count === 1 ? "1 cuenta conectada" : `${count} cuentas conectadas`,
      primaryBadge: "Cuenta principal",
      providerLabel: "Proveedor",
      demoBadge: "Cuenta de demostración",
    },
    identityLabel: "Identidad",
    receiving: "Recibe",
    sending: "Envía",
    lastSync: (formatted) => `Última sincronización ${formatted}`,
    errorLabel: "Error",
    planNote: (used, max) => `${used} de ${max} canales incluidos en tu plan en uso`,
    planLockedHint:
      "El límite de canales de tu plan ya está en uso. Libera un canal para conectar este.",
    comingSoonHint:
      "Esta integración aún no está disponible. Podrás configurarla aquí cuando esté lista.",
    recommendedBadge: "Recomendado",
    webChat: {
      visitorNameLabel: "Nombre que ven las visitas",
      inboxNote: "Los mensajes de las visitas llegan a tu Inbox como conversaciones de Chat web.",
      updateError: "No se pudo actualizar la recepción del chat web",
      snippetLabel: "Código de instalación",
      snippetHint:
        "Pega este código antes de la etiqueta de cierre </body> de tu web. La burbuja de chat aparece en cada página que lo incluya.",
      copySnippet: "Copiar código",
      snippetCopied: "Copiado",
      activateHint:
        "La activación marca el canal como operativo para tu negocio. Los mensajes de las visitas llegan a tu Inbox y tus respuestas aparecen en el chat de la visita.",
    },
    showDetails: (channel) => `Mostrar detalles de ${channel}`,
    hideDetails: (channel) => `Ocultar detalles de ${channel}`,
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
