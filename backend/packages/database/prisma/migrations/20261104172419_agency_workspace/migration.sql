-- Reviewed additive draft. Production execution requires separate approval.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "audience" TEXT NOT NULL DEFAULT 'staff';

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "branchId" TEXT;

-- CreateTable
CREATE TABLE "AgencyMembership" (
    "userId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgencyMembership_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "AgencyRequest" (
    "leadId" TEXT,
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "requestKey" VARCHAR(80) NOT NULL,
    "fingerprint" VARCHAR(64) NOT NULL,
    "kind" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "reply" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgencyMembership_agentId_idx" ON "AgencyMembership"("agentId");

-- CreateIndex
CREATE INDEX "AgencyRequest_agentId_createdAt_idx" ON "AgencyRequest"("agentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgencyRequest_agentId_requestKey_key" ON "AgencyRequest"("agentId", "requestKey");

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyMembership" ADD CONSTRAINT "AgencyMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyMembership" ADD CONSTRAINT "AgencyMembership_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyRequest" ADD CONSTRAINT "AgencyRequest_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyRequest" ADD CONSTRAINT "AgencyRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


CREATE INDEX "AgencyRequest_leadId_idx" ON "AgencyRequest"("leadId");
ALTER TABLE "AgencyRequest" ADD CONSTRAINT "AgencyRequest_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Nest agency sessions are application-owned. Direct public Data API roles have no agency policies.
ALTER TABLE "AgencyMembership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AgencyRequest" ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE "AgencyMembership", "AgencyRequest" FROM %I', api_role);
    END IF;
  END LOOP;
END $$;
COMMIT;
