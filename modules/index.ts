/**
 * @modules — Canonical home of 7F business modules.
 *
 * Active module code lives in this directory (for example `clientes`,
 * `proyectos`, `tareas`, `facturacion`, `finanzas`, `calendario`,
 * `contenido`, `campanas`, `documentos`, `notas`, `usuarios`,
 * `automatizaciones`, `inbox`).
 *
 * Canonical imports should point to `@modules/<module>/<file>`.
 * `lib/modules/*` remains only as a temporary compatibility layer.
 *
 * This entrypoint intentionally does not re-export module files to avoid
 * introducing an ambiguous top-level barrel during the cleanup phase.
 */
