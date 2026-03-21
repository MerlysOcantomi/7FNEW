import { manifest as usuariosManifest } from "@modules/usuarios/manifest"
import { manifest as aiEngineManifest } from "@engines/ai/manifest"
import { manifest as scanToolManifest } from "@tools/scan.manifest"
import { registry } from "./module-registry"

export const pilotModuleManifests = [usuariosManifest]
export const pilotEngineManifests = [aiEngineManifest]
export const pilotToolManifests = [scanToolManifest]

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

  return registry.stats
}

export function registerPilotManifests() {
  return ensurePilotManifestsRegistered()
}
