-- 4_d5_schema_tightenings — CORE-03C-D5.
--
-- The four owner-approved nullability tightenings (canonical decisions doc
-- §7; M2 §12-A "APPROVED WITH RECHECK"; gates re-verified in-window):
--
--   Cliente.tipo          TEXT NULL            → TEXT NOT NULL DEFAULT 'empresa'
--   Documento.url         TEXT NULL            → TEXT NOT NULL
--   Factura.items         TEXT NULL            → TEXT NOT NULL
--   Factura.fechaEmision  DATETIME NULL        → DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
--
-- The two added defaults are the CANONICAL declarations from
-- prisma/schema.prisma (@default("empresa") / @default(now())) — not
-- invented values. No data is modified: the pre-flight gates prove zero
-- NULL / empty / invalid rows, so every INSERT…SELECT copies rows verbatim.
--
-- SQLite cannot ALTER an existing column's nullability, so each affected
-- table is rebuilt with Prisma's own SQLite redefine-table pattern
-- (defer_foreign_keys around create → copy → drop → rename). Everything
-- else about each table — column set and order, types, other defaults, PK,
-- FK constraints, indexes — is preserved byte-for-byte from the deployed
-- DDL. Only the four columns above change. No other table is touched.
--
-- Rollback (non-executable reference — do not run as part of this
-- migration): re-run the same rebuild pattern with the previous column
-- definitions ("tipo" TEXT, "url" TEXT, "items" TEXT,
-- "fechaEmision" DATETIME); widening drops no data. The pre-adoption
-- checkpoint taken in the execution window is the primary recovery path.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- ── Cliente: tipo → NOT NULL DEFAULT 'empresa' ──────────────────────────────

CREATE TABLE "new_Cliente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "email" TEXT,
    "telefono" TEXT,
    "empresa" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'empresa',
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "notas" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  , "customId" TEXT, "workspaceId" TEXT, "preferredPaymentMethod" TEXT, "currency" TEXT);

INSERT INTO "new_Cliente" ("id", "nombre", "email", "telefono", "empresa", "tipo", "estado", "notas", "createdAt", "updatedAt", "customId", "workspaceId", "preferredPaymentMethod", "currency")
  SELECT "id", "nombre", "email", "telefono", "empresa", "tipo", "estado", "notas", "createdAt", "updatedAt", "customId", "workspaceId", "preferredPaymentMethod", "currency" FROM "Cliente";

DROP TABLE "Cliente";

ALTER TABLE "new_Cliente" RENAME TO "Cliente";

-- ── Documento: url → NOT NULL ───────────────────────────────────────────────

CREATE TABLE "new_Documento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'documento',
    "url" TEXT NOT NULL,
    "tamano" INTEGER,
    "clienteId" TEXT,
    "proyectoId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL, "workspaceId" TEXT,
    CONSTRAINT "Documento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Documento_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  );

INSERT INTO "new_Documento" ("id", "nombre", "tipo", "url", "tamano", "clienteId", "proyectoId", "createdAt", "updatedAt", "workspaceId")
  SELECT "id", "nombre", "tipo", "url", "tamano", "clienteId", "proyectoId", "createdAt", "updatedAt", "workspaceId" FROM "Documento";

DROP TABLE "Documento";

ALTER TABLE "new_Documento" RENAME TO "Documento";

-- ── Factura: items → NOT NULL · fechaEmision → NOT NULL DEFAULT now() ───────

CREATE TABLE "new_Factura" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "numero" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "subtotal" REAL NOT NULL DEFAULT 0,
    "impuesto" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "items" TEXT NOT NULL,
    "fechaEmision" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" DATETIME,
    "paidAt" DATETIME,
    "clienteId" TEXT,
    "proyectoId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL, "workspaceId" TEXT,
    CONSTRAINT "Factura_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Factura_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  );

INSERT INTO "new_Factura" ("id", "numero", "estado", "subtotal", "impuesto", "total", "items", "fechaEmision", "fechaVencimiento", "paidAt", "clienteId", "proyectoId", "createdAt", "updatedAt", "workspaceId")
  SELECT "id", "numero", "estado", "subtotal", "impuesto", "total", "items", "fechaEmision", "fechaVencimiento", "paidAt", "clienteId", "proyectoId", "createdAt", "updatedAt", "workspaceId" FROM "Factura";

DROP TABLE "Factura";

ALTER TABLE "new_Factura" RENAME TO "Factura";

CREATE UNIQUE INDEX "Factura_numero_key" ON "Factura"("numero");

PRAGMA foreign_keys=ON;

PRAGMA defer_foreign_keys=OFF;
