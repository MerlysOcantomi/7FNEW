import type { EngineManifest } from "@core/registry"

/**
 * Sevenef Presence engine manifest (FOUNDATION).
 *
 * Registers Presence as a shared engine in the 7F registry. `extensionPoints`
 * declares the Freya provider seam so AI providers can be plugged in later
 * WITHOUT a mandatory vendor dependency (the default providers are heuristic).
 */
export const manifest: EngineManifest = {
  id: "presence",
  name: "Sevenef Presence",
  description:
    "Shared engine to build and publish business websites. Data isolated by workspaceId, config in DB, files in external storage.",
  version: "0.1.0",
  kind: "engine",
  namespace: "engine.presence",
  dependencies: [],
  provides: [
    "presence.sites",
    "presence.sections",
    "presence.templates",
    "presence.publish",
    "presence.media",
  ],
  optional: true,
  extensionPoints: [
    {
      id: "freya.style-provider",
      description:
        "Proposes site styles from the Business Profile. Default is a deterministic heuristic provider; an AI provider can be swapped in.",
      interface: "engines/presence/freya#FreyaStyleProvider",
    },
    {
      id: "freya.media-provider",
      description:
        "Assesses photos and declares technical variants. Default is heuristic; preserves the integrity of real work samples.",
      interface: "engines/presence/freya#FreyaMediaProvider",
    },
  ],
}
