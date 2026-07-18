import type { TodayMessages } from "../types"

/**
 * Spanish source for the `today` UI namespace — really translated (P4.2):
 * the shell's Today trigger/chrome consumes `title` and `chrome`, and the
 * page-level strings are small enough to carry their real translation now.
 */
export const today: TodayMessages = {
  title: "Hoy",
  empty: {
    title: "Nada para hoy todavía",
    body: "Los nuevos elementos aparecerán aquí a medida que lleguen.",
  },
  chrome: {
    openFull: "Abrir Hoy completo",
    close: "Cerrar Hoy",
  },
}
