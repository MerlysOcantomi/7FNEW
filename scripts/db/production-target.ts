/**
 * Audited, non-secret identity of the canonical sevenef production database.
 *
 * Credentials NEVER live here. DIRECT_URL remains a Vercel secret.
 * Changing production database identity is an infrastructure change and must
 * therefore be reviewed/versioned just like a domain or deployment target.
 */
export const SEVENF_PRODUCTION_DATABASE_TARGET = Object.freeze({
  host: "ep-restless-scene-b2m6ucm7.c-6.eu-central-1.aws.neon.tech",
  database: "neondb",
  project: "old-wave-11795585",
  branch: "br-broad-river-b2ue75l8",
})
