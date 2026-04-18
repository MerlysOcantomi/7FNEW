---
name: Inbox dark-first alignment
overview: Plan de adaptación de Inbox al sistema oscuro/tintado tipo Tasks (referencia), sin copiar Tasks, sin dashboard pesado ni modo claro—basado en app/inbox/page.tsx e inbox CSS tokens.
todos:
  - id: inbox-tokens-pass
    content: "Opción A/B: retocar --inbox-list-* / --inbox-chat-* en globals o capas en componentes"
    status: pending
  - id: inbox-columns-shell
    content: Unificar borde/sombra de las 3 columnas con patrón shell (--border-dark / elevación sutil)
    status: pending
  - id: inbox-list-chat
    content: ConversationList + list items + thread chrome hacia superficies tintadas
    status: pending
  - id: inbox-composer
    content: ReplyComposer / InputArea legibles sobre fondo más oscuro
    status: pending
  - id: inbox-verify-mobile
    content: Regresión layout móvil + split xl + lectura de burbujas
    status: pending
isProject: false
---

# Inbox — alineación dark-first (plan, sin implementar)

## 1. Diagnóstico actual (código real)

### Qué ya encaja

- **AppShell + `contentClassName="max-w-[1800px]"`**: Inbox ya vive en el mismo shell que Tasks (`[app/inbox/page.tsx](app/inbox/page.tsx)` ~1134).
- **Bleed controlado**: `-mx-4 -mt-2 … md:-mx-8` + `bg-[var(--inbox-background)]` — el fondo del área Inbox es `**--inbox-background` = `--app-canvas`** (`[globals.css](app/globals.css)` L143), coherente con el canvas oscuro del shell.
- **Grid de tres columnas** (`DESKTOP_INBOX_GRID`, minmax 30% / 1fr / 30%) — patrón split-view conservado en el contrato de scroll.
- **Columna derecha (inteligencia)**: ya usa `**--inbox-intelligence-background/surface`** mapeados a `**--app-surface-dark` / `--app-surface-dark-elevated`** con texto claro (L178–183 en `globals.css`) — **parcialmente alineada** con Tasks (`shellCard` / superficies oscuras).
- **Burbujas y gradiente outbound**: sistema propio (`--inbox-chat-bubble-*`) — legible y distintivo; no es “legacy genérico”.

### Qué choca con el sistema dark-first (vs Tasks como referencia de sistema)

