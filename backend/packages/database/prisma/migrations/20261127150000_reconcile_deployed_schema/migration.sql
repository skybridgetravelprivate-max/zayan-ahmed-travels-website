-- Reconcile confirmed historical schema drift without rewriting migration history.
-- Existing customer emails must already be unique; never delete or merge records.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE UNIQUE INDEX IF NOT EXISTS "Customer_email_key" ON "Customer"("email");
ALTER TABLE "CmsHtmlBlock" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Complaint" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "ServiceInvoice" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "StarBooking" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "TransportBooking" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "TransportBooking" ALTER COLUMN "status" SET DEFAULT 'Reserved';

COMMIT;
