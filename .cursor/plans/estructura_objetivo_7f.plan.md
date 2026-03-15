---
name: estructura objetivo 7f
overview: Estructura final del repositorio 7F con mapa de migración archivo por archivo, diseño del module manifest, sistema de registro para Mr Forte, y pasos seguros para reorganizar sin romper imports.
todos:
  - id: estructura-final
    content: Definir estructura final de carpetas del repo
    status: completed
  - id: mapa-migracion
    content: Asignar cada archivo/carpeta actual a su destino futuro
    status: completed
  - id: engines
    content: Diseñar qué partes se convierten en engines
    status: completed
  - id: modules
    content: Definir qué permanece como modules y su contrato
    status: completed
  - id: tools
    content: Identificar qué archivos serán tools
    status: completed
  - id: module-manifest
    content: Diseñar el concepto de module manifest
    status: completed
  - id: registry
    content: Diseñar el sistema de registro para Mr Forte
    status: completed
  - id: pasos-migracion
    content: Definir pasos seguros para reorganizar sin romper imports
    status: completed
isProject: false
---

# Estructura Objetivo — 7F

## 1. Estructura final del repositorio

```
7f/
│
├── app/                           # Next.js App Router (capa delgada)
│   ├── (backoffice)/              # Route group: app interna
│   │   ├── clientes/
│   │   ├── proyectos/
│   │   ├── tareas/
│   │   ├── facturacion/
│   │   ├── finanzas/
│   │   ├── calendario/
│   │   ├── contenido/
│   │   ├── inbox/
│   │   ├── archivos/
│   │   ├── notificaciones/
│   │   ├── historial/
│   │   ├── usuarios/
│   │   ├── motor/
│   │   ├── agente/
│   │   ├── assistant/
│   │   ├── automatizaciones/
│   │   ├── administracion/
│   │   ├── admin/
│   │   ├── comunicacion/
│   │   ├── departamentos/
│   │   ├── identidad/
│   │   ├── biblioteca/
│   │   ├── entrada/
│   │   ├── requests/
│   │   ├── projects/
│   │   ├── layout.tsx              # Layout backoffice (sidebar, copilot)
│   │   └── page.tsx                # Dashboard
│   │
│   ├── (portal)/                  # Route group: portal de clientes
│   │   └── cliente/
│   │       ├── login/
│   │       ├── dashboard/
│   │       ├── proyecto/
│   │       ├── facturas/
│   │       ├── solicitudes/
│   │       ├── archivos/
│   │       ├── perfil/
│   │       └── layout.tsx
│   │
│   ├── api/                       # Se mantiene (thin handlers que delegan a lib/)
│   │   └── [misma estructura]
│   │
│   ├── login/
│   ├── layout.tsx                 # Root layout
│   ├── page.tsx                   # Redirect o landing
│   └── globals.css
│
├── core/                          # Infraestructura esencial del sistema
│   ├── db/
│   │   ├── index.ts               # Cliente Prisma (ex lib/db.ts)
│   │   └── types.ts               # Tipos compartidos de DB
│   │
│   ├── auth/
│   │   ├── session.ts             # Sesión JWT usuarios
│   │   ├── client-session.ts      # Sesión JWT portal
│   │   ├── password.ts            # Hash/verificación
│   │   ├── google.ts              # OAuth Google
│   │   ├── permissions.ts         # Roles y rutas
│   │   ├── workspace-auth.ts      # RBAC por workspace
│   │   ├── portal-context.ts      # Contexto portal cliente
│   │   └── index.ts               # Barrel
│   │
│   ├── workspace/
│   │   ├── workspace.ts           # Gestión de workspaces
│   │   ├── context.ts             # Resolución workspace activo
│   │   ├── verticals.ts           # Configuración de verticales
│   │   └── index.ts
│   │
│   ├── api/
│   │   ├── responses.ts           # successResponse, errorResponse, handleError
│   │   ├── client.ts              # apiFetch, apiPost (frontend)
│   │   └── index.ts
│   │
│   ├── activity/
│   │   ├── index.ts               # logActivity, detectChanges
│   │   └── types.ts
│   │
│   ├── notifications/
│   │   ├── index.ts               # createNotification, notifyAdmins
│   │   └── types.ts
│   │
│   ├── storage/
│   │   └── index.ts               # uploadToStorage, deleteFromStorage
│   │
│   ├── registry/                  # Sistema de descubrimiento para Mr Forte
│   │   ├── module-registry.ts     # Registry de módulos
│   │   ├── engine-registry.ts     # Registry de engines
│   │   ├── tool-registry.ts       # Registry de tools
│   │   ├── types.ts               # ModuleManifest, EngineManifest, ToolManifest
│   │   └── index.ts               # init(), getRegistry()
│   │
│   ├── utils.ts                   # cn() y utilidades genéricas
│   └── index.ts                   # Barrel export de todo core
│
├── engines/                       # Sistemas complejos con lógica propia
│   │
│   ├── ai/                        # AI Engine
│   │   ├── providers/
│   │   │   ├── openai.ts          # ex lib/openai.ts + lib/ai/gpt.ts (unificado)
│   │   │   ├── deepseek.ts        # ex lib/ai/deepseek.ts
│   │   │   └── index.ts
│   │   ├── modes.ts               # ex lib/aiModes.ts
│   │   ├── prompts/               # Prompts por dominio
│   │   │   ├── tareas.ts
│   │   │   ├── proyectos.ts
│   │   │   ├── clientes.ts
│   │   │   ├── finanzas.ts
│   │   │   ├── facturas.ts
│   │   │   └── index.ts
│   │   ├── router.ts              # ex lib/ai/index.ts (askMotorIA, enrutamiento)
│   │   ├── manifest.ts            # EngineManifest
│   │   └── index.ts
│   │
│   ├── agent/                     # Agent Engine
│   │   ├── system-prompt.ts       # ex lib/agent/system-prompt.ts
│   │   ├── executor.ts            # ex lib/agent/executor.ts (+ workspaceId)
│   │   ├── image-generator.ts     # ex lib/agent/image-generator.ts
│   │   ├── tool-registry.ts       # Registry de tools del agente (dinámico)
│   │   ├── types.ts               # ToolDefinition, ToolResult
│   │   ├── manifest.ts
│   │   └── index.ts
│   │
│   ├── inbox/                     # Inbox/Conversation Engine
│   │   ├── conversations/
│   │   │   ├── service.ts         # CRUD conversaciones
│   │   │   ├── state-machine.ts   # ex lib/modules/inbox/state.ts
│   │   │   └── types.ts
│   │   ├── contacts/
│   │   │   ├── service.ts         # CRUD contactos
│   │   │   └── types.ts
│   │   ├── messages/
│   │   │   ├── service.ts         # CRUD mensajes
│   │   │   └── types.ts
│   │   ├── intelligence/
│   │   │   ├── classifier.ts      # Clasificación IA
│   │   │   ├── handoff.ts         # Smart handoff
│   │   │   ├── drafts.ts          # Ghost drafts
│   │   │   ├── actions.ts         # Acciones sugeridas
│   │   │   ├── pipeline.ts        # Orquestación del pipeline
│   │   │   └── index.ts
│   │   ├── conversion/
│   │   │   └── crm-converter.ts   # Conversión a Cliente/Proyecto/Tarea
│   │   ├── manifest.ts
│   │   └── index.ts
│   │
│   ├── automation/                # Automation Engine
│   │   ├── triggers/
│   │   │   ├── task-triggers.ts   # Detección retrasos
│   │   │   ├── project-triggers.ts# Detección bloqueos
│   │   │   ├── invoice-triggers.ts# Detección vencimientos
│   │   │   └── index.ts
│   │   ├── actions/
│   │   │   └── index.ts           # Acciones ejecutables
│   │   ├── scheduler.ts           # Futuro: scheduler/cola
│   │   ├── manifest.ts
│   │   └── index.ts
│   │
│   └── document-processing/       # Document Processing Engine
│       ├── ocr.ts                 # ex lib/ocr.ts
│       ├── scanner.ts             # ex lib/scan.ts
│       ├── pipeline.ts            # Orquestación: extracción → análisis
│       ├── manifest.ts
│       └── index.ts
│
├── modules/                       # Módulos de negocio (CRUD + validación)
│   │
│   ├── clientes/
│   │   ├── service.ts             # CRUD
│   │   ├── validation.ts          # Schemas Zod
│   │   ├── tools.ts               # Tools para el agente (buscar_clientes, etc.)
│   │   ├── manifest.ts            # ModuleManifest
│   │   └── index.ts
│   │
│   ├── proyectos/
│   │   ├── service.ts
│   │   ├── validation.ts
│   │   ├── access.ts              # ex lib/project-access.ts
│   │   ├── tools.ts
│   │   ├── manifest.ts
│   │   └── index.ts
│   │
│   ├── tareas/
│   │   ├── service.ts
│   │   ├── validation.ts
│   │   ├── tools.ts
│   │   ├── manifest.ts
│   │   └── index.ts
│   │
│   ├── facturacion/
│   │   ├── service.ts
│   │   ├── validation.ts
│   │   ├── tools.ts
│   │   ├── manifest.ts
│   │   └── index.ts
│   │
│   ├── finanzas/
│   │   ├── service.ts
│   │   ├── validation.ts
│   │   ├── manifest.ts
│   │   └── index.ts
│   │
│   ├── calendario/
│   │   ├── service.ts
│   │   ├── validation.ts
│   │   ├── manifest.ts
│   │   └── index.ts
│   │
│   ├── contenido/
│   │   ├── service.ts
│   │   ├── validation.ts
│   │   ├── tools.ts               # crear_contenido, crear_idea
│   │   ├── manifest.ts
│   │   └── index.ts
│   │
│   ├── campanas/
│   │   ├── service.ts
│   │   ├── validation.ts
│   │   ├── tools.ts               # crear_campana
│   │   ├── manifest.ts
│   │   └── index.ts
│   │
│   ├── notas/
│   │   ├── service.ts
│   │   ├── validation.ts
│   │   ├── manifest.ts
│   │   └── index.ts
│   │
│   ├── documentos/
│   │   ├── service.ts
│   │   ├── validation.ts
│   │   ├── manifest.ts
│   │   └── index.ts
│   │
│   ├── usuarios/
│   │   ├── service.ts
│   │   ├── validation.ts
│   │   ├── manifest.ts
│   │   └── index.ts
│   │
│   └── automatizaciones/
│       ├── service.ts
│       ├── validation.ts
│       ├── manifest.ts
│       └── index.ts
│
├── tools/                         # Utilidades independientes
│   ├── qr/
│   │   ├── index.ts               # ex lib/qr.ts
│   │   └── manifest.ts
│   ├── csv-export/
│   │   ├── index.ts               # ex lib/export/csv.ts
│   │   └── manifest.ts
│   └── index.ts
│
├── components/                    # Componentes React
│   ├── ui/                        # shadcn/ui (sin cambios)
│   │   └── [~55 componentes]
│   │
│   ├── layout/                    # Shells, sidebars, headers
│   │   ├── app-shell.tsx
│   │   ├── app-sidebar.tsx
│   │   ├── app-header.tsx
│   │   ├── sidebar-nav.tsx
│   │   ├── context-shell.tsx
│   │   ├── context-bar.tsx
│   │   ├── section-page.tsx
│   │   ├── client-portal-shell.tsx
│   │   └── copilot-panel.tsx
│   │
│   ├── shared/                    # Componentes reutilizables
│   │   ├── confirm-modal.tsx
│   │   ├── smart-modal.tsx
│   │   ├── smart-action.tsx
│   │   ├── empty-state.tsx
│   │   ├── inline-edit.tsx
│   │   ├── detail-section.tsx
│   │   ├── relation-list.tsx
│   │   ├── relation-select.tsx
│   │   ├── assign-modal.tsx
│   │   ├── upload-area.tsx
│   │   ├── export-button.tsx
│   │   ├── stat-card.tsx
│   │   ├── skeleton-loader.tsx
│   │   ├── pdf-viewer.tsx
│   │   ├── role-gate.tsx
│   │   ├── activity-timeline.tsx
│   │   ├── comments-section.tsx
│   │   ├── app-chat.tsx
│   │   ├── user-menu.tsx
│   │   ├── global-search.tsx
│   │   └── global-search-provider.tsx
│   │
│   ├── clientes/                  # Componentes específicos de clientes
│   │   ├── client-tabs.tsx
│   │   ├── client-billing-tab.tsx
│   │   ├── client-documents-tab.tsx
│   │   └── client-portal-access.tsx
│   │
│   ├── proyectos/                 # Componentes específicos de proyectos
│   │   ├── project-tabs.tsx
│   │   └── project-review-tab.tsx
│   │
│   ├── contenido/                 # Componentes específicos de contenido
│   │   ├── content-list.tsx
│   │   ├── content-calendar.tsx
│   │   ├── content-ideas.tsx
│   │   └── content-ai.tsx
│   │
│   ├── qr/                        # Componentes de QR
│   │   ├── qr-code-modal.tsx
│   │   └── saved-qr-codes.tsx
│   │
│   ├── notifications/             # Componentes de notificaciones
│   │   ├── notifications-bell.tsx
│   │   └── notifications-panel.tsx
│   │
│   ├── forms/                     # Formularios (sin cambios)
│   │   └── [9 formularios]
│   │
│   ├── templates/                 # Templates PDF (sin cambios)
│   │   └── [3 templates]
│   │
│   └── providers/                 # Providers de contexto
│       ├── theme-provider.tsx
│       └── toast-provider.tsx
│
├── hooks/                         # Sin cambios
│   ├── use-fetch.ts
│   ├── use-mobile.ts
│   ├── use-toast.ts
│   ├── use-user.tsx
│   └── use-client-user.tsx
│
├── prisma/                        # Sin cambios
│   ├── schema.prisma
│   ├── seed.ts
│   └── push-turso.ts
│
├── scripts/                       # Sin cambios
│   └── checkTables.ts
│
├── styles/                        # Sin cambios
│   └── globals.css
│
├── middleware.ts                   # Sin cambios
│
└── [config raíz]                  # Sin cambios
    ├── package.json
    ├── tsconfig.json
    ├── next.config.mjs
    ├── postcss.config.mjs
    ├── prisma.config.ts
    ├── components.json
    └── .env
```

