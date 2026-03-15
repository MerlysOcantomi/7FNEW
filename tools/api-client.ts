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
  activo: "Activo",
  inactivo: "Inactivo",
  prospecto: "Prospecto",
  planificacion: "Planificación",
  en_progreso: "En progreso",
  revision: "En revisión",
  completado: "Completado",
  cancelado: "Cancelado",
  pendiente: "Pendiente",
  completada: "Completada",
  cancelada: "Cancelada",
  borrador: "Borrador",
  enviada: "Enviada",
  pagada: "Pagada",
  vencida: "Vencida",
  activa: "Activa",
  pausada: "Pausada",
  en_pausa: "En pausa",
}

export const prioridadLabel: Record<string, string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  urgente: "Urgente",
}

export function displayLabel(value: string, map: Record<string, string>): string {
  return map[value] ?? value
}
