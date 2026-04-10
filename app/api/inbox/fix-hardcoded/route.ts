/**
 * SOLUCIÓN DEFINITIVA - Diagnóstico + Limpieza automática de mensajes hardcodeados
 */

import { NextRequest } from "next/server"
import { successResponse, errorResponse } from "@/lib/api"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"
import { db } from "@core/db"

const HARDCODED_PATTERNS = [
  "Hola, me interesa saber más sobre sus servicios",
  "¿Podrían enviarme información?",
  "Test Visitor",
  "test@debug.local",
  "debug.local",
  "Mensaje de prueba",
  "Test message",
]

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return errorResponse("NOT_FOUND", "Not available", 404)
  }

  try {
    const { workspaceId } = await requireWriteAccess(request)
    
    console.log("[FIX-HARDCODED] Iniciando diagnóstico y limpieza completa...")
    
    let totalFixed = 0
    const fixLog = []

    // 1. BUSCAR Y LIMPIAR MENSAJES HARDCODEADOS
    console.log("[FIX] Paso 1: Limpiando mensajes hardcodeados...")
    
    for (const pattern of HARDCODED_PATTERNS) {
      const messagesWithPattern = await db.message.findMany({
        where: {
          conversation: { workspaceId },
          content: { contains: pattern }
        },
        include: { conversation: { include: { contact: true } } }
      })
      
      if (messagesWithPattern.length > 0) {
        const deleteResult = await db.message.deleteMany({
          where: {
            conversation: { workspaceId },
            content: { contains: pattern }
          }
        })
        
        totalFixed += deleteResult.count
        fixLog.push(`Eliminados ${deleteResult.count} mensajes con patrón: "${pattern}"`)
        console.log(`[FIX] Eliminados ${deleteResult.count} mensajes con: "${pattern}"`)
      }
    }

    // 2. LIMPIAR SUMMARIES HARDCODEADOS
    console.log("[FIX] Paso 2: Limpiando summaries hardcodeados...")
    
    for (const pattern of HARDCODED_PATTERNS) {
      const conversationsWithSummary = await db.conversation.updateMany({
        where: {
          workspaceId,
          summary: { contains: pattern }
        },
        data: { summary: null }
      })
      
      if (conversationsWithSummary.count > 0) {
        totalFixed += conversationsWithSummary.count
        fixLog.push(`Limpiados ${conversationsWithSummary.count} summaries con patrón: "${pattern}"`)
      }
    }

    // 3. LIMPIAR CLASSIFICATION SUMMARIES
    console.log("[FIX] Paso 3: Limpiando classification summaries...")
    
    for (const pattern of HARDCODED_PATTERNS) {
      const classificationsFixed = await db.conversationClassification.updateMany({
        where: {
          conversation: { workspaceId },
          summary: { contains: pattern }
        },
        data: { summary: null }
      })
      
      if (classificationsFixed.count > 0) {
        totalFixed += classificationsFixed.count
        fixLog.push(`Limpiados ${classificationsFixed.count} classification summaries con patrón: "${pattern}"`)
      }
    }

    // 4. ELIMINAR CONVERSACIONES VACÍAS O DE DEBUG
    console.log("[FIX] Paso 4: Eliminando conversaciones de debug...")
    
    const debugConversations = await db.conversation.findMany({
      where: {
        workspaceId,
        OR: [
          { source: 'debug' },
          { source: { startsWith: 'debug_' } },
          { contact: { email: { contains: '@debug.local' } } },
          { contact: { nombre: 'Test Visitor' } },
          { 
            AND: [
              { messageCount: 0 },
              { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } // Últimas 24h
            ]
          }
        ]
      },
      include: { messages: true }
    })

    // Eliminar mensajes de conversaciones debug
    if (debugConversations.length > 0) {
      const conversationIds = debugConversations.map(c => c.id)
      
      const deletedMessages = await db.message.deleteMany({
        where: { conversationId: { in: conversationIds } }
      })
      
      const deletedConversations = await db.conversation.deleteMany({
        where: { id: { in: conversationIds } }
      })
      
      totalFixed += deletedMessages.count + deletedConversations.count
      fixLog.push(`Eliminadas ${deletedConversations.count} conversaciones de debug con ${deletedMessages.count} mensajes`)
    }

    // 5. LIMPIAR CONTACTOS DE DEBUG
    console.log("[FIX] Paso 5: Limpiando contactos de debug...")
    
    const orphanedContacts = await db.contact.deleteMany({
      where: {
        workspaceId,
        OR: [
          { email: { contains: '@debug.local' } },
          { nombre: 'Test Visitor' },
          { source: { startsWith: 'debug_' } }
        ],
        conversations: { none: {} } // Solo contactos sin conversaciones
      }
    })
    
    if (orphanedContacts.count > 0) {
      totalFixed += orphanedContacts.count
      fixLog.push(`Eliminados ${orphanedContacts.count} contactos de debug huérfanos`)
    }

    // 6. VERIFICACIÓN FINAL
    console.log("[FIX] Paso 6: Verificación final...")
    
    const remainingIssues = await db.message.count({
      where: {
        conversation: { workspaceId },
        content: { 
          OR: HARDCODED_PATTERNS.map(pattern => ({ contains: pattern }))
        }
      }
    })

    const result = {
      success: true,
      totalItemsFixed: totalFixed,
      remainingHardcodedMessages: remainingIssues,
      fixLog,
      status: remainingIssues === 0 ? "✅ COMPLETAMENTE LIMPIO" : `⚠️ Quedan ${remainingIssues} elementos por revisar`,
      nextStep: remainingIssues === 0 ? "Recarga el inbox - problema resuelto" : "Revisar elementos restantes manualmente"
    }

    console.log("[FIX-HARDCODED] Resultado final:", result)
    return successResponse(result)

  } catch (error) {
    console.error("[FIX-HARDCODED] Error:", error)
    return errorResponse("Error en limpieza automática", "INTERNAL_ERROR", 500)
  }
}