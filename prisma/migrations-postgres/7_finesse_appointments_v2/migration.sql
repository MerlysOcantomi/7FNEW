-- Finesse Appointment V2
-- Additive only: generic events and legacy appointments remain valid.
ALTER TABLE "Evento"
  ADD COLUMN "serviceId" TEXT,
  ADD COLUMN "serviceNameSnapshot" TEXT,
  ADD COLUMN "servicePrice" DOUBLE PRECISION,
  ADD COLUMN "serviceCurrency" TEXT,
  ADD COLUMN "durationMinutes" INTEGER,
  ADD COLUMN "assignedUserId" TEXT,
  ADD COLUMN "appointmentStatus" TEXT,
  ADD COLUMN "origin" TEXT,
  ADD COLUMN "confirmedAt" TIMESTAMP(3),
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "noShowAt" TIMESTAMP(3);

CREATE INDEX "Evento_workspaceId_assignedUserId_fechaInicio_idx"
  ON "Evento"("workspaceId", "assignedUserId", "fechaInicio");

CREATE INDEX "Evento_workspaceId_serviceId_fechaInicio_idx"
  ON "Evento"("workspaceId", "serviceId", "fechaInicio");

CREATE INDEX "Evento_workspaceId_appointmentStatus_fechaInicio_idx"
  ON "Evento"("workspaceId", "appointmentStatus", "fechaInicio");
