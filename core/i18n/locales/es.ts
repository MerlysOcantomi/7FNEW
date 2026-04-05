import type { TranslationSet } from "../types"

export const es: TranslationSet = {
  locale: "es",
  label: "Español",

  email: {
    ack: {
      heading: "Recibimos tu mensaje y nuestro equipo se pondrá en contacto contigo pronto.",
      body: "No es necesario responder a este correo. Te contactaremos directamente.",
      subjectLabel: "Asunto",
      greeting: (name) => (name ? `Hola ${name},` : "Hola,"),
    },
    outbound: {
      footer: (ws) => `Enviado desde Smart Inbox — ${ws}`,
      defaultSubject: "Nuevo mensaje",
    },
    poweredBy: "Desarrollado por 7F",
    sentVia: "Enviado vía 7F",
  },

  activity: {
    created: "Creado",
    updated: "Actualizado",
    deleted: "Eliminado",
    status_change: "Cambio de estado",
    assigned: "Asignado",
    unassigned: "Desasignado",
    comment: "Comentario",
    mention: "Mención",
    email_sent: "Correo enviado",
    email_failed: "Error de correo",
    email_skipped: "Correo omitido",
  },

  notifications: {
    inbox: {
      newConversation: (who) => `Nueva conversación de ${who}`,
      newConversationFallback: "Nueva conversación",
      newMessage: (who) => `Nuevo mensaje de ${who}`,
      newMessageFallback: "Nuevo mensaje",
      assigned: "Te han asignado una conversación",
      assignedFallback: "Conversación asignada",
      contactWebChat: "Visitante web",
      contactEmail: "Contacto email",
      contactDefault: "Contacto",
    },
  },

  common: {
    subject: "Asunto",
    message: "Mensaje",
    noReply: "No es necesario responder",
    hi: "Hola",
    thankYou: "Gracias",
    regards: "Saludos",
  },
}
