-- Phase 11 COMPLAINTS (Zayan-defined statuses; reference screens were inaccessible)

CREATE TABLE IF NOT EXISTS "Complaint" (
  "id" TEXT NOT NULL,
  "complaintNumber" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "passengerId" TEXT,
  "assignedUserId" TEXT,
  "createdById" TEXT,
  "branchId" TEXT,
  "module" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'Medium',
  "status" TEXT NOT NULL DEFAULT 'Open',
  "subject" TEXT,
  "description" TEXT NOT NULL,
  "resolution" TEXT,
  "notes" TEXT,
  "bookingRef" TEXT,
  "bookingId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "assignedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Complaint_complaintNumber_key" ON "Complaint"("complaintNumber");
CREATE INDEX IF NOT EXISTS "Complaint_customerId_idx" ON "Complaint"("customerId");
CREATE INDEX IF NOT EXISTS "Complaint_passengerId_idx" ON "Complaint"("passengerId");
CREATE INDEX IF NOT EXISTS "Complaint_status_idx" ON "Complaint"("status");
CREATE INDEX IF NOT EXISTS "Complaint_module_idx" ON "Complaint"("module");
CREATE INDEX IF NOT EXISTS "Complaint_assignedUserId_idx" ON "Complaint"("assignedUserId");
CREATE INDEX IF NOT EXISTS "Complaint_bookingRef_idx" ON "Complaint"("bookingRef");

CREATE TABLE IF NOT EXISTS "ComplaintEvent" (
  "id" TEXT NOT NULL,
  "complaintId" TEXT NOT NULL,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "body" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComplaintEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ComplaintEvent_complaintId_idx" ON "ComplaintEvent"("complaintId");

ALTER TABLE "Complaint" DROP CONSTRAINT IF EXISTS "Complaint_customerId_fkey";
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Complaint" DROP CONSTRAINT IF EXISTS "Complaint_passengerId_fkey";
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "Passenger"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Complaint" DROP CONSTRAINT IF EXISTS "Complaint_assignedUserId_fkey";
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Complaint" DROP CONSTRAINT IF EXISTS "Complaint_createdById_fkey";
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Complaint" DROP CONSTRAINT IF EXISTS "Complaint_branchId_fkey";
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ComplaintEvent" DROP CONSTRAINT IF EXISTS "ComplaintEvent_complaintId_fkey";
ALTER TABLE "ComplaintEvent" ADD CONSTRAINT "ComplaintEvent_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