---

## 2. Mapa de migración archivo por archivo

### 2.1 lib/ raíz → core/

| Origen | Destino | Notas |
|--------|---------|-------|
| `lib/db.ts` | `core/db/index.ts` | Sin cambios internos |
| `lib/api.ts` | `core/api/responses.ts` | Renombrar para claridad |
| `lib/api-client.ts` | `core/api/client.ts` | Es código de frontend |
| `lib/utils.ts` | `core/utils.ts` | Sin cambios |
| `lib/storage.ts` | `core/storage/index.ts` | Sin cambios |
| `lib/activity.ts` | `core/activity/index.ts` | Sin cambios |
| `lib/notifications.ts` | `core/notifications/index.ts` | Sin cambios |
| `lib/workspace.ts` | `core/workspace/workspace.ts` | Sin cambios |
| `lib/workspace-context.ts` | `core/workspace/context.ts` | Sin cambios |
| `lib/verticals.ts` | `core/workspace/verticals.ts` | Sin cambios |

### 2.2 lib/auth/ → core/auth/

| Origen | Destino | Notas |
|--------|---------|-------|
| `lib/auth/session.ts` | `core/auth/session.ts` | Sin cambios |
| `lib/auth/client-session.ts` | `core/auth/client-session.ts` | Sin cambios |
| `lib/auth/password.ts` | `core/auth/password.ts` | Sin cambios |
| `lib/auth/google.ts` | `core/auth/google.ts` | Sin cambios |
| `lib/auth/permissions.ts` | `core/auth/permissions.ts` | Sin cambios |
| `lib/auth/workspace-auth.ts` | `core/auth/workspace-auth.ts` | Actualizar import de workspace |
| `lib/auth/portal-context.ts` | `core/auth/portal-context.ts` | Sin cambios |

