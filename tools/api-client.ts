interface ApiSuccessResponse<T> {
  success: true
  data: T
  meta?: { total: number; page: number; pageSize: number }
}

interface ApiErrorResponse {
  success: false
  error: { code: string; message: string }
}

type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse

export async function apiFetch<T>(
  path: string,
  params?: Record<string, string | undefined>
): Promise<{ data: T; meta?: { total: number; page: number; pageSize: number } }> {
  const url = new URL(path, window.location.origin)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "") url.searchParams.set(key, value)
    })
  }
  const res = await fetch(url.toString())
  const json: ApiResponse<T> = await res.json()
  if (!json.success) throw new Error(json.error.message)
  return { data: json.data, meta: "meta" in json ? json.meta : undefined }
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const json: ApiResponse<T> = await res.json()
  if (!json.success) throw new Error(json.error.message)
  return json.data
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const json: ApiResponse<T> = await res.json()
  if (!json.success) throw new Error(json.error.message)
  return json.data
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(path, { method: "DELETE" })
  const json: ApiResponse<unknown> = await res.json()
  if (!json.success) throw new Error(json.error.message)
}

export const estadoLabel: Record<string, string> = {
  activo: "Active",
  inactivo: "Inactive",
  prospecto: "Prospect",
  planificacion: "Planning",
  en_progreso: "In progress",
  revision: "In review",
  completado: "Completed",
  cancelado: "Canceled",
  pendiente: "Pending",
  completada: "Completed",
  cancelada: "Canceled",
  borrador: "Draft",
  enviada: "Sent",
  pagada: "Paid",
  vencida: "Overdue",
  activa: "Active",
  pausada: "Paused",
  en_pausa: "On hold",
}

export const prioridadLabel: Record<string, string> = {
  baja: "Low",
  media: "Medium",
  alta: "High",
  urgente: "Urgent",
}

export function displayLabel(value: string, map: Record<string, string>): string {
  return map[value] ?? value
}
