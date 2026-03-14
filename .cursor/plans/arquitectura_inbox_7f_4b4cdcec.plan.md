---
name: arquitectura inbox 7f
overview: Evaluación arquitectónica del Inbox Inteligente de 7F y hoja de ruta para evolucionarlo desde un intake inteligente hacia una plataforma conversacional multi-canal, segura y multi-tenant.
todos:
  - id: security-boundaries
    content: Definir fronteras de seguridad entre chat público, portal cliente y backoffice multi-tenant
    status: pending
  - id: conversation-domain
    content: Diseñar el dominio conversacional objetivo y sus relaciones con CRM y Activity
    status: pending
  - id: ai-pipeline
    content: Definir pipeline IA por etapas con niveles de autonomía y trazabilidad
    status: pending
  - id: roadmap-priorities
    content: Priorizar features diferenciales para una primera versión de alto impacto
    status: pending
isProject: false
---

# Arquitectura Inbox 7F

## Diagnóstico

- El proyecto ya tiene una base útil para intake inteligente con `InboxEntry`, clasificación IA y conversión a `Cliente`, `Proyecto` y `Tarea`.
- La limitación principal es de modelo: hoy existe una entrada enriquecida, pero no un dominio conversacional explícito (`Contact`, `Conversation`, `Message`).
- La integración con CRM y `Activity` es valiosa, pero todavía no alcanza la meta de “memoria operativa del negocio”.
- Multi-tenancy existe, pero hay puntos a endurecer: evitar `DEFAULT_WORKSPACE_ID` en auditoría/notificaciones y reforzar fronteras entre chat público y portal.

## Arquitectura objetivo

- Introducir una capa conversacional propia y desacoplada del CRM:
  - `Contact`: persona o contraparte externa, separada de `Cliente`.
  - `Conversation`: hilo principal por canal, tenant y contexto.
  - `Message`: eventos atómicos del hilo.
  - `ConversationAction`: acciones sugeridas o ejecutadas por IA.
  - `AIClassification`: snapshot analítico del hilo.
- Mantener al CRM como capa de proyección/operación:
  - `Cliente`, `Proyecto`, `Tarea`, `Factura`, `Activity` se enlazan desde la conversación, no la reemplazan.
- Diferenciar claramente dos contextos IA:
  - Público: sin acceso a datos privados, solo información pública y captura comercial.
  - Portal: contexto limitado al `clienteId` autenticado.

## Riesgos principales a resolver

- `InboxEntry` plano no soporta multi-turno ni múltiples canales con trazabilidad fuerte.
- Clasificación IA en fire-and-forget no es durable para escalar.
- JSON serializado en campos como `datosCliente`, `tags`, `aiRaw` dificulta filtros, analítica y gobernanza.
- Hay riesgos de seguridad y tenancy por rutas abiertas de portal y por fallbacks a `DEFAULT_WORKSPACE_ID`.
- `ClientAuth` en su forma actual limita escenarios reales de múltiples contactos por cliente.

## Recomendaciones de producto

- Priorizar lo diferencial frente a herramientas genéricas de soporte:
  - `SmartHandoff`: paquete de contexto para operadores.
  - `GhostDraft`: borradores IA editables por humanos.
  - `ClientMemory`: memoria persistente por contacto/cliente.
- Simplificar en la primera fase:
  - No intentar todos los canales a la vez.
  - No automatizar creación de recursos críticos sin aprobación.
  - No mezclar chat público y portal en una sola capa de permisos.
- Apostar por activos de producto realmente defendibles:
  - Conversación → brief → cliente/proyecto/tarea sin salir de 7F.
  - IA conectada a CRM, actividad, facturación y portal.
  - Radar de oportunidades y digest operativo basados en datos reales del workspace.

## Recomendaciones de IA

- Pasar de clasificación puntual a pipeline por etapas:
  - ingestión
  - clasificación inicial
  - scoring
  - resumen incremental
  - sugerencia de acciones
  - handoff o ejecución supervisada
- Automatizar con distinto nivel de riesgo:
  - automático: clasificación, resumen, detección de lead, seguimiento, borradores
  - supervisado: crear cliente, proyecto, tarea, propuesta
- Añadir gobernanza IA:
  - `confidence`, `promptVersion`, `model`, `reviewedBy`, `sourceConversationId`
- Mantener memoria explícita y verificable:
  - hechos
  - decisiones
  - pendientes
  - riesgos
  - próxima acción

## Hoja de ruta recomendada

1. Endurecer seguridad y tenancy actuales.
2. Diseñar el dominio conversacional (`Contact`, `Conversation`, `Message`, `ConversationAction`, `AIClassification`).
3. Migrar el inbox desde `InboxEntry` hacia conversaciones persistentes, manteniendo compatibilidad temporal.
4. Implementar chat público con aislamiento estricto.
5. Implementar chat portal con contexto scoped por cliente autenticado.
6. Añadir Smart Handoff, Ghost Draft y Client Memory.
7. Extender a WhatsApp y email mediante adaptadores de canal.

## Decisiones de diseño clave

- El inbox debe ser una capa propia del sistema, no solo un submódulo del CRM.
- `Contact` debe existir separado de `Cliente`.
- La memoria operativa no debe vivir solo en `Activity`; necesita una representación más estructurada.
- La IA debe sugerir mucho, pero ejecutar poco sin supervisión en operaciones sensibles.
- El valor diferencial de 7F está en conectar conversaciones con operación real del negocio, no en ser solo una bandeja bonita.

