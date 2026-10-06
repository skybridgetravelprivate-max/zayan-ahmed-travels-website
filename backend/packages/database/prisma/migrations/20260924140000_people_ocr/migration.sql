-- CreateTable
CREATE TABLE "PassportHistory" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "passengerId" TEXT,
    "passportNumber" TEXT NOT NULL,
    "passportCountry" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PassportHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OcrExtract" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "customerId" TEXT,
    "passengerId" TEXT,
    "rawText" TEXT NOT NULL,
    "parsed" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fileDocumentId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "userEdits" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OcrExtract_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PassengerDocument_passengerId_idx" ON "PassengerDocument"("passengerId");
CREATE INDEX "PassengerDocument_kind_idx" ON "PassengerDocument"("kind");
CREATE INDEX "PassportHistory_passportNumber_idx" ON "PassportHistory"("passportNumber");
CREATE INDEX "PassportHistory_customerId_idx" ON "PassportHistory"("customerId");
CREATE INDEX "PassportHistory_passengerId_idx" ON "PassportHistory"("passengerId");
CREATE INDEX "OcrExtract_entityType_entityId_idx" ON "OcrExtract"("entityType", "entityId");
CREATE INDEX "OcrExtract_customerId_idx" ON "OcrExtract"("customerId");
CREATE INDEX "OcrExtract_passengerId_idx" ON "OcrExtract"("passengerId");

ALTER TABLE "PassportHistory" ADD CONSTRAINT "PassportHistory_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PassportHistory" ADD CONSTRAINT "PassportHistory_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "Passenger"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OcrExtract" ADD CONSTRAINT "OcrExtract_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OcrExtract" ADD CONSTRAINT "OcrExtract_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "Passenger"("id") ON DELETE SET NULL ON UPDATE CASCADE;
