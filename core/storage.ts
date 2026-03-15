import { put, del } from "@vercel/blob"

export async function uploadToStorage(
  file: Buffer,
  path: string,
  contentType: string,
): Promise<string> {
  const blob = await put(path, file, {
    access: "public",
    contentType,
    addRandomSuffix: false,
  })
  return blob.url
}

export async function deleteFromStorage(path: string): Promise<void> {
  try {
    await del(path)
  } catch (error) {
    console.error(`[Storage] Error al eliminar: ${error}`)
  }
}

export function getStoragePath(module: string, fileName: string): string {
  const timestamp = Date.now()
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_")
  return `${module}/${timestamp}-${safeName}`
}
