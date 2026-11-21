CREATE INDEX "LoginAttempt_createdAt_idx" ON "LoginAttempt"("createdAt");
CREATE INDEX "LoginAttempt_identifier_createdAt_idx" ON "LoginAttempt"("identifier", "createdAt");
CREATE INDEX "TicketSale_customerId_createdAt_idx" ON "TicketSale"("customerId", "createdAt");
CREATE TABLE "OutboundMessage" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "status" TEXT NOT NULL CHECK ("status" IN ('UNCERTAIN', 'SENT', 'NOT_SENT')),
  "providerReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "OutboundMessage_fingerprint_status_idx" ON "OutboundMessage"("fingerprint", "status");
ALTER TABLE "OutboundMessage" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "OutboundMessage" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON TABLE "OutboundMessage" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON TABLE "OutboundMessage" FROM authenticated; END IF;
END $$;