### 2.3 lib/ai/ + archivos sueltos → engines/ai/

| Origen | Destino | Notas |
|--------|---------|-------|
| `lib/ai/index.ts` | `engines/ai/router.ts` | Renombrar: es el router de IA |
| `lib/ai/gpt.ts` | `engines/ai/providers/openai.ts` | Unificar con lib/openai.ts |
| `lib/ai/deepseek.ts` | `engines/ai/providers/deepseek.ts` | Sin cambios internos |
| `lib/openai.ts` | `engines/ai/providers/openai.ts` | Unificar con lib/ai/gpt.ts |
| `lib/aiModes.ts` | `engines/ai/modes.ts` | Sin cambios internos |
| (prompts en ai/index.ts) | `engines/ai/prompts/*.ts` | Extraer prompts por dominio |

### 2.4 lib/agent/ → engines/agent/

| Origen | Destino | Notas |
|--------|---------|-------|
| `lib/agent/system-prompt.ts` | `engines/agent/system-prompt.ts` | Sin cambios |
| `lib/agent/tools.ts` | `engines/agent/tool-registry.ts` | Convertir a registry dinámico |
| `lib/agent/executor.ts` | `engines/agent/executor.ts` | Agregar workspaceId |
| `lib/agent/image-generator.ts` | `engines/agent/image-generator.ts` | Sin cambios |

