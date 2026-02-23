import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.warn("[Supabase] NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configuradas")
}

export const supabase = createClient(supabaseUrl ?? "", supabaseKey ?? "")

export const STORAGE_BUCKET = "archivos"

export async function uploadToStorage(
  file: Buffer,
  path: string,
  contentType: string,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, {
      contentType,
      upsert: false,
    })

  if (error) throw new Error(`Error al subir archivo: ${error.message}`)

  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(data.path)

  return urlData.publicUrl
}

export async function deleteFromStorage(path: string): Promise<void> {
  const { error } = await supabase.storage
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
