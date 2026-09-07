-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Vertical" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultConfig" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vertical_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "vertical" TEXT NOT NULL DEFAULT 'creative-agency',
    "verticalKey" TEXT NOT NULL DEFAULT 'creative-agency',
    "config" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL DEFAULT 'active',
    "entitlementRevision" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "customId" TEXT,
    "nombre" TEXT NOT NULL,
    "email" TEXT,
    "telefono" TEXT,
    "empresa" TEXT,
    "preferredPaymentMethod" TEXT,
    "currency" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'empresa',
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "notas" TEXT,
    "workspaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proyecto" (
    "id" TEXT NOT NULL,
    "customId" TEXT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'planificacion',
    "prioridad" TEXT NOT NULL DEFAULT 'media',
    "progreso" INTEGER NOT NULL DEFAULT 0,
    "presupuesto" DOUBLE PRECISION,
    "fechaInicio" TIMESTAMP(3),
    "fechaFin" TIMESTAMP(3),
    "estimatedDelivery" TIMESTAMP(3),
    "actualDelivery" TIMESTAMP(3),
    "tags" TEXT,
    "internalNotes" TEXT,
    "assignedTo" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "allowedUsers" TEXT,
    "createdBy" TEXT,
    "clienteId" TEXT,
    "workspaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proyecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tarea" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "prioridad" TEXT NOT NULL DEFAULT 'media',
    "fechaLimite" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "proyectoId" TEXT,
    "clienteId" TEXT,
    "usuarioId" TEXT,
    "workspaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tarea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Documento" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tamano" INTEGER,
    "clienteId" TEXT,
    "proyectoId" TEXT,
    "workspaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaccion" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "descripcion" TEXT,
    "categoria" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clienteId" TEXT,
    "proyectoId" TEXT,
    "workspaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Factura" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "subtotal" DOUBLE PRECISION NOT NULL,
    "impuesto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "items" TEXT NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "clienteId" TEXT,
    "proyectoId" TEXT,
    "workspaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Factura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evento" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'reunion',
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3),
    "todoElDia" BOOLEAN NOT NULL DEFAULT false,
    "clienteId" TEXT,
    "proyectoId" TEXT,
    "workspaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nota" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "contenido" TEXT,
    "clienteId" TEXT,
    "proyectoId" TEXT,
    "workspaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Nota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Automatizacion" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "trigger" TEXT NOT NULL,
    "condiciones" TEXT,
    "acciones" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'activa',
    "workspaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Automatizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "rol" TEXT NOT NULL DEFAULT 'miembro',
    "departamento" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT,
    "avatar" TEXT,
    "locale" TEXT,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "visibleProjects" TEXT,
    "workspaceId" TEXT,
    "googleId" TEXT,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformAdmin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'SUPPORT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "PlatformAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadata" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllowedEmail" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AllowedEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "workspaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "userEmail" TEXT,
    "data" TEXT,
    "workspaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "nombre" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "empresa" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'visitante',
    "canal" TEXT NOT NULL DEFAULT 'manual',
    "source" TEXT,
    "leadScore" INTEGER,
    "metadata" TEXT,
    "notas" TEXT,
    "clienteId" TEXT,
    "workspaceId" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'manual',
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "subject" TEXT,
    "summary" TEXT,
    "intent" TEXT,
    "category" TEXT,
    "sector" TEXT,
    "leadScore" INTEGER,
    "urgency" TEXT NOT NULL DEFAULT 'media',
    "sentiment" TEXT,
    "detectedLanguage" TEXT,
    "assignedTo" TEXT,
    "clienteId" TEXT,
    "proyectoId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "closedAt" TIMESTAMP(3),
    "trashedAt" TIMESTAMP(3),
    "connectionId" TEXT,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationRead" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'inbound',
    "content" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'text',
    "metadata" TEXT,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "sourceMessageId" TEXT,
    "connectionId" TEXT,
    "deliveryStatus" TEXT NOT NULL DEFAULT 'none',
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "readSource" TEXT,
    "failedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "deliveryUpdatedAt" TIMESTAMP(3),
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationAction" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'suggested',
    "source" TEXT NOT NULL DEFAULT 'system',
    "confidence" DOUBLE PRECISION,
    "sourceMessageId" TEXT,
    "data" TEXT,
    "resultId" TEXT,
    "resultModule" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "executionNotes" TEXT,
    "errorMessage" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxTodo" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "conversationId" TEXT,
    "sourceMessageId" TEXT,
    "sourceActionId" TEXT,
    "sourceNoteId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "assigneeType" TEXT NOT NULL DEFAULT 'me',
    "assigneeId" TEXT,
    "dueAt" TIMESTAMP(3),
    "remindAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdSource" TEXT NOT NULL DEFAULT 'operator',
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "dismissedAt" TIMESTAMP(3),
    "dismissedReason" TEXT,
    "metadata" TEXT,
    "workspaceTaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxTodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIClassification" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "intent" TEXT,
    "sector" TEXT,
    "urgency" TEXT,
    "leadScore" INTEGER,
    "sentiment" TEXT,
    "summary" TEXT,
    "suggestedTags" TEXT,
    "briefData" TEXT,
    "facts" TEXT,
    "pendingItems" TEXT,
    "risks" TEXT,
    "nextBestAction" TEXT,
    "confidence" DOUBLE PRECISION,
    "model" TEXT,
    "promptVersion" TEXT,
    "pipelineVersion" TEXT,
    "scoreReasoning" TEXT,
    "lastProcessedMessageId" TEXT,
    "lastProcessedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "sourceConversationId" TEXT,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIClassification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationHandoff" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'generated',
    "headline" TEXT,
    "summary" TEXT,
    "facts" TEXT,
    "decisions" TEXT,
    "pendingItems" TEXT,
    "risks" TEXT,
    "nextRecommendedAction" TEXT,
    "sourceMessageId" TEXT,
    "confidence" DOUBLE PRECISION,
    "model" TEXT,
    "promptVersion" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationHandoff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationDraft" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'ghost_reply',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "title" TEXT,
    "content" TEXT NOT NULL,
    "tone" TEXT,
    "targetChannel" TEXT,
    "sourceMessageId" TEXT,
    "generatedFrom" TEXT,
    "model" TEXT,
    "promptVersion" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxEntry" (
    "id" TEXT NOT NULL,
    "nombre" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "mensaje" TEXT NOT NULL,
    "fuente" TEXT NOT NULL DEFAULT 'manual',
    "tipo" TEXT NOT NULL DEFAULT 'consulta',
    "categoria" TEXT,
    "urgencia" TEXT NOT NULL DEFAULT 'media',
    "intencion" TEXT,
    "resumen" TEXT,
    "datosCliente" TEXT,
    "datosProyecto" TEXT,
    "notas" TEXT,
    "tags" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'nuevo',
    "aiRaw" TEXT,
    "clienteId" TEXT,
    "proyectoId" TEXT,
    "tareaId" TEXT,
    "contactId" TEXT,
    "conversationId" TEXT,
    "workspaceId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QRCode" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "imageData" TEXT NOT NULL,
    "label" TEXT,
    "createdBy" TEXT,
    "workspaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QRCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientAuth" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientAuth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'idea',
    "marca" TEXT NOT NULL DEFAULT 'general',
    "fechaInicio" TIMESTAMP(3),
    "fechaFin" TIMESTAMP(3),
    "presupuesto" DOUBLE PRECISION,
    "objetivos" TEXT,
    "clienteId" TEXT,
    "proyectoId" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "allowedUsers" TEXT,
    "createdBy" TEXT,
    "workspaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPiece" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "copy" TEXT,
    "plataforma" TEXT NOT NULL DEFAULT 'instagram',
    "tipo" TEXT NOT NULL DEFAULT 'post',
    "estado" TEXT NOT NULL DEFAULT 'idea',
    "fechaProgramada" TIMESTAMP(3),
    "fechaPublicada" TIMESTAMP(3),
    "hashtags" TEXT,
    "mediaUrl" TEXT,
    "mediaType" TEXT,
    "enlace" TEXT,
    "notas" TEXT,
    "responsable" TEXT,
    "prioridad" TEXT NOT NULL DEFAULT 'media',
    "campaignId" TEXT,
    "clienteId" TEXT,
    "proyectoId" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "createdBy" TEXT,
    "workspaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPiece_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentIdea" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "categoria" TEXT,
    "plataforma" TEXT,
    "tags" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'nueva',
    "fuente" TEXT NOT NULL DEFAULT 'manual',
    "clienteId" TEXT,
    "proyectoId" TEXT,
    "createdBy" TEXT,
    "workspaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentIdea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientAsset" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "projectId" TEXT,
    "requestId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'OTHER',
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "url" TEXT NOT NULL,
    "createdByPortalUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientRequest" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "proyectoId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "createdByPortalUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientRequestAsset" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "assetUrl" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientRequestAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "tamano" INTEGER NOT NULL,
    "module" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "ocrText" TEXT,
    "scanStatus" TEXT NOT NULL DEFAULT 'pending',
    "scanResult" TEXT,
    "workspaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelConnection" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "channelType" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" TEXT,
    "credentials" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "externalAccountId" TEXT,
    "providerAccountId" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "numberUsage" TEXT NOT NULL DEFAULT 'unknown',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "syncState" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalIdentity" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'unknown',
    "scopeKey" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL,
    "externalKey" TEXT NOT NULL,
    "displayValue" TEXT,
    "primaryContactId" TEXT,
    "resolutionStatus" TEXT NOT NULL DEFAULT 'unresolved',
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactIdentityLink" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "externalIdentityId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'suggested',
    "source" TEXT NOT NULL DEFAULT 'ingestion',
    "createdBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactIdentityLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageAttachment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'file',
    "fileName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "storageKey" TEXT,
    "externalUrl" TEXT,
    "provider" TEXT,
    "externalMediaId" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "durationMs" INTEGER,
    "checksum" TEXT,
    "caption" TEXT,
    "status" TEXT NOT NULL DEFAULT 'stored',
    "position" INTEGER NOT NULL DEFAULT 0,
    "attachmentKey" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceTask" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "assigneeType" TEXT NOT NULL DEFAULT 'unassigned',
    "assigneeId" TEXT,
    "dueAt" TIMESTAMP(3),
    "remindAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "dismissedAt" TIMESTAMP(3),
    "dismissedReason" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "sourceLabel" TEXT,
    "conversationId" TEXT,
    "messageId" TEXT,
    "conversationActionId" TEXT,
    "clienteId" TEXT,
    "proyectoId" TEXT,
    "eventoId" TEXT,
    "tareaId" TEXT,
    "createdBy" TEXT NOT NULL,
    "suggestedBy" TEXT,
    "executionMode" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForteSnapshot" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "maturity" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForteSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresenceSite" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ownershipModel" TEXT NOT NULL DEFAULT 'included_in_saas',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "templateId" TEXT NOT NULL DEFAULT 'business-site-standard',
    "templateVersion" TEXT NOT NULL DEFAULT '0.1.0',
    "themeKey" TEXT NOT NULL DEFAULT 'midnight',
    "selectedProposalId" TEXT,
    "visualConfig" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PresenceSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresencePublication" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersion" TEXT NOT NULL,
    "themeKey" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "publishedAt" TIMESTAMP(3),
    "offlineAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PresencePublication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresenceDomain" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'custom',
    "verification" TEXT NOT NULL DEFAULT 'pending',
    "ownership" TEXT NOT NULL DEFAULT 'client_owned',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "verificationToken" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PresenceDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresenceMedia" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "siteId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'photo',
    "purpose" TEXT NOT NULL DEFAULT 'gallery',
    "storageKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "sizeBytes" INTEGER,
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
    "isRealWorkSample" BOOLEAN NOT NULL DEFAULT false,
    "preserveIntegrity" BOOLEAN NOT NULL DEFAULT false,
    "freyaAssessedBy" TEXT,
    "checksum" TEXT,
    "sourceMediaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PresenceMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresenceSubscription" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'none',
    "source" TEXT NOT NULL DEFAULT 'standalone',
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PresenceSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceEntitlement" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vertical_key_key" ON "Vertical"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE INDEX "Workspace_status_idx" ON "Workspace"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Factura_numero_key" ON "Factura"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformAdmin_userId_key" ON "PlatformAdmin"("userId");

