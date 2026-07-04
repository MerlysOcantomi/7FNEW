/**
 * Vertical specialist agents.
 *
 * Each vertical adds ONE specialist agent that LEADS that vertical's experience
 * without replacing the 7 core agents (Francis, Mr. Forte, Fanny, Freya, Fiona,
 * Felix, Fathom). For Beauty the specialist is Finesse — "7F Beauty, powered by
 * Finesse". Finesse contextualizes and coordinates the Beauty experience and can
 * be the primary voice on Beauty surfaces (header, Hoy, panels), but every
 * action that belongs to a core agent still shows that agent (Fanny detected 3
 * messages, Freya can create a story, Felix can prepare the charge, …).
 *
 * This is pure data + a pure resolver (mirrors `resolveNavProfile`): it imports
 * only the vertical-key set from `nav-profile.ts`, never `@core/db`, so it is
 * safe on the client, on the server, and in tests. It is NOT the core agent
 * roster — a specialist is never added to `AGENT_ROSTER`; the agents surface
 * layers it in additively, scoped to the workspace's vertical.
 */

import { BEAUTY_NAV_VERTICAL_KEYS } from "./nav-profile"

/** Reusable voice strings so Beauty surfaces can speak as Finesse. */
export interface VerticalSpecialistVoice {
  /** e.g. "Preguntar a Finesse". */
  ask: string
  /** e.g. "Finesse · Beauty Intelligence". */
  intelligence: string
  /** e.g. "Finesse recomienda…". */
  recommends: string
  /** Template with a `{n}` placeholder, e.g. "Finesse preparó {n} acciones". */
  preparedActions: string
}

export interface VerticalSpecialistAgent {
  /** Stable id (also the icon key). Not a core-roster id. */
  id: string
  name: string
  /** The vertical this specialist leads. */
  verticalKey: string
  /** Brand line, e.g. "7F Beauty, powered by Finesse". */
  tagline: string
  /** Long role, e.g. "Beauty Intelligence". */
  role: string
  /** Short chip label, e.g. "Especialista Beauty". */
  shortLabel: string
  description: string
  /** Identity accent (must be an AgentAccent value; "rose" for Beauty). */
  accent: string
  /**
   * Core agent ids this specialist COORDINATES with — never replaces. Documents
   * in data that Finesse leads Beauty on top of the intact core team.
   */
  coordinatesWith: string[]
  voice: VerticalSpecialistVoice
}

export const BEAUTY_SPECIALIST_AGENT: VerticalSpecialistAgent = {
  id: "finesse",
  name: "Finesse",
  verticalKey: "beauty",
  tagline: "7F Beauty, powered by Finesse",
  role: "Beauty Intelligence",
  shortLabel: "Especialista Beauty",
  description:
    "Lidera la experiencia de 7F Beauty: interpreta el contexto del negocio, coordina el día y presenta las acciones. Trabaja sobre los agentes core (Fanny, Freya, Fiona, Felix, Mr. Forte, Fathom) sin reemplazarlos.",
  accent: "rose",
  coordinatesWith: ["francis", "forte", "fanny", "freya", "fiona", "felix", "fathom"],
  voice: {
    ask: "Preguntar a Finesse",
    intelligence: "Finesse · Beauty Intelligence",
    recommends: "Finesse recomienda…",
    preparedActions: "Finesse preparó {n} acciones",
  },
}

/**
 * Registered vertical specialists, keyed by the canonical verticalKey. Future
 * verticals (construction, cleaning, agency) add their own specialist here.
 */
export const VERTICAL_SPECIALISTS: Record<string, VerticalSpecialistAgent> = {
  beauty: BEAUTY_SPECIALIST_AGENT,
}

/**
 * Resolve the specialist that leads a workspace's vertical, or `null` when the
 * vertical has none (→ the agents surface shows only the 7 core agents). Pure
 * and total: unknown/empty input → `null`. Beauty aliases (salon, nails, …)
 * resolve to Finesse via `BEAUTY_NAV_VERTICAL_KEYS`.
 */
export function resolveVerticalSpecialist(
  verticalKey: string | null | undefined,
): VerticalSpecialistAgent | null {
  if (!verticalKey) return null
  if (BEAUTY_NAV_VERTICAL_KEYS.has(verticalKey)) return BEAUTY_SPECIALIST_AGENT
  return VERTICAL_SPECIALISTS[verticalKey] ?? null
}
