-- Phase 10 accounts: journal kinds + service invoices

ALTER TABLE "JournalEntry" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "JournalEntry" ADD COLUMN IF NOT EXISTS "module" TEXT;
ALTER TABLE "JournalEntry" ADD COLUMN IF NOT EXISTS "sourceId" TEXT;
CREATE INDEX IF NOT EXISTS "JournalEntry_status_idx" ON "JournalEntry"("status");
CREATE INDEX IF NOT EXISTS "JournalEntry_kind_idx" ON "JournalEntry"("kind");
CREATE INDEX IF NOT EXISTS "JournalEntry_module_sourceId_idx" ON "JournalEntry"("module", "sourceId");

CREATE TABLE IF NOT EXISTS "ServiceInvoice" (
  "id" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "customerId" TEXT,
  "branchId" TEXT,
  "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'UNPOSTED',
  "cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "sellingPrice" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "tax" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "discount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "net" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "paid" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "journalId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceInvoice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ServiceInvoice_invoiceNumber_key" ON "ServiceInvoice"("invoiceNumber");
CREATE INDEX IF NOT EXISTS "ServiceInvoice_customerId_idx" ON "ServiceInvoice"("customerId");
CREATE INDEX IF NOT EXISTS "ServiceInvoice_status_idx" ON "ServiceInvoice"("status");

CREATE TABLE IF NOT EXISTS "ServiceInvoiceLine" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "serviceId" TEXT,
  "description" TEXT NOT NULL,
  "qty" INTEGER NOT NULL DEFAULT 1,
  "unitPrice" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  CONSTRAINT "ServiceInvoiceLine_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ServiceInvoice" DROP CONSTRAINT IF EXISTS "ServiceInvoice_customerId_fkey";
ALTER TABLE "ServiceInvoice" ADD CONSTRAINT "ServiceInvoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceInvoice" DROP CONSTRAINT IF EXISTS "ServiceInvoice_branchId_fkey";
ALTER TABLE "ServiceInvoice" ADD CONSTRAINT "ServiceInvoice_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceInvoiceLine" DROP CONSTRAINT IF EXISTS "ServiceInvoiceLine_invoiceId_fkey";
ALTER TABLE "ServiceInvoiceLine" ADD CONSTRAINT "ServiceInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "ServiceInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceInvoiceLine" DROP CONSTRAINT IF EXISTS "ServiceInvoiceLine_serviceId_fkey";
ALTER TABLE "ServiceInvoiceLine" ADD CONSTRAINT "ServiceInvoiceLine_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
