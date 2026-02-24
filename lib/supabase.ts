import { createClient, type SupabaseClient } from "@supabase/supabase-js"

export const STORAGE_BUCKET = "archivos"

let _supabase: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("[Supabase] NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY deben estar configuradas")
  }

  _supabase = createClient(supabaseUrl, supabaseKey)
  return _supabase
}

/** @deprecated Use getSupabase() instead */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as any)[prop]
  },
})

export async function uploadToStorage(
  file: Buffer,
  path: string,
  contentType: string,
): Promise<string> {
  const client = getSupabase()
  const { data, error } = await client.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, {
      contentType,
      upsert: false,
    })

  if (error) throw new Error(`Error al subir archivo: ${error.message}`)

  const { data: urlData } = client.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(data.path)

  return urlData.publicUrl
}

export async function deleteFromStorage(path: string): Promise<void> {
  const client = getSupabase()
  const { error } = await client.storage
    .from(STORAGE_BUCKET)
    .remove([path])

  if (error) {
    console.error(`[Supabase] Error al eliminar archivo: ${error.message}`)
  }
}

export function getStoragePath(module: string, fileName: string): string {
  const timestamp = Date.now()
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_")
  return `${module}/${timestamp}-${safeName}`
}
