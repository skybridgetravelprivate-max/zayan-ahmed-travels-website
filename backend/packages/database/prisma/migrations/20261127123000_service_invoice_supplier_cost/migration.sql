-- Preserve unknown historical supplier/line costs as NULL; do not infer them
-- from invoice totals. This migration is additive and does not repost journals.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE "ServiceInvoice" ADD COLUMN "supplierId" TEXT;
ALTER TABLE "ServiceInvoiceLine" ADD COLUMN "unitCost" DECIMAL(18,2);
CREATE INDEX "ServiceInvoice_supplierId_idx" ON "ServiceInvoice"("supplierId");
ALTER TABLE "ServiceInvoice" ADD CONSTRAINT "ServiceInvoice_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Receipt" ADD COLUMN "serviceInvoiceId" TEXT;
CREATE INDEX "Receipt_serviceInvoiceId_idx" ON "Receipt"("serviceInvoiceId");
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_serviceInvoiceId_fkey"
  FOREIGN KEY ("serviceInvoiceId") REFERENCES "ServiceInvoice"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
COMMIT;