### 2.5 lib/modules/inbox/ + lib/inbox.ts → engines/inbox/

| Origen | Destino | Notas |
|--------|---------|-------|
| `lib/modules/inbox/service.ts` | `engines/inbox/conversations/service.ts` + `engines/inbox/contacts/service.ts` | Separar por subdominio |
| `lib/modules/inbox/state.ts` | `engines/inbox/conversations/state-machine.ts` | Sin cambios internos |
| `lib/modules/inbox/intelligence.ts` | `engines/inbox/intelligence/pipeline.ts` | Sin cambios internos |
| `lib/inbox.ts` | `engines/inbox/intelligence/classifier.ts` | Clasificación y análisis |

### 2.6 lib/automations/ → engines/automation/

| Origen | Destino | Notas |
|--------|---------|-------|
| `lib/automations/index.ts` | `engines/automation/index.ts` | Barrel |
| `lib/automations/tasks.ts` | `engines/automation/triggers/task-triggers.ts` | Sin cambios internos |
| `lib/automations/projects.ts` | `engines/automation/triggers/project-triggers.ts` | Sin cambios internos |
| `lib/automations/invoices.ts` | `engines/automation/triggers/invoice-triggers.ts` | Sin cambios internos |

### 2.7 lib/ocr.ts + lib/scan.ts → engines/document-processing/

| Origen | Destino | Notas |
|--------|---------|-------|
| `lib/ocr.ts` | `engines/document-processing/ocr.ts` | Sin cambios internos |
| `lib/scan.ts` | `engines/document-processing/scanner.ts` | Sin cambios internos |

### 2.8 lib/modules/ → modules/

| Origen | Destino | Notas |
|--------|---------|-------|
| `lib/modules/clientes/` | `modules/clientes/` | Agregar manifest.ts, tools.ts, index.ts |
| `lib/modules/proyectos/` | `modules/proyectos/` | Agregar manifest.ts, tools.ts, index.ts |
| `lib/modules/tareas/` | `modules/tareas/` | Agregar manifest.ts, tools.ts, index.ts |
| `lib/modules/facturacion/` | `modules/facturacion/` | Agregar manifest.ts, tools.ts, index.ts |
| `lib/modules/finanzas/` | `modules/finanzas/` | Agregar manifest.ts, index.ts |
| `lib/modules/calendario/` | `modules/calendario/` | Agregar manifest.ts, index.ts |
| `lib/modules/contenido/` | `modules/contenido/` | Agregar manifest.ts, tools.ts, index.ts |
| `lib/modules/campanas/` | `modules/campanas/` | Agregar manifest.ts, tools.ts, index.ts |
| `lib/modules/notas/` | `modules/notas/` | Agregar manifest.ts, index.ts |
| `lib/modules/documentos/` | `modules/documentos/` | Agregar manifest.ts, index.ts |
| `lib/modules/usuarios/` | `modules/usuarios/` | Agregar manifest.ts, index.ts |
| `lib/modules/automatizaciones/` | `modules/automatizaciones/` | Agregar manifest.ts, index.ts |

### 2.9 Tools sueltos → tools/

| Origen | Destino | Notas |
|--------|---------|-------|
| `lib/qr.ts` | `tools/qr/index.ts` | Sin cambios internos |
| `lib/export/csv.ts` | `tools/csv-export/index.ts` | Sin cambios internos |
| `lib/project-access.ts` | `modules/proyectos/access.ts` | Es lógica de módulo, no tool |

### 2.10 components/ → components/ (reorganizar)

