-- 0_baseline — historical DEPLOYED state of the Sevenef/7F Turso database.
--
-- Source: docs/evolution/CORE-03B-BASELINE-DRAFT.sql (read-only capture of
-- `sqlite_schema`, canonical SHA-256
-- 6347f71d88f32d7943eef0c86ae39c49d1beede05522f7b0faf5d42bd8400638).
-- It records what IS deployed, not what `prisma/schema.prisma` declares:
-- known differences are catalogued in CORE-03B-SCHEMA-AUDIT.md and in
-- CORE-03C-CANONICAL-SCHEMA-DECISIONS.md, and are deliberately NOT
-- corrected here. Later migrations carry the corrections.
--
-- LOCAL/CI USE ONLY. This baseline exists so an empty local database can be
-- built to the exact deployed structure. DO NOT APPLY it against the
-- existing Turso database — production already has these objects, and any
-- future ledger adoption on Turso requires an expressly authorized,
-- separately rehearsed procedure (decisions doc §10 / §13 Stage 5).
--
-- Contains DDL only — no rows, no sqlite_* internals, no _prisma_migrations,
-- no connection strings and no credentials. Auto-created indexes
-- (`sqlite_autoindex_*`, sql IS NULL) are not re-emitted as CREATE INDEX;
-- they follow from each table's own PRIMARY KEY / UNIQUE constraint.
--
-- Objects: 48 tables, 61 explicit indexes, 0 views, 0 triggers.

-- ── TABLES ──────────────────────────────────────────────────

CREATE TABLE "Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "module" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "userEmail" TEXT,
    "data" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  , "workspaceId" TEXT);

CREATE TABLE "AIClassification" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "confidence" REAL,
    "model" TEXT,
    "promptVersion" TEXT,
    "pipelineVersion" TEXT,
    "scoreReasoning" TEXT,
    "lastProcessedMessageId" TEXT,
    "lastProcessedAt" DATETIME,
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "sourceConversationId" TEXT,
    "workspaceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  );

CREATE TABLE "AllowedEmail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  , "workspaceId" TEXT);

CREATE TABLE "Automatizacion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "trigger" TEXT NOT NULL,
    "condiciones" TEXT,
    "acciones" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'activa',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  , "workspaceId" TEXT);

CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'idea',
    "marca" TEXT NOT NULL DEFAULT 'general',
    "fechaInicio" DATETIME,
    "fechaFin" DATETIME,
    "presupuesto" REAL,
    "objetivos" TEXT,
    "clienteId" TEXT,
    "proyectoId" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "allowedUsers" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL, "workspaceId" TEXT,
    CONSTRAINT "Campaign_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Campaign_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  );

CREATE TABLE "ChannelConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "channelType" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" TEXT,
    "credentials" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "externalAccountId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "syncState" TEXT,
    "lastSyncAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL, "providerAccountId" TEXT, "tokenExpiresAt" DATETIME, "numberUsage" TEXT NOT NULL DEFAULT 'unknown',
    CONSTRAINT "ChannelConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );

CREATE TABLE "ClientAuth" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "email" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "clienteId" TEXT NOT NULL,
      "lastLogin" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ClientAuth_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "email" TEXT,
    "telefono" TEXT,
    "empresa" TEXT,
    "tipo" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "notas" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  , "customId" TEXT, "workspaceId" TEXT, "preferredPaymentMethod" TEXT, "currency" TEXT);

CREATE TABLE "ClientFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clienteId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamano" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientFile_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );

CREATE TABLE "ClientInvoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clienteId" TEXT NOT NULL,
    "monto" REAL NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "qrCodeUrl" TEXT,
    "paymentUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientInvoice_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );

CREATE TABLE "ClientProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clienteId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClientProject_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );

CREATE TABLE "Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  );

CREATE TABLE "ContactIdentityLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "externalIdentityId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'suggested',
    "source" TEXT NOT NULL DEFAULT 'ingestion',
    "createdBy" TEXT,
    "confirmedAt" DATETIME,
    "rejectedAt" DATETIME,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContactIdentityLink_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContactIdentityLink_externalIdentityId_fkey" FOREIGN KEY ("externalIdentityId") REFERENCES "ExternalIdentity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContactIdentityLink_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );

