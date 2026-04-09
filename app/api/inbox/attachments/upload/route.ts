import { NextRequest, NextResponse } from "next/server"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/zip",
])

export async function POST(request: NextRequest) {
  try {
    await requireWriteAccess(request)

    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 })
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: `File type not allowed: ${file.type}` }, { status: 400 })
    }

    const { uploadToStorage, getStoragePath } = await import("@/lib/storage")
    const buffer = Buffer.from(await file.arrayBuffer())
    const path = getStoragePath("inbox-attachments", file.name)
    const url = await uploadToStorage(buffer, path, file.type)

    return NextResponse.json({
      url,
      filename: file.name,
      contentType: file.type,
      size: file.size,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed"
    console.error("[inbox-attachment-upload]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