| Origen | Destino |
|--------|---------|
| `components/ui/*` | `components/ui/*` (sin cambios) |
| `components/forms/*` | `components/forms/*` (sin cambios) |
| `components/templates/*` | `components/templates/*` (sin cambios) |
| `components/app-shell.tsx` | `components/layout/app-shell.tsx` |
| `components/app-sidebar.tsx` | `components/layout/app-sidebar.tsx` |
| `components/app-header.tsx` | `components/layout/app-header.tsx` |
| `components/sidebar-nav.tsx` | `components/layout/sidebar-nav.tsx` |
| `components/context-shell.tsx` | `components/layout/context-shell.tsx` |
| `components/context-bar.tsx` | `components/layout/context-bar.tsx` |
| `components/section-page.tsx` | `components/layout/section-page.tsx` |
| `components/copilot-panel.tsx` | `components/layout/copilot-panel.tsx` |
| `components/client-portal-shell.tsx` | `components/layout/client-portal-shell.tsx` |
| `components/client-tabs.tsx` | `components/clientes/client-tabs.tsx` |
| `components/client-billing-tab.tsx` | `components/clientes/client-billing-tab.tsx` |
| `components/client-documents-tab.tsx` | `components/clientes/client-documents-tab.tsx` |
| `components/client-portal-access.tsx` | `components/clientes/client-portal-access.tsx` |
| `components/project-tabs.tsx` | `components/proyectos/project-tabs.tsx` |
| `components/project-review-tab.tsx` | `components/proyectos/project-review-tab.tsx` |
| `components/content-list.tsx` | `components/contenido/content-list.tsx` |
| `components/content-calendar.tsx` | `components/contenido/content-calendar.tsx` |
| `components/content-ideas.tsx` | `components/contenido/content-ideas.tsx` |
| `components/content-ai.tsx` | `components/contenido/content-ai.tsx` |
| `components/qr-code-modal.tsx` | `components/qr/qr-code-modal.tsx` |
| `components/saved-qr-codes.tsx` | `components/qr/saved-qr-codes.tsx` |
| `components/notifications-bell.tsx` | `components/notifications/notifications-bell.tsx` |
| `components/notifications-panel.tsx` | `components/notifications/notifications-panel.tsx` |
| `components/theme-provider.tsx` | `components/providers/theme-provider.tsx` |
| `components/toast-provider.tsx` | `components/providers/toast-provider.tsx` |
| `components/confirm-modal.tsx` | `components/shared/confirm-modal.tsx` |
| `components/smart-modal.tsx` | `components/shared/smart-modal.tsx` |
| `components/smart-action.tsx` | `components/shared/smart-action.tsx` |
| `components/empty-state.tsx` | `components/shared/empty-state.tsx` |
| `components/inline-edit.tsx` | `components/shared/inline-edit.tsx` |
| `components/detail-section.tsx` | `components/shared/detail-section.tsx` |
| `components/relation-list.tsx` | `components/shared/relation-list.tsx` |
| `components/relation-select.tsx` | `components/shared/relation-select.tsx` |
| `components/assign-modal.tsx` | `components/shared/assign-modal.tsx` |
| `components/upload-area.tsx` | `components/shared/upload-area.tsx` |
| `components/export-button.tsx` | `components/shared/export-button.tsx` |
| `components/stat-card.tsx` | `components/shared/stat-card.tsx` |
| `components/skeleton-loader.tsx` | `components/shared/skeleton-loader.tsx` |
| `components/pdf-viewer.tsx` | `components/shared/pdf-viewer.tsx` |
| `components/role-gate.tsx` | `components/shared/role-gate.tsx` |
| `components/activity-timeline.tsx` | `components/shared/activity-timeline.tsx` |
| `components/comments-section.tsx` | `components/shared/comments-section.tsx` |
| `components/app-chat.tsx` | `components/shared/app-chat.tsx` |
| `components/user-menu.tsx` | `components/shared/user-menu.tsx` |
| `components/global-search.tsx` | `components/shared/global-search.tsx` |
| `components/global-search-provider.tsx` | `components/shared/global-search-provider.tsx` |

---

## 3. Diseño de engines

### 3.1 Qué define a un engine vs un module

| Aspecto | Module | Engine |
|---------|--------|--------|
| Complejidad | CRUD + validación | Lógica de negocio compleja, pipelines, FSM |
| Estado | Stateless (request-response) | Puede tener estado (FSM, colas) |
| Dependencias | Solo core | Core + puede consumir otros modules |
| Consumidores | API routes, agente | API routes, agente, otros engines, módulos |
| Patrón | service.ts + validation.ts | Múltiples componentes internos orquestados |
| Descubrimiento | ModuleManifest | EngineManifest |

### 3.2 Los 5 engines

#### AI Engine (`engines/ai/`)

```
Responsabilidad: Enrutamiento multi-modelo, modos, prompts
Entradas:     prompt, mode, history
Salida:       respuesta de IA
Interfaz:     askMotorIA(prompt, mode), askWithHistory(messages, mode)
Registra:     Proveedores (OpenAI, DeepSeek), Modos, Prompts
Extensible:   Módulos pueden registrar prompts y modos propios
```

#### Agent Engine (`engines/agent/`)

```
Responsabilidad: Agente con function calling
Entradas:     mensaje del usuario, workspaceId, tools disponibles
Salida:       respuesta + tool calls ejecutados
Interfaz:     runAgent(message, workspaceId, availableTools)
Registra:     Tools (desde módulos), System prompt fragments
Extensible:   Cada módulo registra sus tools via manifest
Dependencias: AI Engine (para LLM), Core/DB (para ejecución)
```

#### Inbox Engine (`engines/inbox/`)

```
Responsabilidad: Conversaciones, pipeline IA, conversión CRM
Entradas:     mensajes entrantes (cualquier canal)
Salida:       conversaciones clasificadas, acciones sugeridas, entidades CRM
Interfaz:     ingestMessage(), classifyConversation(), convertToCRM()
Registra:     Canales (web, email, whatsapp), Procesadores
Extensible:   Adaptadores de canal, reglas de clasificación
Dependencias: AI Engine, módulos CRM (clientes, proyectos, tareas)
```

#### Automation Engine (`engines/automation/`)