CREATE TABLE "ContentIdea" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  , "workspaceId" TEXT);

CREATE TABLE "ContentPiece" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "copy" TEXT,
    "plataforma" TEXT NOT NULL DEFAULT 'instagram',
    "tipo" TEXT NOT NULL DEFAULT 'post',
    "estado" TEXT NOT NULL DEFAULT 'idea',
    "fechaProgramada" DATETIME,
    "fechaPublicada" DATETIME,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL, "workspaceId" TEXT,
    CONSTRAINT "ContentPiece_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  );

CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'manual',
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "subject" TEXT,
    "summary" TEXT,
    "intent" TEXT,
    "sector" TEXT,
    "leadScore" INTEGER,
    "urgency" TEXT NOT NULL DEFAULT 'media',
    "sentiment" TEXT,
    "assignedTo" TEXT,
    "clienteId" TEXT,
    "proyectoId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "lastMessageAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "closedAt" DATETIME,
    "workspaceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  , detectedLanguage TEXT, "connectionId" TEXT, "trashedAt" DATETIME, "category" TEXT);

CREATE TABLE "ConversationAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'suggested',
    "source" TEXT NOT NULL DEFAULT 'system',
    "confidence" REAL,
    "sourceMessageId" TEXT,
    "data" TEXT,
    "resultId" TEXT,
    "resultModule" TEXT,
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "dismissedAt" DATETIME,
    "executionNotes" TEXT,
    "errorMessage" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "workspaceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

CREATE TABLE "ConversationDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "reviewedAt" DATETIME,
    "workspaceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  );

CREATE TABLE "ConversationHandoff" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "confidence" REAL,
    "model" TEXT,
    "promptVersion" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "workspaceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  );

CREATE TABLE ConversationRead (id TEXT PRIMARY KEY NOT NULL, conversationId TEXT NOT NULL, userId TEXT NOT NULL, lastSeenAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, workspaceId TEXT NOT NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (conversationId) REFERENCES Conversation(id) ON DELETE CASCADE, FOREIGN KEY (workspaceId) REFERENCES Workspace(id) ON DELETE CASCADE);

CREATE TABLE "Documento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'documento',
    "url" TEXT,
    "tamano" INTEGER,
    "clienteId" TEXT,
    "proyectoId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL, "workspaceId" TEXT,
    CONSTRAINT "Documento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Documento_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  );

CREATE TABLE "Evento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'reunion',
    "fechaInicio" DATETIME NOT NULL,
    "fechaFin" DATETIME,
    "todoElDia" BOOLEAN NOT NULL DEFAULT false,
    "clienteId" TEXT,
    "proyectoId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL, "workspaceId" TEXT,
    CONSTRAINT "Evento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Evento_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  );

CREATE TABLE "ExternalIdentity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'unknown',
    "scopeKey" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL,
    "externalKey" TEXT NOT NULL,
    "displayValue" TEXT,
    "primaryContactId" TEXT,
    "resolutionStatus" TEXT NOT NULL DEFAULT 'unresolved',
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExternalIdentity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExternalIdentity_primaryContactId_fkey" FOREIGN KEY ("primaryContactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  );

CREATE TABLE "Factura" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "numero" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "subtotal" REAL NOT NULL DEFAULT 0,
    "impuesto" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "items" TEXT,
    "fechaEmision" DATETIME,
    "fechaVencimiento" DATETIME,
    "paidAt" DATETIME,
    "clienteId" TEXT,
    "proyectoId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL, "workspaceId" TEXT,
    CONSTRAINT "Factura_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Factura_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  );

CREATE TABLE "InboxEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "archivedAt" DATETIME,
    "processedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  , "workspaceId" TEXT, "contactId" TEXT, "conversationId" TEXT);

CREATE TABLE "InboxTodo" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "dueAt" DATETIME,
    "remindAt" DATETIME,
    "createdBy" TEXT NOT NULL,
    "createdSource" TEXT NOT NULL DEFAULT 'operator',
    "completedAt" DATETIME,
    "completedBy" TEXT,
    "dismissedAt" DATETIME,
    "dismissedReason" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InboxTodo_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InboxTodo_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  );

CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'inbound',
    "content" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'text',
    "metadata" TEXT,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "sourceMessageId" TEXT,
    "workspaceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  , "connectionId" TEXT, "deliveryStatus" TEXT NOT NULL DEFAULT 'none', "sentAt" DATETIME, "deliveredAt" DATETIME, "readAt" DATETIME, "readSource" TEXT, "failedAt" DATETIME, "failureCode" TEXT, "deliveryUpdatedAt" DATETIME);

CREATE TABLE "MessageAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MessageAttachment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );

CREATE TABLE "Nota" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "contenido" TEXT,
    "clienteId" TEXT,
    "proyectoId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL, "workspaceId" TEXT,
    CONSTRAINT "Nota_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Nota_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  );

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "workspaceId" TEXT,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );

CREATE TABLE "PlatformAdmin" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'SUPPORT',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdBy" TEXT,
      CONSTRAINT "PlatformAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

CREATE TABLE "PlatformAuditLog" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "actorId" TEXT NOT NULL,
      "action" TEXT NOT NULL,
      "targetType" TEXT NOT NULL,
      "targetId" TEXT NOT NULL,
      "metadata" TEXT,
      "ip" TEXT,
      "userAgent" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE "PresenceDomain" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'custom',
    "verification" TEXT NOT NULL DEFAULT 'pending',
    "ownership" TEXT NOT NULL DEFAULT 'client_owned',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "verificationToken" TEXT,
    "verifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PresenceDomain_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PresenceDomain_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "PresenceSite" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );

CREATE TABLE "PresenceMedia" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PresenceMedia_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PresenceMedia_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "PresenceSite" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PresenceMedia_sourceMediaId_fkey" FOREIGN KEY ("sourceMediaId") REFERENCES "PresenceMedia" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );

CREATE TABLE "PresencePublication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersion" TEXT NOT NULL,
    "themeKey" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "publishedAt" DATETIME,
    "offlineAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PresencePublication_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PresencePublication_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "PresenceSite" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );

CREATE TABLE "PresenceSite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ownershipModel" TEXT NOT NULL DEFAULT 'included_in_saas',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "templateId" TEXT NOT NULL DEFAULT 'business-site-standard',
    "templateVersion" TEXT NOT NULL DEFAULT '0.1.0',
    "themeKey" TEXT NOT NULL DEFAULT 'midnight',
    "selectedProposalId" TEXT,
    "visualConfig" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PresenceSite_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );

CREATE TABLE "PresenceSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'none',
    "source" TEXT NOT NULL DEFAULT 'standalone',
    "currentPeriodEnd" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PresenceSubscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );

CREATE TABLE "Proyecto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'planificacion',
    "prioridad" TEXT NOT NULL DEFAULT 'media',
    "progreso" INTEGER NOT NULL DEFAULT 0,
    "presupuesto" REAL,
    "fechaInicio" DATETIME,
    "fechaFin" DATETIME,
    "clienteId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL, "customId" TEXT, "estimatedDelivery" DATETIME, "actualDelivery" DATETIME, "tags" TEXT, "internalNotes" TEXT, "assignedTo" TEXT, "visibility" TEXT NOT NULL DEFAULT 'public', "allowedUsers" TEXT, "createdBy" TEXT, "workspaceId" TEXT,
    CONSTRAINT "Proyecto_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  );

CREATE TABLE "QRCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "module" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "imageData" TEXT NOT NULL,
    "label" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

CREATE TABLE "Tarea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "prioridad" TEXT NOT NULL DEFAULT 'media',
    "fechaLimite" DATETIME,
    "completedAt" DATETIME,
    "proyectoId" TEXT,
    "clienteId" TEXT,
    "usuarioId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL, "workspaceId" TEXT,
    CONSTRAINT "Tarea_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Tarea_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Tarea_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  );

CREATE TABLE "Transaccion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipo" TEXT NOT NULL,
    "monto" REAL NOT NULL,
    "descripcion" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL,
    "clienteId" TEXT,
    "proyectoId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL, "workspaceId" TEXT,
    CONSTRAINT "Transaccion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaccion_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  );

CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "nombre" TEXT,
    "avatar" TEXT,
    "googleId" TEXT,
    "lastLogin" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  , "isPrivate" BOOLEAN NOT NULL DEFAULT false, "visibleProjects" TEXT, "workspaceId" TEXT, "locale" TEXT);

CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "rol" TEXT NOT NULL DEFAULT 'miembro',
    "departamento" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  );

CREATE TABLE "Vertical" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultConfig" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "vertical" TEXT NOT NULL DEFAULT 'creative-agency',
    "verticalKey" TEXT NOT NULL DEFAULT 'creative-agency',
    "config" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  , "status" TEXT NOT NULL DEFAULT 'active');

CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );

CREATE TABLE "WorkspaceTask" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT,
      "status" TEXT NOT NULL DEFAULT 'open',
      "priority" TEXT NOT NULL DEFAULT 'normal',
      "assigneeType" TEXT NOT NULL DEFAULT 'unassigned',
      "assigneeId" TEXT,
      "dueAt" DATETIME,
      "remindAt" DATETIME,
      "completedAt" DATETIME,
      "completedBy" TEXT,
      "dismissedAt" DATETIME,
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
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "WorkspaceTask_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

-- ── INDEXS ──────────────────────────────────────────────────

CREATE UNIQUE INDEX "AIClassification_conversationId_key" ON "AIClassification"("conversationId");

CREATE UNIQUE INDEX "AllowedEmail_email_key" ON "AllowedEmail"("email");

CREATE INDEX "ChannelConnection_provider_providerAccountId_idx" ON "ChannelConnection"("provider", "providerAccountId");

CREATE INDEX "ChannelConnection_workspaceId_channelType_idx" ON "ChannelConnection"("workspaceId", "channelType");

CREATE UNIQUE INDEX "ChannelConnection_workspaceId_externalAccountId_key" ON "ChannelConnection"("workspaceId", "externalAccountId");

CREATE INDEX "ChannelConnection_workspaceId_status_idx" ON "ChannelConnection"("workspaceId", "status");

CREATE UNIQUE INDEX "ClientAuth_clienteId_key" ON "ClientAuth"("clienteId");

CREATE UNIQUE INDEX "ClientAuth_email_key" ON "ClientAuth"("email");

CREATE UNIQUE INDEX "ContactIdentityLink_externalIdentityId_contactId_key" ON "ContactIdentityLink"("externalIdentityId", "contactId");

CREATE INDEX "ContactIdentityLink_workspaceId_contactId_idx" ON "ContactIdentityLink"("workspaceId", "contactId");

CREATE INDEX "ContactIdentityLink_workspaceId_status_idx" ON "ContactIdentityLink"("workspaceId", "status");

CREATE INDEX "Conversation_workspaceId_category_idx" ON "Conversation"("workspaceId","category");

CREATE UNIQUE INDEX "ConversationHandoff_conversationId_key" ON "ConversationHandoff"("conversationId");

CREATE UNIQUE INDEX ConversationRead_conversationId_userId_key ON ConversationRead(conversationId, userId);

CREATE INDEX ConversationRead_userId_workspaceId_idx ON ConversationRead(userId, workspaceId);

CREATE UNIQUE INDEX "ExternalIdentity_workspaceId_channel_provider_scopeKey_externalKey_key" ON "ExternalIdentity"("workspaceId", "channel", "provider", "scopeKey", "externalKey");

CREATE INDEX "ExternalIdentity_workspaceId_kind_externalKey_idx" ON "ExternalIdentity"("workspaceId", "kind", "externalKey");

CREATE INDEX "ExternalIdentity_workspaceId_primaryContactId_idx" ON "ExternalIdentity"("workspaceId", "primaryContactId");

CREATE UNIQUE INDEX "Factura_numero_key" ON "Factura"("numero");

CREATE INDEX "InboxTodo_conversationId_status_idx" ON "InboxTodo"("conversationId", "status");

CREATE INDEX "InboxTodo_sourceActionId_idx" ON "InboxTodo"("sourceActionId");

CREATE INDEX "InboxTodo_sourceMessageId_idx" ON "InboxTodo"("sourceMessageId");

CREATE INDEX "InboxTodo_workspaceId_assigneeId_status_idx" ON "InboxTodo"("workspaceId", "assigneeId", "status");

CREATE INDEX "InboxTodo_workspaceId_status_dueAt_idx" ON "InboxTodo"("workspaceId", "status", "dueAt");