-- CreateIndex
CREATE INDEX "PlatformAuditLog_actorId_idx" ON "PlatformAuditLog"("actorId");

-- CreateIndex
CREATE INDEX "PlatformAuditLog_action_idx" ON "PlatformAuditLog"("action");

-- CreateIndex
CREATE INDEX "PlatformAuditLog_targetType_targetId_idx" ON "PlatformAuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "PlatformAuditLog_createdAt_idx" ON "PlatformAuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMember_userId_workspaceId_key" ON "WorkspaceMember"("userId", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "AllowedEmail_email_key" ON "AllowedEmail"("email");

-- CreateIndex
CREATE INDEX "Contact_workspaceId_email_idx" ON "Contact"("workspaceId", "email");

-- CreateIndex
CREATE INDEX "Contact_workspaceId_telefono_idx" ON "Contact"("workspaceId", "telefono");

-- CreateIndex
CREATE INDEX "Contact_workspaceId_clienteId_idx" ON "Contact"("workspaceId", "clienteId");

-- CreateIndex
CREATE INDEX "Conversation_workspaceId_status_idx" ON "Conversation"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Conversation_workspaceId_lastMessageAt_idx" ON "Conversation"("workspaceId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_workspaceId_category_idx" ON "Conversation"("workspaceId", "category");

