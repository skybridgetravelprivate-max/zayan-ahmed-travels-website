-- AlterTable
ALTER TABLE "OutboundMessage" ADD COLUMN     "channel" TEXT NOT NULL DEFAULT 'WHATSAPP';
ALTER TABLE "OutboundMessage" ADD CONSTRAINT "OutboundMessage_channel_check" CHECK ("channel" IN ('WHATSAPP', 'EMAIL'));

-- CreateTable
CREATE TABLE "CommunicationSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "CommunicationSubmission_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CommunicationSubmission" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "CommunicationSubmission" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON TABLE "CommunicationSubmission" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON TABLE "CommunicationSubmission" FROM authenticated; END IF;
END $$;
