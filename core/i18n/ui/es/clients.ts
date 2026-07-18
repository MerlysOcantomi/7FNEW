import type { ClientsMessages } from "../types"

/**
 * Spanish source for the `clients` UI namespace — really translated (P4.3).
 * Noun args arrive LOWERCASE from the vocabulary composition; this file
 * capitalizes where Spanish grammar needs it. Structure words use the
 * standard masculine agreement (product decision: neutral Cliente/Clientes);
 * a feminine workspace override keeps the standard structure words —
 * documented limitation.
 */
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

export const clients: ClientsMessages = {
  nouns: {
    client: "cliente",
    clients: "clientes",
    project: "proyecto",
    projects: "proyectos",
    invoices: "facturas",
  },
  status: {
    active: "Activo",
    inactive: "Inactivo",
    prospect: "Prospecto",
  },
  list: {
    eyebrow: "Core",
    newButton: ({ client }) => `Nuevo ${client}`,
    searchPlaceholder: ({ clients }) => `Buscar ${clients}, empresa o email...`,
    sectionAll: ({ clients }) => `Todos los ${clients}`,
    count: (count, { client, clients }) => `${count} ${count === 1 ? client : clients}`,
    statusFilterLabel: "Estado",
    filters: { all: "Todos", active: "Activos", inactive: "Inactivos", prospect: "Prospectos" },
    stats: {
      total: "Total",
      activeSub: "Con actividad",
      prospects: "Prospectos",
      prospectsSub: "Por convertir",
      inactiveSub: "Sin actividad",
    },
    columns: { company: "Empresa", contact: "Contacto", status: "Estado", updated: "Actualizado" },
    rowActionsAria: ({ client }) => `Acciones del ${client}`,
    rowView: ({ client }) => `Ver ${client}`,
    view: "Ver",
    updated: (date) => `Actualizado ${date}`,
    loadError: ({ clients }) => `No se pudieron cargar los ${clients}`,
    empty: {
      title: ({ clients }) => `No hay ${clients} todavía`,
      bodyDefault: ({ client }) => `Crea tu primer ${client} para empezar.`,
      bodyFiltered: "Sin resultados para los filtros seleccionados.",
    },
  },
  detail: {
    breadcrumbRoot: "Core",
    tabs: { summary: "Resumen", activity: "Actividad" },
    snapshot: {
      activeProjects: ({ projects }) => `${cap(projects)} activos`,
      billedRevenue: "Ingresos facturados",
      outstandingInvoices: ({ invoices }) => `${cap(invoices)} pendientes`,
      clientSince: ({ client }) => `${cap(client)} desde`,
    },
    profile: ({ client }) => `Perfil del ${client}`,
    company: "Empresa",
    noNotes: "Sin notas.",
    projectsSection: ({ client, projects }) => `${cap(projects)} del ${client}`,
    projectsEmptyTitle: ({ client, projects }) => `No hay ${projects} de este ${client}`,
    projectsEmptyBody: ({ client, projects }) =>
      `Los ${projects} vinculados a este ${client} aparecerán aquí.`,
    newProject: ({ project }) => `Nuevo ${project}`,
    invoicesSection: ({ client, invoices }) => `${cap(invoices)} del ${client}`,
    invoicesEmptyTitle: ({ client, invoices }) => `No hay ${invoices} de este ${client}`,
    invoicesEmptyBody: ({ client }) => `Todo lo facturado a este ${client} aparecerá aquí.`,
    openBilling: ({ invoices }) => `Abrir ${invoices}`,
    due: (date) => `Vence ${date}`,
    invoiceColumns: { amount: "Importe", dueDate: "Vencimiento", status: "Estado" },
    notesSection: "Notas",
    notesEmptyTitle: "No hay notas",
    notesEmptyBody: ({ client }) => `Las notas vinculadas a este ${client} aparecerán aquí.`,
    activitySection: "Actividad reciente",
    activityEmptyTitle: "Sin actividad registrada",
    activityEmptyBody: ({ client }) => `Los cambios en este ${client} se mostrarán aquí.`,
    activityFallback: { created: "Creado", updated: "Actualizado", system: "Sistema", note: "Nota" },
    viewBilling: ({ invoices }) => `Ver ${invoices}`,
    errors: {
      invalidId: ({ client }) => `ID de ${client} no válido`,
      notFound: ({ client }) => `${cap(client)} no encontrado`,
      backToList: ({ clients }) => `Volver a ${clients}`,
    },
  },
  form: {
    titleNew: ({ client }) => `Nuevo ${client}`,
    titleEdit: ({ client }) => `Editar ${client}`,
    identityTitle: ({ client }) => `Identidad del ${client}`,
    identityDesc: ({ client }) => `Información principal para identificar la ficha del ${client}.`,
    contactTitle: "Datos de contacto",
    contactDesc: ({ client }) => `Cómo contactar con el ${client}.`,
    billingTitle: "Preferencias de cobro",
    billingDesc: ({ client }) => `Ajustes básicos de pago de este ${client}.`,
    notesTitle: "Notas",
    notesDesc: "Contexto interno útil para el equipo.",
    fields: {
      id: ({ client }) => `ID del ${client}`,
      idAuto: "Se genera automáticamente al guardar",
      name: "Nombre",
      namePlaceholder: ({ client }) => `Nombre del ${client}`,
      company: "Empresa",
      companyPlaceholder: "Empresa o razón social",
      status: "Estado",
      email: "Email",
      emailPlaceholder: "nombre@empresa.com",
      phone: "Teléfono",
      phonePlaceholder: "+34 600 123 456",
      paymentMethod: "Método de pago preferido",
      currency: "Moneda",
      notesPlaceholder: ({ client }) => `Añade notas relevantes sobre este ${client}...`,
    },
    payment: { cash: "Efectivo", transfer: "Transferencia bancaria", card: "Tarjeta" },
    saving: "Guardando...",
    create: ({ client }) => `Crear ${client}`,
    update: ({ client }) => `Actualizar ${client}`,
    toastCreated: ({ client }) => `${cap(client)} creado`,
    toastUpdated: ({ client }) => `${cap(client)} actualizado`,
    toastSaveError: ({ client }) => `No se pudo guardar el ${client}`,
    nameRequired: "El nombre es obligatorio",
  },
}