-- CreateIndex
CREATE INDEX "Conversation_contactId_idx" ON "Conversation"("contactId");

-- CreateIndex
CREATE INDEX "Conversation_clienteId_idx" ON "Conversation"("clienteId");

-- CreateIndex
CREATE INDEX "Conversation_proyectoId_idx" ON "Conversation"("proyectoId");

-- CreateIndex
CREATE INDEX "Conversation_connectionId_idx" ON "Conversation"("connectionId");

-- CreateIndex
CREATE INDEX "ConversationRead_userId_workspaceId_idx" ON "ConversationRead"("userId", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationRead_conversationId_userId_key" ON "ConversationRead"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_workspaceId_createdAt_idx" ON "Message"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_workspaceId_deliveryStatus_idx" ON "Message"("workspaceId", "deliveryStatus");

-- CreateIndex
CREATE INDEX "Message_workspaceId_connectionId_sourceMessageId_idx" ON "Message"("workspaceId", "connectionId", "sourceMessageId");

-- CreateIndex
CREATE INDEX "ConversationAction_conversationId_createdAt_idx" ON "ConversationAction"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ConversationAction_workspaceId_status_idx" ON "ConversationAction"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "ConversationAction_workspaceId_source_idx" ON "ConversationAction"("workspaceId", "source");

-- CreateIndex
CREATE INDEX "ConversationAction_workspaceId_sourceMessageId_idx" ON "ConversationAction"("workspaceId", "sourceMessageId");

-- CreateIndex
CREATE INDEX "InboxTodo_workspaceId_status_dueAt_idx" ON "InboxTodo"("workspaceId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "InboxTodo_workspaceId_assigneeId_status_idx" ON "InboxTodo"("workspaceId", "assigneeId", "status");

-- CreateIndex
CREATE INDEX "InboxTodo_conversationId_status_idx" ON "InboxTodo"("conversationId", "status");

-- CreateIndex
CREATE INDEX "InboxTodo_sourceActionId_idx" ON "InboxTodo"("sourceActionId");

-- CreateIndex
CREATE INDEX "InboxTodo_sourceMessageId_idx" ON "InboxTodo"("sourceMessageId");

-- CreateIndex
CREATE INDEX "InboxTodo_workspaceId_workspaceTaskId_idx" ON "InboxTodo"("workspaceId", "workspaceTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "AIClassification_conversationId_key" ON "AIClassification"("conversationId");

-- CreateIndex
CREATE INDEX "AIClassification_workspaceId_leadScore_idx" ON "AIClassification"("workspaceId", "leadScore");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationHandoff_conversationId_key" ON "ConversationHandoff"("conversationId");

-- CreateIndex
CREATE INDEX "ConversationHandoff_workspaceId_status_idx" ON "ConversationHandoff"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "ConversationDraft_conversationId_createdAt_idx" ON "ConversationDraft"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ConversationDraft_workspaceId_status_idx" ON "ConversationDraft"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "InboxEntry_workspaceId_conversationId_idx" ON "InboxEntry"("workspaceId", "conversationId");

-- CreateIndex
CREATE INDEX "InboxEntry_workspaceId_contactId_idx" ON "InboxEntry"("workspaceId", "contactId");

-- CreateIndex
CREATE INDEX "QRCode_workspaceId_module_recordId_idx" ON "QRCode"("workspaceId", "module", "recordId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientAuth_email_key" ON "ClientAuth"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ClientAuth_clienteId_key" ON "ClientAuth"("clienteId");

-- CreateIndex
CREATE INDEX "ClientAsset_workspaceId_idx" ON "ClientAsset"("workspaceId");

-- CreateIndex
CREATE INDEX "ClientAsset_clienteId_idx" ON "ClientAsset"("clienteId");

-- CreateIndex
CREATE INDEX "ClientAsset_workspaceId_clienteId_idx" ON "ClientAsset"("workspaceId", "clienteId");

-- CreateIndex
CREATE INDEX "ClientRequest_workspaceId_idx" ON "ClientRequest"("workspaceId");

-- CreateIndex
CREATE INDEX "ClientRequest_clienteId_idx" ON "ClientRequest"("clienteId");

-- CreateIndex
CREATE INDEX "ClientRequest_workspaceId_clienteId_idx" ON "ClientRequest"("workspaceId", "clienteId");

-- CreateIndex
CREATE INDEX "ClientRequestAsset_requestId_idx" ON "ClientRequestAsset"("requestId");

-- CreateIndex
CREATE INDEX "ChannelConnection_workspaceId_channelType_idx" ON "ChannelConnection"("workspaceId", "channelType");

-- CreateIndex
CREATE INDEX "ChannelConnection_workspaceId_status_idx" ON "ChannelConnection"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "ChannelConnection_provider_providerAccountId_idx" ON "ChannelConnection"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelConnection_workspaceId_externalAccountId_key" ON "ChannelConnection"("workspaceId", "externalAccountId");

-- CreateIndex
CREATE INDEX "ExternalIdentity_workspaceId_primaryContactId_idx" ON "ExternalIdentity"("workspaceId", "primaryContactId");

-- CreateIndex
CREATE INDEX "ExternalIdentity_workspaceId_kind_externalKey_idx" ON "ExternalIdentity"("workspaceId", "kind", "externalKey");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalIdentity_workspaceId_channel_provider_scopeKey_exte_key" ON "ExternalIdentity"("workspaceId", "channel", "provider", "scopeKey", "externalKey");

-- CreateIndex
CREATE INDEX "ContactIdentityLink_workspaceId_contactId_idx" ON "ContactIdentityLink"("workspaceId", "contactId");

-- CreateIndex
CREATE INDEX "ContactIdentityLink_workspaceId_status_idx" ON "ContactIdentityLink"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ContactIdentityLink_externalIdentityId_contactId_key" ON "ContactIdentityLink"("externalIdentityId", "contactId");

-- CreateIndex
CREATE INDEX "MessageAttachment_messageId_position_idx" ON "MessageAttachment"("messageId", "position");

-- CreateIndex
CREATE INDEX "MessageAttachment_workspaceId_createdAt_idx" ON "MessageAttachment"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageAttachment_workspaceId_externalMediaId_idx" ON "MessageAttachment"("workspaceId", "externalMediaId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageAttachment_messageId_attachmentKey_key" ON "MessageAttachment"("messageId", "attachmentKey");

-- CreateIndex
CREATE INDEX "WorkspaceTask_workspaceId_status_idx" ON "WorkspaceTask"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "WorkspaceTask_workspaceId_dueAt_idx" ON "WorkspaceTask"("workspaceId", "dueAt");

-- CreateIndex
CREATE INDEX "WorkspaceTask_workspaceId_assigneeId_idx" ON "WorkspaceTask"("workspaceId", "assigneeId");

-- CreateIndex
CREATE INDEX "WorkspaceTask_workspaceId_sourceType_sourceId_idx" ON "WorkspaceTask"("workspaceId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "WorkspaceTask_workspaceId_conversationId_idx" ON "WorkspaceTask"("workspaceId", "conversationId");

-- CreateIndex
CREATE INDEX "WorkspaceTask_workspaceId_proyectoId_idx" ON "WorkspaceTask"("workspaceId", "proyectoId");

-- CreateIndex
CREATE INDEX "WorkspaceTask_workspaceId_tareaId_idx" ON "WorkspaceTask"("workspaceId", "tareaId");

-- CreateIndex
CREATE UNIQUE INDEX "ForteSnapshot_workspaceId_key" ON "ForteSnapshot"("workspaceId");

-- CreateIndex
CREATE INDEX "ForteSnapshot_workspaceId_idx" ON "ForteSnapshot"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "PresenceSite_workspaceId_key" ON "PresenceSite"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "PresenceSite_slug_key" ON "PresenceSite"("slug");

-- CreateIndex
CREATE INDEX "PresenceSite_status_idx" ON "PresenceSite"("status");

-- CreateIndex
CREATE INDEX "PresencePublication_workspaceId_siteId_createdAt_idx" ON "PresencePublication"("workspaceId", "siteId", "createdAt");

-- CreateIndex
CREATE INDEX "PresencePublication_siteId_state_idx" ON "PresencePublication"("siteId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "PresenceDomain_hostname_key" ON "PresenceDomain"("hostname");

-- CreateIndex
CREATE INDEX "PresenceDomain_workspaceId_siteId_idx" ON "PresenceDomain"("workspaceId", "siteId");

-- CreateIndex
CREATE INDEX "PresenceDomain_siteId_isPrimary_idx" ON "PresenceDomain"("siteId", "isPrimary");

-- CreateIndex
CREATE INDEX "PresenceMedia_workspaceId_siteId_idx" ON "PresenceMedia"("workspaceId", "siteId");

-- CreateIndex
CREATE INDEX "PresenceMedia_workspaceId_kind_idx" ON "PresenceMedia"("workspaceId", "kind");

-- CreateIndex
CREATE INDEX "PresenceMedia_sourceMediaId_idx" ON "PresenceMedia"("sourceMediaId");

-- CreateIndex
CREATE UNIQUE INDEX "PresenceSubscription_workspaceId_key" ON "PresenceSubscription"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceEntitlement_workspaceId_kind_key_key" ON "WorkspaceEntitlement"("workspaceId", "kind", "key");

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proyecto" ADD CONSTRAINT "Proyecto_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proyecto" ADD CONSTRAINT "Proyecto_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nota" ADD CONSTRAINT "Nota_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nota" ADD CONSTRAINT "Nota_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nota" ADD CONSTRAINT "Nota_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Automatizacion" ADD CONSTRAINT "Automatizacion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformAdmin" ADD CONSTRAINT "PlatformAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ChannelConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationRead" ADD CONSTRAINT "ConversationRead_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationRead" ADD CONSTRAINT "ConversationRead_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ChannelConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationAction" ADD CONSTRAINT "ConversationAction_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationAction" ADD CONSTRAINT "ConversationAction_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxTodo" ADD CONSTRAINT "InboxTodo_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxTodo" ADD CONSTRAINT "InboxTodo_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIClassification" ADD CONSTRAINT "AIClassification_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIClassification" ADD CONSTRAINT "AIClassification_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationHandoff" ADD CONSTRAINT "ConversationHandoff_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationHandoff" ADD CONSTRAINT "ConversationHandoff_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationDraft" ADD CONSTRAINT "ConversationDraft_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationDraft" ADD CONSTRAINT "ConversationDraft_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxEntry" ADD CONSTRAINT "InboxEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxEntry" ADD CONSTRAINT "InboxEntry_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxEntry" ADD CONSTRAINT "InboxEntry_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAuth" ADD CONSTRAINT "ClientAuth_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPiece" ADD CONSTRAINT "ContentPiece_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPiece" ADD CONSTRAINT "ContentPiece_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentIdea" ADD CONSTRAINT "ContentIdea_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAsset" ADD CONSTRAINT "ClientAsset_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRequest" ADD CONSTRAINT "ClientRequest_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRequest" ADD CONSTRAINT "ClientRequest_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRequestAsset" ADD CONSTRAINT "ClientRequestAsset_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ClientRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelConnection" ADD CONSTRAINT "ChannelConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalIdentity" ADD CONSTRAINT "ExternalIdentity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalIdentity" ADD CONSTRAINT "ExternalIdentity_primaryContactId_fkey" FOREIGN KEY ("primaryContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactIdentityLink" ADD CONSTRAINT "ContactIdentityLink_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactIdentityLink" ADD CONSTRAINT "ContactIdentityLink_externalIdentityId_fkey" FOREIGN KEY ("externalIdentityId") REFERENCES "ExternalIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactIdentityLink" ADD CONSTRAINT "ContactIdentityLink_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceTask" ADD CONSTRAINT "WorkspaceTask_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForteSnapshot" ADD CONSTRAINT "ForteSnapshot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresenceSite" ADD CONSTRAINT "PresenceSite_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresencePublication" ADD CONSTRAINT "PresencePublication_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresencePublication" ADD CONSTRAINT "PresencePublication_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "PresenceSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresenceDomain" ADD CONSTRAINT "PresenceDomain_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresenceDomain" ADD CONSTRAINT "PresenceDomain_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "PresenceSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresenceMedia" ADD CONSTRAINT "PresenceMedia_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresenceMedia" ADD CONSTRAINT "PresenceMedia_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "PresenceSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresenceMedia" ADD CONSTRAINT "PresenceMedia_sourceMediaId_fkey" FOREIGN KEY ("sourceMediaId") REFERENCES "PresenceMedia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresenceSubscription" ADD CONSTRAINT "PresenceSubscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceEntitlement" ADD CONSTRAINT "WorkspaceEntitlement_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

