import { NextResponse } from "next/server"
import { ZodError } from "zod"
import { Prisma } from "@/generated/prisma/client"

export function successResponse(data: unknown, meta?: Record<string, unknown>) {
  return NextResponse.json({
    success: true,
    data,
    ...(meta ? { meta } : {}),
  })
}

export function errorResponse(code: string, message: string, status = 400) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status }
  )
}

export function handleError(error: unknown, entity: string) {
  if (error && typeof error === "object" && "code" in error && "name" in error) {
    const named = error as { name: string; code: string; message: string; status: number }
    if (named.name === "RbacError") {
      return errorResponse(named.code, named.message, 403)
    }
    if (named.name === "WorkspaceError") {
      return errorResponse(named.code, named.message, named.status)
    }
  }
  if (error && typeof error === "object" && "status" in error && "code" in error) {
    const wsErr = error as { code: string; message: string; status: number }
    return errorResponse(wsErr.code, wsErr.message, wsErr.status)
  }
  if (error instanceof ZodError) {
    return errorResponse("VALIDATION_ERROR", error.errors[0].message)
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      return errorResponse("NOT_FOUND", `${entity} no encontrado`, 404)
    }
    if (error.code === "P2002") {
      return errorResponse("CONFLICT", `${entity} ya existe con esos datos`, 409)
    }
  }
  console.error(`[7F] Error in ${entity}:`, error)
  return errorResponse("INTERNAL_ERROR", "Error interno del servidor", 500)
}

export function getPaginationParams(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20")))
  const skip = (page - 1) * pageSize
  return { page, pageSize, skip }
}
