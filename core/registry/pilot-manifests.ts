import { manifest as usuariosManifest } from "@modules/usuarios/manifest"
import { manifest as inboxManifest } from "@modules/inbox/manifest"
import { manifest as clientesManifest } from "@modules/clientes/manifest"
import { manifest as proyectosManifest } from "@modules/proyectos/manifest"
import { manifest as tareasManifest } from "@modules/tareas/manifest"
import { manifest as facturacionManifest } from "@modules/facturacion/manifest"
import { manifest as finanzasManifest } from "@modules/finanzas/manifest"
import { manifest as calendarioManifest } from "@modules/calendario/manifest"
import { manifest as contenidoManifest } from "@modules/contenido/manifest"
import { manifest as campanasManifest } from "@modules/campanas/manifest"
import { manifest as documentosManifest } from "@modules/documentos/manifest"
import { manifest as notasManifest } from "@modules/notas/manifest"
import { manifest as automatizacionesManifest } from "@modules/automatizaciones/manifest"
import { manifest as aiEngineManifest } from "@engines/ai/manifest"
import { manifest as presenceEngineManifest } from "@engines/presence/manifest"
import { manifest as scanToolManifest } from "@tools/scan.manifest"
import { manifest as fannyManifest } from "@/agents/fanny/manifest"
import { manifest as freyaManifest } from "@/agents/freya/manifest"
import { registry } from "./module-registry"

export const pilotModuleManifests = [
  usuariosManifest,
  inboxManifest,
  clientesManifest,
  proyectosManifest,
  tareasManifest,
  facturacionManifest,
  finanzasManifest,
  calendarioManifest,
  contenidoManifest,
  campanasManifest,
  documentosManifest,
  notasManifest,
  automatizacionesManifest,
]
export const pilotEngineManifests = [aiEngineManifest, presenceEngineManifest]
export const pilotToolManifests = [scanToolManifest]
export const pilotAgentManifests = [fannyManifest, freyaManifest]

/**
 * Manual-only pilot registration.
 *
 * This helper is intentionally opt-in and is not imported by application
 * runtime entrypoints. It exists only to validate the current registry
 * contract with a few real examples.
 */
export function ensurePilotManifestsRegistered() {
  for (const manifest of pilotEngineManifests) {
    if (!registry.getEngine(manifest.id)) {
      registry.registerEngine(manifest)
    }
  }

  for (const manifest of pilotToolManifests) {
    if (!registry.getTool(manifest.id)) {
      registry.registerTool(manifest)
    }
  }

  for (const manifest of pilotModuleManifests) {
    if (!registry.getModule(manifest.id)) {
      registry.registerModule(manifest)
    }
  }

  for (const manifest of pilotAgentManifests) {
    if (!registry.getAgent(manifest.id)) {
      registry.registerAgent(manifest)
    }
  }

  return registry.stats
}

export function registerPilotManifests() {
  return ensurePilotManifestsRegistered()
}
