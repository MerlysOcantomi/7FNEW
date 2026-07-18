import type { VoiceMessages } from "../types"

/** Etiquetas de voz de Ask Finesse — contribución española completa. */
export const voice: VoiceMessages = {
  micStart: "Hablar con Finesse",
  micUnsupported: "La voz necesita micrófono y un navegador seguro; el texto sigue funcionando con normalidad.",
  stop: "Terminar voz",
  interrupt: "Cortar respuesta",
  mute: "Silenciar micrófono",
  unmute: "Activar micrófono",
  states: {
    connecting: "Conectando",
    listening: "Te escucho",
    thinking: "Pensando",
    speaking: "Hablando",
    interrupted: "Interrumpida",
    stopping: "Terminando",
    expired: "Sesión finalizada",
    error: "Error de voz",
  },
  micBlocked: "El micrófono está bloqueado. Actívalo en tu navegador y vuelve a intentarlo.",
  micUnavailableDevice: "No encontramos un micrófono disponible. Conecta uno y vuelve a intentarlo.",
  unavailable: "La voz no está disponible ahora mismo. El texto sigue funcionando con normalidad.",
  rateLimited: "Demasiados intentos de voz. Espera un momento y vuelve a intentarlo.",
  sessionEnded: "Sesión de voz finalizada. Toca el micrófono para volver a hablar.",
  contextChanged: "Has cambiado de página — reinicia la voz para hablar de esta pantalla.",
  interruptedMarker: "interrumpida",
  holdToTalk: "Mantén pulsado para hablar",
  voiceStatusRegion: "Estado de la voz",
}