```
Responsabilidad: Triggers, condiciones, acciones automáticas
Entradas:     eventos del sistema (CRUD, timer, webhook)
Salida:       acciones ejecutadas o sugeridas
Interfaz:     registerTrigger(), evaluateConditions(), executeAction()
Registra:     Triggers (por módulo), Actions (por módulo)
Extensible:   Cada módulo puede registrar triggers y acciones
Dependencias: AI Engine (para análisis), módulos (para datos)
```

#### Document Processing Engine (`engines/document-processing/`)

```
Responsabilidad: OCR, análisis, clasificación de documentos
Entradas:     archivo (imagen, PDF)
Salida:       texto extraído, metadatos, clasificación
Interfaz:     processDocument(file), analyzeDocument(text)
Registra:     Procesadores (OCR, PDF parser), Clasificadores
Extensible:   Nuevos tipos de documento, nuevos proveedores OCR
Dependencias: AI Engine (para clasificación), Core/Storage
```

---

## 4. Diseño del Module Manifest

### 4.1 Tipo TypeScript

```typescript
interface ModuleManifest {
  // Identidad
  id: string;                        // "clientes", "proyectos", etc.
  name: string;                      // "Clientes"
  description: string;               // "Gestión de clientes y CRM"
  version: string;                   // "1.0.0"
  icon?: string;                     // "users" (lucide icon name)

  // Dependencias
  dependencies: string[];            // ["core/db", "core/auth"]
  optionalDependencies?: string[];   // ["engines/ai"]

  // Capacidades que expone
  capabilities: {
    crud: boolean;                   // Expone operaciones CRUD
    search: boolean;                 // Puede ser buscado globalmente
    export: boolean;                 // Soporta exportación
    ai: boolean;                     // Tiene integración con IA
    portal: boolean;                 // Visible en portal de clientes
  };

  // Modelos Prisma que gestiona
  models: string[];                  // ["Cliente", "ClientAuth"]

  // Tools que expone al agente
  tools?: AgentToolDefinition[];

  // Rutas API que registra
  routes?: RouteDefinition[];

  // Hooks de ciclo de vida
  hooks?: {
    onRegister?: () => Promise<void>;
    onActivate?: (workspaceId: string) => Promise<void>;
    onDeactivate?: (workspaceId: string) => Promise<void>;
  };

  // Configuración por vertical
  verticalDefaults?: Record<string, {
    enabled: boolean;
    config?: Record<string, unknown>;
  }>;
}

interface AgentToolDefinition {
  name: string;                      // "buscar_clientes"
  description: string;               // "Busca clientes por nombre, email o empresa"
  type: "read" | "write" | "generate";
  parameters: Record<string, ToolParameter>;
  handler: string;                   // Ruta al handler: "modules/clientes/tools#buscarClientes"
}

interface RouteDefinition {
  path: string;                      // "/api/clientes"
  methods: ("GET" | "POST" | "PATCH" | "DELETE")[];
  auth: "public" | "user" | "admin" | "portal";
}

interface ToolParameter {
  type: "string" | "number" | "boolean" | "enum";
  description: string;
  required: boolean;
  enum?: string[];
}
```

### 4.2 Ejemplo concreto: manifest de clientes

```typescript
// modules/clientes/manifest.ts
import type { ModuleManifest } from "@/core/registry/types";

export const manifest: ModuleManifest = {
  id: "clientes",
  name: "Clientes",
  description: "Gestión de clientes, empresas y contactos comerciales",
  version: "1.0.0",
  icon: "users",

  dependencies: ["core/db", "core/auth"],
  optionalDependencies: ["engines/ai", "engines/inbox"],

  capabilities: {
    crud: true,
    search: true,
    export: true,
    ai: true,
    portal: true,
  },

  models: ["Cliente", "ClientAuth", "ClientProject", "ClientInvoice",
           "ClientFile", "ClientAsset", "ClientRequest", "ClientRequestAsset"],

  tools: [
    {
      name: "buscar_clientes",
      description: "Busca clientes por nombre, email o empresa",
      type: "read",
      parameters: {
        query: { type: "string", description: "Término de búsqueda", required: true },
      },
      handler: "modules/clientes/tools#buscarClientes",
    },
    {
      name: "detalle_cliente",
      description: "Obtiene detalle completo de un cliente con proyectos y facturas",
      type: "read",
      parameters: {
        clienteId: { type: "string", description: "ID del cliente", required: true },
      },
      handler: "modules/clientes/tools#detalleCliente",
    },
  ],

  routes: [
    { path: "/api/clientes", methods: ["GET", "POST"], auth: "user" },
    { path: "/api/clientes/:id", methods: ["GET", "PATCH", "DELETE"], auth: "user" },
  ],

  verticalDefaults: {
    agencia: { enabled: true },
    consultoria: { enabled: true },
    freelance: { enabled: true, config: { simplifiedView: true } },
  },
};
```

### 4.3 Ejemplo: manifest de un engine

```typescript
// engines/ai/manifest.ts
import type { EngineManifest } from "@/core/registry/types";

export const manifest: EngineManifest = {
  id: "ai",
  name: "AI Engine",
  description: "Motor de IA multi-modelo con enrutamiento por modo",
  version: "1.0.0",

  dependencies: [],
  provides: ["ai:completion", "ai:chat", "ai:modes"],

  providers: [
    { id: "openai", name: "OpenAI", models: ["gpt-4.1"] },
    { id: "deepseek", name: "DeepSeek", models: ["deepseek-reasoner"] },
  ],

  extensionPoints: [
    {
      id: "ai:register-mode",
      description: "Registrar un nuevo modo de IA con prompt y parámetros",
      interface: "AIMode",
    },
    {
      id: "ai:register-prompt",
      description: "Registrar un prompt de dominio específico",
      interface: "DomainPrompt",
    },
  ],
};
```

