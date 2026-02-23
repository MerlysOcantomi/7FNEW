import { NextRequest } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { db } from "@/lib/db"
import { getSessionFromCookies } from "@/lib/auth/session"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { extractText, isScannable } from "@/lib/ocr"
import { analyzeDocument } from "@/lib/scan"

const MAX_FILE_SIZE = 10 * 1024 * 1024

const ALLOWED_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain", "text/csv",
  "application/zip", "application/x-zip-compressed",
])

const useSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

async function uploadFile(file: File): Promise<string> {
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")

  if (useSupabase) {
    const { uploadToStorage, getStoragePath } = await import("@/lib/supabase")
    const path = getStoragePath("uploads", safeName)
    return uploadToStorage(buffer, path, file.type)
  }

  const fileName = `${timestamp}-${safeName}`
  const uploadDir = join(process.cwd(), "public", "uploads")
  await mkdir(uploadDir, { recursive: true })
  const filePath = join(uploadDir, fileName)
  await writeFile(filePath, buffer)
  return `/uploads/${fileName}`
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const module = searchParams.get("module")
    const recordId = searchParams.get("recordId")

    if (!module || !recordId) {
      return errorResponse("VALIDATION_ERROR", "module y recordId son requeridos")
    }

    const attachments = await db.attachment.findMany({
      where: { module, recordId },
      orderBy: { createdAt: "desc" },
    })

    return successResponse(attachments)
  } catch (error) {
    return handleError(error, "Attachment")
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookies()
    if (!session) return errorResponse("UNAUTHORIZED", "No autenticado", 401)

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const module = formData.get("module") as string | null
    const recordId = formData.get("recordId") as string | null

    if (!file || !module || !recordId) {
      return errorResponse("VALIDATION_ERROR", "file, module y recordId son requeridos")
    }

    if (file.size > MAX_FILE_SIZE) {
      return errorResponse("VALIDATION_ERROR", `Archivo demasiado grande. Maximo: ${MAX_FILE_SIZE / 1024 / 1024}MB`)
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return errorResponse("VALIDATION_ERROR", `Tipo de archivo no permitido: ${file.type}`)
    }

    const url = await uploadFile(file)
    const canScan = isScannable(file.type)

    const attachment = await db.attachment.create({
      data: {
        nombre: file.name,
        url,
        tipo: file.type,
        tamano: file.size,
        module,
        recordId,
        userId: session.userId,
        userName: session.nombre ?? session.email,
        scanStatus: canScan ? "processing" : "not_applicable",
      },
    })

    if (canScan) {
      runScanInBackground(attachment.id, url, file.type, file.name)
    }

    return successResponse(attachment)
  } catch (error) {
    return handleError(error, "Attachment")
  }
}

function runScanInBackground(
  attachmentId: string,
  fileUrl: string,
  mimeType: string,
  fileName: string,
) {
  ;(async () => {
    try {
      console.log("[7F Scan] Iniciando escaneo automatico:", fileName)
      const ocrText = await extractText(fileUrl, mimeType)
      const scanResult = await analyzeDocument(ocrText, fileName)

      await db.attachment.update({
        where: { id: attachmentId },
        data: {
          ocrText,
          scanStatus: "completed",
          scanResult: JSON.stringify(scanResult),
        },
      })
      console.log("[7F Scan] Escaneo completado:", fileName)
    } catch (err) {
      console.error("[7F Scan] Error en escaneo automatico:", err)
      await db.attachment.update({
        where: { id: attachmentId },
        data: {
          scanStatus: "error",
          scanResult: JSON.stringify({
            error: err instanceof Error ? err.message : "Error desconocido",
          }),
        },
      }).catch(() => {})
    }
  })()
}
