import {
  getAvailableForteCapabilities,
  getFortePhase1Catalog,
  recommendForteArchitecture,
} from "../phase1"
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

export function buildForteRecommendationResponse(
  request: ForteRecommendationRequest,
): ForteRecommendationApiResponse {
  return {
    recommendation: recommendForteArchitecture(request.business),
    availableCapabilities: getAvailableForteCapabilities(),
    catalogSummary: getCatalogSummary(),
    provisional: getProvisionalNotes(),
  }
}

export function getForteRecommendationSurfaceInfo(): ForteRecommendationSurfaceInfo {
  return {
    endpoint: "/api/forte/recommend",
    method: "POST",
    requestSchema: "ForteRecommendationRequest",
    responseSchema: "ForteRecommendationApiResponse",
    exampleRequest: forteRecommendationExampleRequest,
    availableCapabilities: getAvailableForteCapabilities(),
    catalogSummary: getCatalogSummary(),
    provisional: getProvisionalNotes(),
  }
}
