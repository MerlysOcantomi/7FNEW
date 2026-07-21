// Re-export from new location — will be removed after full migration.
// Status/priority labels are no longer here: they were centralized in the
// `statuses` UI catalog (I18N-STATUSES-CENTRAL-04). Use
// `resolveStatusLabel(t.statuses, value)` from `@core/i18n/ui` instead.
export {
  apiFetch,
  apiPost,
  apiPatch,
  apiDelete,
} from "@tools/api-client"
