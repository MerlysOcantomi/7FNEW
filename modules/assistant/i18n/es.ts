/**
 * Ask Finesse — Spanish catalog (España, tuteo — same convention as the
 * Beauty configs). Neutral Cliente/Clientes per product decision — the
 * `Clienta/Clientas` vocabulary is banned from catalogs.
 */

import type { FinesseAssistantMessages } from "./types"

export const es = {
  locale: "es",
  launcherLabel: "Preguntar a Finesse",
  launcherAria: "Preguntar a Finesse, tu asistente de negocio",
  panelTitle: "Finesse",
  panelSubtitle: "beauty intelligence · by Sevenef",
  contextLead: "Estás en",
  pageLabels: {
    "my-salon": "Mi salón",
    today: "Hoy",
    agenda: "Agenda",
    clients: "Clientes",
    messages: "Mensajes",
    catalog: "Servicios",
    marketing: "Marketing",
    billing: "Cobros",
    team: "Equipo",
    settings: "Ajustes",
    other: "7F Beauty",
  },
  intros: {
    "my-salon": "Puedo explicarte cómo va tu salón este periodo y qué puedes mejorar.",
    today: "Puedo ayudarte a organizar tu día y decidir qué hacer primero.",
    agenda: "Puedo ayudarte con tus citas, huecos libres y horas punta.",
    clients: "Puedo ayudarte a cuidar a tus clientes y detectar quién necesita atención.",
    messages: "Puedo ayudarte a poner orden en tus conversaciones.",
    catalog: "Puedo ayudarte a entender qué servicios funcionan mejor.",
    marketing: "Puedo darte ideas para tu contenido y campañas.",
    billing: "Puedo ayudarte con tus cobros y facturas pendientes.",
    team: "Puedo ayudarte a organizar el trabajo de tu equipo.",
    settings: "Puedo ayudarte a configurar tu espacio de trabajo.",
    other: "Pregúntame lo que necesites sobre tu negocio.",
  },
  suggestionsTitle: "Sugerencias",
  composerPlaceholder: "Escribe tu pregunta…",
  send: "Enviar",
  close: "Cerrar",
  thinking: "Finesse está pensando…",
  unavailable: {
    title: "Finesse aún no está conectada.",
    description:
      "El asistente estará disponible cuando se conecte el servicio de IA. Todo lo demás de tu espacio sigue funcionando con normalidad.",
  },
  error: {
    title: "No he podido responder ahora mismo.",
    retry: "Vuelve a intentarlo en unos segundos.",
  },
  honestyNote:
    "Finesse responde con la información visible en tu espacio. Todavía no ejecuta acciones por ti.",
  emptyConversation: "Elige una sugerencia o escribe tu pregunta.",
  staticSuggestions: {
    "my-salon": [
      "Explícame este periodo",
      "¿Por qué cambiaron mis ingresos?",
      "¿Qué clientes deberían volver?",
      "¿Cómo puedo mejorar el próximo mes?",
    ],
    today: ["¿Qué hago primero?", "Resume mi día", "¿Qué necesita mi atención?"],
    agenda: [
      "Busca hueco libre mañana",
      "¿Cuáles son mis horas punta?",
      "¿Dónde caben dos citas más?",
    ],
    clients: [
      "¿A quién debería volver a contactar?",
      "¿Qué clientes no han vuelto?",
      "Muéstrame mis clientes más fieles",
    ],
    messages: [
      "Resume las conversaciones pendientes",
      "¿Qué mensajes necesitan respuesta?",
    ],
    catalog: ["¿Qué servicio funciona mejor?", "¿Qué debería promocionar?"],
    marketing: [
      "Crea una publicación",
      "Sugiéreme una campaña",
      "Usa mi último trabajo",
      "Ayúdame a llenar huecos libres",
    ],
    billing: ["¿Qué cobros tengo pendientes?", "Resume mis ingresos del periodo"],
    team: ["¿Cómo va el trabajo del equipo?"],
    settings: ["¿Qué me falta por configurar?"],
    other: ["¿Cómo va mi negocio?", "¿Qué necesita mi atención hoy?"],
  },
  dynamicSuggestions: {
    overview: {
      firstPeriod: {
        label: "¿Qué vigilo en mi primer mes?",
        prompt:
          "Es mi primer periodo con datos, sin comparativa anterior. ¿Qué señales debería vigilar durante mi primer mes?",
      },
      earningsDrop: {
        label: "¿Por qué bajaron mis ingresos?",
        prompt:
          "Mis ingresos han bajado respecto al periodo anterior. ¿Qué pudo causar la caída y qué puedo hacer?",
      },
      earningsGrowth: {
        label: "¿Qué impulsó el crecimiento?",
        prompt:
          "Mis ingresos han crecido respecto al periodo anterior. ¿Qué impulsó ese crecimiento y cómo lo mantengo?",
      },
      weakRebooking: {
        label: "¿Qué clientes deberían volver?",
        prompt:
          "Mi tasa de re-reserva está floja. ¿Qué clientes deberían volver pronto y cómo los contacto?",
      },
      pendingPayments: {
        label: "¿Qué cobros necesitan atención?",
        prompt:
          "Tengo cobros pendientes de visitas ya completadas. ¿Cuáles debería atender primero?",
      },
      peakAvailability: {
        label: "¿Cómo libero mi día punta?",
        prompt:
          "Mi día más ocupado está casi completo. ¿Cómo puedo crear más disponibilidad sin perder clientes?",
      },
    },
    today: {
      fillGaps: {
        label: "¿Cómo lleno los huecos de hoy?",
        prompt: (count) =>
          `Hoy tengo ${count} hueco(s) libre(s) en la agenda. ¿Cómo puedo llenarlos?`,
      },
      firstMove: {
        label: "¿Qué hago primero?",
        prompt: (count) =>
          `Tengo ${count} citas hoy. ¿Qué debería hacer primero para que el día salga bien?`,
      },
      summary: {
        label: "Resume mi día",
        prompt: "Resume mi día de hoy: citas, huecos y lo que necesita mi atención.",
      },
    },
    agenda: {
      fillTomorrow: {
        label: "¿Cómo lleno los huecos de mañana?",
        prompt: (count) => `Mañana tengo ${count} hueco(s) libre(s). ¿Cómo puedo llenarlos?`,
      },
      pendingConfirmation: {
        label: "¿Qué citas faltan por confirmar?",
        prompt: (count) =>
          `Tengo ${count} cita(s) sin confirmar. ¿Cuáles debería confirmar primero?`,
      },
      cancelledSlot: {
        label: "¿Qué hago con el hueco cancelado?",
        prompt: "Se ha cancelado una cita hoy. ¿Qué puedo hacer con ese hueco?",
      },
      fitUrgent: {
        label: "¿Dónde cabe una cita urgente?",
        prompt:
          "Mi día está casi completo. ¿Dónde podría encajar una cita urgente sin desordenar la agenda?",
      },
    },
    clients: {
      selectedSummary: {
        label: "Resume su historial reciente",
        prompt:
          "Resume el historial reciente de este cliente: visitas, servicios y cualquier señal a vigilar.",
      },
      selectedContact: {
        label: "¿Debería volver a contactarle?",
        prompt: "¿Debería volver a contactar a este cliente? ¿Cuándo y con qué mensaje?",
      },
      overdueRebooking: {
        label: "¿A quién contacto esta semana?",
        prompt: (count) =>
          `Hay ${count} clientes que llevan tiempo sin volver. ¿A quiénes debería contactar esta semana y cómo?`,
      },
    },
    messages: {
      selectedSummary: {
        label: "Resume esta conversación",
        prompt: "Resume esta conversación y dime si queda algo pendiente de responder.",
      },
      needReply: {
        label: "¿Qué mensajes respondo primero?",
        prompt: (count) =>
          `Tengo ${count} mensaje(s) sin responder. ¿Cuáles debería responder primero?`,
      },
    },
    marketing: {
      postLatestWork: {
        label: "Crea un post con mi último trabajo",
        prompt:
          "Tengo fotos de trabajos recientes sin usar. ¿Cómo preparo una publicación con el último trabajo?",
      },
      noMedia: {
        label: "¿Qué contenido creo hoy?",
        prompt:
          "Todavía no tengo fotos subidas. ¿Qué contenido debería crear hoy para mi salón?",
      },
      reviewReady: {
        label: "¿Qué publico primero?",
        prompt: (count) =>
          `Tengo ${count} publicación(es) preparadas. ¿Cuál debería revisar y publicar primero?`,
      },
    },
    billing: {
      followUp: {
        label: "¿Qué cobros persigo primero?",
        prompt: "Tengo cobros pendientes. ¿Cuáles debería perseguir primero y cómo?",
      },
      collectionHealth: {
        label: "¿Cómo va mi cobro?",
        prompt:
          "No tengo cobros vencidos ahora mismo. ¿Cómo va mi ritmo de cobro en general?",
      },
      revenueChange: {
        label: "Explica los ingresos del periodo",
        prompt:
          "Mis ingresos han cambiado respecto al periodo anterior. Explícame ese cambio.",
      },
    },
  },
} satisfies FinesseAssistantMessages