- **Columnas lista + centro** están envueltas en `**rounded-2xl … shadow-lg shadow-black/5`** con fondos `**--inbox-list-background`** → `**--surface-1`** y `**--inbox-chat-surface`** → `**--surface-2`** (`[globals.css](app/globals.css)` L152–162): son **superficies claras tipo papel** sobre canvas morado — mismo tipo de tensión que Tasks resolvió pasando tarjetas a `**--app-surface-dark`** (no copiar UI, pero **misma familia de tokens de elevación**).
- **Lista** (`[conversation-list.tsx](components/inbox/conversation-list.tsx)`): cabecera “Inbox” en `**--inbox-list-surface`** (surface-2 claro) + texto `**--inbox-list-text`** (oscuro para papel claro) — se percibe **bloque blanco/lavanda flotante**, no “panel del shell”.
- **Centro (hilo + composer)**: fondos `**--inbox-chat-background`**, `**--inbox-surface`**, composer/input en tonos claros (`--inbox-composer-input` #F6F2FD, etc.) — **muy conversacional y legible**, pero **visualmente desacoplado** del canvas y de la columna derecha ya oscura.
- **Sombras fuertes** (`shadow-lg`) en las tres columnas: refuerzan la sensación de **tarjetas pegadas** frente al shell (Tasks redujo ese efecto con bordes `--border-dark` y sombras sutiles).

### Partes “demasiado legacy / claras”

- Tokens globales que anclan lista/chat a `**surface-1/2/3`** (papel claro) frente a la dirección **dark-first**.
- Componentes que asumen **texto oscuro sobre fondo claro** (`--inbox-list-text`, `--inbox-chat-text`) sin variante “sobre superficie tintada oscura”.
- **Skeletons** y estados vacíos que imitan el modelo claro actual — habrá que actualizarlos cuando cambien los fondos.

---

## 2. Estrategia de adaptación

- **Principio**: usar la **misma gramática de superficie** que Tasks (**canvas → paneles `--app-surface-dark` / elevado / `--border-dark` / texto claro donde el fondo es oscuro**), pero **sin** convertir Inbox en página de KPIs, filtros tipo bandeja pesada o densidad de dashboard.
- **Inbox sigue más ligero que Tasks**:
  - menos “bloques hero” y menos `gap-8` entre secciones macro;
  - foco en **lista compacta + hilo fluido + composer siempre accesible**;
  - **no** añadir tarjetas estadísticas nuevas ni duplicar el patrón de “filter tray” de Tasks.
- **Conversación primero**: el **centro** debe seguir leyéndose como chat (burbujas, contraste inbound/outbound); el cambio es **marco y cromática**, no reescritura del patrón de mensajes.

---

## 3. Estrategia de superficies (por columna)


| Columna                    | Rol                 | Dirección propuesta                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Izquierda (lista)**      | Escaneo rápido      | Pasar el **contenedor** de lista de “papel claro” a **panel tintado oscuro** (misma familia que Tasks: `app-surface-dark` + borde sutil). Filas seleccionadas pueden usar **acento morado suave** (ya existe `--inbox-list-selected-bg` — retocar para que funcione sobre fondo oscuro). Mantener **densidad** de filas (compact).                                                                                             |
| **Centro (hilo)**          | Lectura y respuesta | **Fondo de columna** más cercano al shell (tintado oscuro o lavanda muy suave **sobre** canvas, no blanco puro). **Burbujas**: mantener inbound/outbound distintivos; ajustar **inbound** si el fondo deja de ser surface-2 claro — puede seguir siendo bloque claro **dentro** de la columna oscura (contraste local), sin volver el centro entero blanco. **Composer**: superficie elevada legible (inputs no pierden WCAG). |
| **Derecha (inteligencia)** | Contexto            | Ya oscura — **refinar** bordes/divisores con `**--border-dark`** y sombras alineadas a `--app-shadow-subtle`; evitar saltos visuales respecto a lista/centro tras el tintado.                                                                                                                                                                                                                                                  |


**Qué más oscuro / qué más claro**

- **Más oscuro**: carcasas de las tres columnas, cabeceras de lista/hilo, fondos de lista scrolleable.
- **Más claro (local)**: interior de burbujas inbound, campos de composer donde haga falta contraste.
- **Tinte sutil**: hover/fila activa con blanco translúcido o `--accent-primary` muy bajo — como Tasks, sin saturar.

---

## 4. Reglas de peso y densidad (Inbox vs Tasks)


| Aspecto              | Tasks (referencia de sistema)                     | Inbox (objetivo)                                                                         |
| -------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Bloques macro        | SectionPage + gaps grandes, KPIs, bandeja filtros | **Sin** añadir capa KPI; mantener **una** franja de filtros compacta en lista            |
| Tarjetas             | `shellCard` por bloques                           | **No** multiplicar tarjetas de métricas; lista = **filas**, no cards gruesas             |
| Tipografía de título | `text-2xl` hero                                   | Mantener **“Inbox”** como título de lista **pequeño/mediano** (ya `text-lg`) — no inflar |
| Espaciado vertical   | `gap-8` entre secciones                           | Mantener `**gap-3 p-3`** del grid actual como guía; no convertir en `gap-8`              |


**No sobreconstruir**: no nuevos paneles colapsables masivos, no segundo nivel de navegación tipo dashboard.

---

## 5. Layout y contención

- **Mantener** `max-w-[1800px]` y bleed (`-mx-`*) si el producto quiere **Inbox ancho** — es identidad de la vista; la alineación con el shell viene de **mismo token de canvas + columnas tintadas**, no de estrechar a `max-w-6xl`.
- **Anclaje**: reducir sensación “pegada” bajando `**shadow-lg`** a sombra **sutil** (como Tasks) y unificando **borde** `border-[var(--border-dark)]` en el perímetro de columnas para que lean como **paneles del mismo sistema**, no widgets flotantes.
- Opcionalmente, **un solo color de “gutter”** entre columnas (transparente o `--border-dark` muy suave) para lectura clara de límites sin caja blanca.

---

## 6. Plan de implementación priorizado (pequeño y seguro)

1. **Tokens (globals) o capa por componente (decisión)**
  - Opción preferida para consistencia: **ajustar** `--inbox-list-background`, `--inbox-list-surface`, `--inbox-chat-background`, `--inbox-chat-surface`, `--inbox-surface` para apuntar a `**--app-surface-dark` / elevated** donde aplique, **y** introducir/ajustar tokens de **texto claro** para esas zonas (o sobrescribir en componentes si el blast radius de globals preocupa).  
  - Revisar `**--inbox-list-selected-bg`** contraste sobre fondo oscuro.
2. **Columnas envoltorio** en `[page.tsx](app/inbox/page.tsx)`: clases `rounded-2xl shadow-lg` → **borde + sombra sutiles** alineados al contrato (sin cambiar grid).
3. **ConversationList + ConversationListItem**: colores de texto/borde tras cambio de fondo.
4. **ConversationThread + MessageBubble**: ajustar solo lo necesario para fondo de columna oscuro (burbujas inbound pueden quedarse claras).
5. **ReplyComposer / InputArea / FannyAssistCard**: legibilidad y bordes.
6. **ContextPanel**: alinear divisores y tarjetas internas con tokens oscuros ya parciales.
7. **Skeletons** en el mismo archivo de página: actualizar fondos para no parpadear “modo claro”.

**Orden seguro**: tokens/límites de columnas → lista → centro → composer → derecha (pulido) → skeletons → prueba móvil + xl.

---

## 7. Criterios de cierre (“alineado suficiente”)

- Las **tres columnas** se leen como **paneles del mismo sistema dark-first** que Tasks (tintas/bordes coherentes con `--app-surface-`* y `--border-dark`), no como **tres hojas blancas** sobre el canvas.
- **Legibilidad** de lista, mensajes y composer **mantenida** (sin modo claro global).
- **UX**: sigue sintiéndose **rápida y conversacional** (densidad no degradada a dashboard).
- **Sin** migración masiva fuera de Inbox en esta fase.
- **Regresión**: grid xl, hilo móvil, composer, selección de conversación, columna inteligencia usable.

---

*Referencias de código: `[app/inbox/page.tsx](app/inbox/page.tsx)`, `[globals.css](app/globals.css)` bloque INBOX TOKENS, `[components/inbox/conversation-list.tsx](components/inbox/conversation-list.tsx)`, `[components/inbox/conversation-thread.tsx](components/inbox/conversation-thread.tsx)`, `[components/inbox/context-panel.tsx](components/inbox/context-panel.tsx)`, `[components/inbox/reply-composer.tsx](components/inbox/reply-composer.tsx)` (cuando se implemente).*