---

## 5. Sistema de registro para Mr Forte

### 5.1 Registry central

```typescript
// core/registry/module-registry.ts

import type { ModuleManifest, EngineManifest, ToolManifest } from "./types";

class ModuleRegistry {
  private modules = new Map<string, ModuleManifest>();
  private engines = new Map<string, EngineManifest>();
  private tools = new Map<string, ToolManifest>();
  private initialized = false;

  async discover(): Promise<void> {
    // Auto-discovery: escanea modules/, engines/, tools/
    // Importa manifest.ts de cada carpeta
    // Valida dependencias
    // Registra en los maps
  }

  async activate(moduleId: string, workspaceId: string): Promise<void> {
    const manifest = this.modules.get(moduleId);
    if (!manifest) throw new Error(`Module ${moduleId} not found`);

    // Verificar dependencias
    for (const dep of manifest.dependencies) {
      if (!this.isAvailable(dep)) {
        throw new Error(`Dependency ${dep} not available`);
      }
    }

    // Ejecutar hook
    await manifest.hooks?.onActivate?.(workspaceId);
  }

  async deactivate(moduleId: string, workspaceId: string): Promise<void> {
    const manifest = this.modules.get(moduleId);
    await manifest?.hooks?.onDeactivate?.(workspaceId);
  }

  // Queries para Mr Forte
  getActiveModules(workspaceId: string): ModuleManifest[] { /* ... */ }
  getAvailableTools(workspaceId: string): AgentToolDefinition[] { /* ... */ }
  getModuleByModel(modelName: string): ModuleManifest | undefined { /* ... */ }
  getCapableModules(capability: string): ModuleManifest[] { /* ... */ }

  private isAvailable(dep: string): boolean {
    if (dep.startsWith("core/")) return true; // Core siempre disponible
    if (dep.startsWith("engines/")) return this.engines.has(dep.replace("engines/", ""));
    return this.modules.has(dep);
  }
}

export const registry = new ModuleRegistry();
```

### 5.2 Flujo de inicialización

```
Arranque de la aplicación
        │
        ▼
registry.discover()
        │
        ├──► Escanear modules/*/manifest.ts
        ├──► Escanear engines/*/manifest.ts
        ├──► Escanear tools/*/manifest.ts
        │
        ▼
Validar dependencias (grafo topológico)
        │
        ▼
Registrar módulos, engines y tools
        │
        ▼
Mr Forte puede consultar:
  ├── registry.getActiveModules(workspaceId)
  ├── registry.getAvailableTools(workspaceId)
  ├── registry.getModuleByModel("Cliente")
  └── registry.getCapableModules("search")
```

### 5.3 Cómo Mr Forte usa el registry

```typescript
// Ejemplo: Mr Forte construye las tools disponibles para el agente
async function buildAgentContext(workspaceId: string) {
  const activeModules = registry.getActiveModules(workspaceId);
  const tools = activeModules.flatMap(m => m.tools ?? []);

  const systemPrompt = buildComposablePrompt(activeModules);

  return { tools, systemPrompt };
}

// Ejemplo: Mr Forte resuelve qué módulo maneja un modelo
function resolveModule(modelName: string) {
  return registry.getModuleByModel(modelName);
  // "Cliente" → modules/clientes
  // "Factura" → modules/facturacion
}

// Ejemplo: Mr Forte verifica si un módulo está activo en el workspace
function canUseModule(moduleId: string, workspaceId: string): boolean {
  const active = registry.getActiveModules(workspaceId);
  return active.some(m => m.id === moduleId);
}
```

---

## 6. Pasos seguros para reorganizar sin romper imports

### Principio clave

> Nunca romper más de un import a la vez.
> Cada paso debe dejar el proyecto compilable y funcional.

### Estrategia: path aliases + re-exports

El alias actual `@/*` mapea a `"./*"`. Todos los imports usan `@/lib/...`, `@/components/...`, etc. La migración se hace en fases:

### Fase 0 — Preparación (sin mover código)

**Paso 0.1**: Agregar path aliases nuevos en `tsconfig.json`:

```jsonc
{
  "paths": {
    "@/*": ["./*"],
    "@core/*": ["./core/*"],
    "@modules/*": ["./modules/*"],
    "@engines/*": ["./engines/*"],
    "@tools/*": ["./tools/*"]
  }
}
```

**Paso 0.2**: Crear `core/registry/types.ts` con las interfaces de `ModuleManifest`, `EngineManifest`, `ToolManifest`.

**Paso 0.3**: Crear `core/registry/module-registry.ts` con el registry vacío.

**Impacto**: 0 archivos rotos. Solo se agregan cosas nuevas.

---

### Fase 1 — Migrar core/ (base del sistema)

**Orden** (respetar dependencias, de menos dependencias a más):