CREATE INDEX "Message_workspaceId_connectionId_sourceMessageId_idx" ON "Message"("workspaceId", "connectionId", "sourceMessageId");

CREATE INDEX "Message_workspaceId_deliveryStatus_idx" ON "Message"("workspaceId", "deliveryStatus");

CREATE UNIQUE INDEX "MessageAttachment_messageId_attachmentKey_key" ON "MessageAttachment"("messageId", "attachmentKey");

CREATE INDEX "MessageAttachment_messageId_position_idx" ON "MessageAttachment"("messageId", "position");

CREATE INDEX "MessageAttachment_workspaceId_createdAt_idx" ON "MessageAttachment"("workspaceId", "createdAt");

CREATE INDEX "MessageAttachment_workspaceId_externalMediaId_idx" ON "MessageAttachment"("workspaceId", "externalMediaId");

CREATE UNIQUE INDEX "PlatformAdmin_userId_key" ON "PlatformAdmin"("userId");

CREATE INDEX "PlatformAuditLog_action_idx" ON "PlatformAuditLog"("action");

CREATE INDEX "PlatformAuditLog_actorId_idx" ON "PlatformAuditLog"("actorId");

CREATE INDEX "PlatformAuditLog_createdAt_idx" ON "PlatformAuditLog"("createdAt");

CREATE INDEX "PlatformAuditLog_targetType_targetId_idx" ON "PlatformAuditLog"("targetType", "targetId");

CREATE UNIQUE INDEX "PresenceDomain_hostname_key" ON "PresenceDomain"("hostname");

CREATE INDEX "PresenceDomain_siteId_isPrimary_idx" ON "PresenceDomain"("siteId", "isPrimary");

CREATE INDEX "PresenceDomain_workspaceId_siteId_idx" ON "PresenceDomain"("workspaceId", "siteId");

CREATE INDEX "PresenceMedia_sourceMediaId_idx" ON "PresenceMedia"("sourceMediaId");

CREATE INDEX "PresenceMedia_workspaceId_kind_idx" ON "PresenceMedia"("workspaceId", "kind");

CREATE INDEX "PresenceMedia_workspaceId_siteId_idx" ON "PresenceMedia"("workspaceId", "siteId");

CREATE INDEX "PresencePublication_siteId_state_idx" ON "PresencePublication"("siteId", "state");

CREATE INDEX "PresencePublication_workspaceId_siteId_createdAt_idx" ON "PresencePublication"("workspaceId", "siteId", "createdAt");

CREATE UNIQUE INDEX "PresenceSite_slug_key" ON "PresenceSite"("slug");

CREATE INDEX "PresenceSite_status_idx" ON "PresenceSite"("status");

CREATE UNIQUE INDEX "PresenceSite_workspaceId_key" ON "PresenceSite"("workspaceId");

CREATE UNIQUE INDEX "PresenceSubscription_workspaceId_key" ON "PresenceSubscription"("workspaceId");

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

CREATE UNIQUE INDEX "Vertical_key_key" ON "Vertical"("key");

CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

CREATE INDEX "Workspace_status_idx" ON "Workspace"("status");

CREATE UNIQUE INDEX "WorkspaceMember_userId_workspaceId_key" ON "WorkspaceMember"("userId", "workspaceId");

CREATE INDEX "WorkspaceTask_workspaceId_assigneeId_idx" ON "WorkspaceTask"("workspaceId", "assigneeId");

CREATE INDEX "WorkspaceTask_workspaceId_conversationId_idx" ON "WorkspaceTask"("workspaceId", "conversationId");

CREATE INDEX "WorkspaceTask_workspaceId_dueAt_idx" ON "WorkspaceTask"("workspaceId", "dueAt");

CREATE INDEX "WorkspaceTask_workspaceId_proyectoId_idx" ON "WorkspaceTask"("workspaceId", "proyectoId");

CREATE INDEX "WorkspaceTask_workspaceId_sourceType_sourceId_idx" ON "WorkspaceTask"("workspaceId", "sourceType", "sourceId");

CREATE INDEX "WorkspaceTask_workspaceId_status_idx" ON "WorkspaceTask"("workspaceId", "status");

CREATE INDEX "WorkspaceTask_workspaceId_tareaId_idx" ON "WorkspaceTask"("workspaceId", "tareaId");
