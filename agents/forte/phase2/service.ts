import {
  getAvailableForteCapabilities,
  getAvailableForteCapabilitiesForContext,
  getFortePhase1Catalog,
  getFortePhase1CatalogForContext,
  recommendForteArchitecture,
} from "../phase1"
import type { ForteContext } from "../runtime"
import {
  forteRecommendationExampleRequest,
  type ForteRecommendationApiResponse,
  type ForteRecommendationRequest,
  type ForteRecommendationSurfaceInfo,
} from "./contracts"

function getCatalogSummary() {
  const catalog = getFortePhase1Catalog()
  return {
    modules: catalog.modules.length,
    engines: catalog.engines.length,
    tools: catalog.tools.length,
  }
}

function getCatalogSummaryFromCatalog(catalog: ReturnType<typeof getFortePhase1Catalog>) {
  return {
    modules: catalog.modules.length,
    engines: catalog.engines.length,
    tools: catalog.tools.length,
  }
}

function getProvisionalNotes() {
  return {
    usesPilotManifests: true,
    usesPhase1Profiles: true,
    notes: [
      "La lectura del registry ya es real, pero la cobertura de manifests sigue siendo parcial.",
      "Algunos modulos se describen todavia con perfiles controlados de phase 1 mientras llega metadata canonica adicional.",
      "Esta superficie recomienda arquitectura; no activa modulos ni provisiona runtime.",
    ],
  }
}

export async function buildForteRecommendationResponse(
  request: ForteRecommendationRequest,
  context?: ForteContext,
): Promise<ForteRecommendationApiResponse> {
  const catalog = context
    ? await getFortePhase1CatalogForContext(context)
    : getFortePhase1Catalog()
  const availableCapabilities = context
    ? await getAvailableForteCapabilitiesForContext(context)
    : getAvailableForteCapabilities()

  return {
    recommendation: recommendForteArchitecture(request.business, catalog),
    availableCapabilities,
    catalogSummary: getCatalogSummaryFromCatalog(catalog),
    provisional: getProvisionalNotes(),
  }
}

export async function getForteRecommendationSurfaceInfo(
  context?: ForteContext,
): Promise<ForteRecommendationSurfaceInfo> {
  const catalog = context
    ? await getFortePhase1CatalogForContext(context)
    : getFortePhase1Catalog()
  const availableCapabilities = context
    ? await getAvailableForteCapabilitiesForContext(context)
    : getAvailableForteCapabilities()

  return {
    endpoint: "/api/forte/recommend",
    method: "POST",
    requestSchema: "ForteRecommendationRequest",
    responseSchema: "ForteRecommendationApiResponse",
    exampleRequest: forteRecommendationExampleRequest,
    availableCapabilities,
    catalogSummary: getCatalogSummaryFromCatalog(catalog),
    provisional: getProvisionalNotes(),
  }
}