| Paso | Mover | Re-export en origen | Imports afectados |
|------|-------|---------------------|-------------------|
| 1.1 | `lib/utils.ts` → `core/utils.ts` | `lib/utils.ts` re-exporta | ~60 (componentes ui) |
| 1.2 | `lib/db.ts` → `core/db/index.ts` | `lib/db.ts` re-exporta | ~30 |
| 1.3 | `lib/api.ts` → `core/api/responses.ts` | `lib/api.ts` re-exporta | ~70 |
| 1.4 | `lib/api-client.ts` → `core/api/client.ts` | `lib/api-client.ts` re-exporta | ~20 |
| 1.5 | `lib/storage.ts` → `core/storage/index.ts` | Re-export | ~3 |
| 1.6 | `lib/auth/*` → `core/auth/*` | Cada archivo re-exporta | ~50 |
| 1.7 | `lib/workspace.ts` → `core/workspace/workspace.ts` | Re-export | ~10 |
| 1.8 | `lib/workspace-context.ts` → `core/workspace/context.ts` | Re-export | ~5 |
| 1.9 | `lib/verticals.ts` → `core/workspace/verticals.ts` | Re-export | ~3 |
| 1.10 | `lib/activity.ts` → `core/activity/index.ts` | Re-export | ~8 |
| 1.11 | `lib/notifications.ts` → `core/notifications/index.ts` | Re-export | ~5 |

**Patrón de cada paso**:

```
1. Crear el archivo destino (copiar contenido)
2. Actualizar imports internos del archivo movido
3. Convertir el archivo origen en re-export:
   export { ... } from "@core/...";
4. Verificar que compila: npm run build
5. Commit
6. (Opcional, después) Actualizar consumidores para usar @core/ y eliminar re-export
```

---

### Fase 2 — Migrar modules/ (más fácil, patrón repetitivo)

| Paso | Mover | Notas |
|------|-------|-------|
| 2.1 | `lib/modules/clientes/` → `modules/clientes/` | Agregar manifest.ts e index.ts |
| 2.2 | `lib/modules/proyectos/` → `modules/proyectos/` | + `lib/project-access.ts` → `modules/proyectos/access.ts` |
| 2.3–2.12 | Repetir para los 10 módulos restantes | Mismo patrón |

**Patrón**:

```
1. Crear modules/{nombre}/ con los archivos
2. Crear modules/{nombre}/manifest.ts
3. Crear modules/{nombre}/index.ts (barrel)
4. Crear re-export en lib/modules/{nombre}/ → @modules/{nombre}
5. Verificar compilación
6. Commit
```

---

### Fase 3 — Migrar engines/

**Orden** (respetar dependencias entre engines):

| Paso | Engine | Dependencias |
|------|--------|-------------|
| 3.1 | `engines/ai/` | Ninguna engine |
| 3.2 | `engines/document-processing/` | AI Engine |
| 3.3 | `engines/agent/` | AI Engine |
| 3.4 | `engines/automation/` | AI Engine |
| 3.5 | `engines/inbox/` | AI Engine, módulos CRM |

**El paso más delicado es 3.5** (inbox) porque requiere separar un módulo sobredimensionado en subdominios.

---

### Fase 4 — Migrar tools/

| Paso | Mover |
|------|-------|
| 4.1 | `lib/qr.ts` → `tools/qr/index.ts` |
| 4.2 | `lib/export/csv.ts` → `tools/csv-export/index.ts` |

---

### Fase 5 — Reorganizar components/

| Paso | Grupo |
|------|-------|
| 5.1 | Crear `components/layout/` y mover shells/sidebars |
| 5.2 | Crear `components/shared/` y mover utilidades |
| 5.3 | Crear `components/clientes/`, `components/proyectos/`, `components/contenido/` |
| 5.4 | Crear `components/qr/`, `components/notifications/` |
| 5.5 | Crear `components/providers/` |

---

### Fase 6 — Limpiar re-exports

Una vez que todos los consumidores usan los nuevos paths:

1. Buscar todos los `import ... from "@/lib/..."` restantes
2. Reemplazar por `@core/`, `@modules/`, `@engines/`, `@tools/`
3. Eliminar los archivos re-export en `lib/`
4. Eliminar la carpeta `lib/` vacía
5. Build final

---

### Fase 7 — Activar descubrimiento automático

1. Implementar `registry.discover()` que escanea manifests
2. Conectar el agente para usar tools dinámicas del registry
3. Conectar la configuración de workspace con el registry
4. Mr Forte puede descubrir y activar módulos

---

## 7. Resumen de decisiones arquitectónicas

| Decisión | Justificación |
|----------|---------------|
| `core/` separado de `lib/` | El core no es "una librería más"; es la infraestructura que todo consume |
| `engines/` separado de `modules/` | Los engines tienen estado, pipelines y orquestación; los módulos son CRUD |
| `tools/` separado de ambos | Las tools no tienen dominio de negocio; son utilidades puras |
| Path aliases (`@core/`, `@modules/`, etc.) | Permiten migración gradual sin romper imports |
| Re-exports durante transición | Compatibilidad hacia atrás mientras se migran consumidores |
| Manifests como archivos `.ts` (no JSON) | Permiten hooks de ciclo de vida y tipos estáticos |
| Registry como singleton | Punto central de verdad para Mr Forte |
| `app/` no se reorganiza internamente (aún) | Las route groups (`(backoffice)`, `(portal)`) se pueden hacer después |

---

## 8. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Romper imports masivamente | Re-exports en origen + migración de un archivo a la vez |
| Build roto durante migración | Commit después de cada paso verificado |
| Conflictos en PR grandes | Dividir en PRs pequeños por fase |
| Discovery dinámico añade complejidad | Empezar con registry estático (import explícito de manifests) |
| Performance de auto-discovery | Cachear manifiests en memoria; solo escanear en arranque |
| Inbox engine es el paso más complejo | Hacerlo último; separar en sub-PRs |

---

*Plan generado el 15 de marzo de 2026. No se movió ni modificó código.*
