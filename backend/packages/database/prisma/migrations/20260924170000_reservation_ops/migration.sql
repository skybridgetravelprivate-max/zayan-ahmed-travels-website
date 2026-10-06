-- Phase 5: multi-hotel reservation ops (stay units, split, cancel, transfers)

ALTER TABLE "HotelBooking" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'RESERVATION';
ALTER TABLE "HotelBooking" ADD COLUMN IF NOT EXISTS "commission" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "HotelBooking" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "HotelBooking" ADD COLUMN IF NOT EXISTS "specialRequests" TEXT;
ALTER TABLE "HotelBooking" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "HotelBooking" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;
ALTER TABLE "HotelBooking" ADD COLUMN IF NOT EXISTS "parentBookingId" TEXT;

CREATE INDEX IF NOT EXISTS "HotelBooking_kind_idx" ON "HotelBooking"("kind");
CREATE INDEX IF NOT EXISTS "HotelBooking_parentBookingId_idx" ON "HotelBooking"("parentBookingId");
CREATE INDEX IF NOT EXISTS "HotelBooking_cancelledAt_idx" ON "HotelBooking"("cancelledAt");

ALTER TABLE "HotelBooking"
  ADD CONSTRAINT "HotelBooking_parentBookingId_fkey"
  FOREIGN KEY ("parentBookingId") REFERENCES "HotelBooking"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HotelStaySegment" ADD COLUMN IF NOT EXISTS "supplierId" TEXT;
ALTER TABLE "HotelStaySegment" ADD COLUMN IF NOT EXISTS "confirmationNo" TEXT;
ALTER TABLE "HotelStaySegment" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'Pending';
ALTER TABLE "HotelStaySegment" ADD COLUMN IF NOT EXISTS "specialRequest" TEXT;

CREATE INDEX IF NOT EXISTS "HotelStaySegment_supplierId_idx" ON "HotelStaySegment"("supplierId");

ALTER TABLE "HotelStaySegment"
  ADD CONSTRAINT "HotelStaySegment_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HotelStayRoom" ADD COLUMN IF NOT EXISTS "roomNumber" TEXT;
ALTER TABLE "HotelStayRoom" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'VACANT';
ALTER TABLE "HotelStayRoom" ADD COLUMN IF NOT EXISTS "checkinAt" TIMESTAMP(3);
ALTER TABLE "HotelStayRoom" ADD COLUMN IF NOT EXISTS "checkoutAt" TIMESTAMP(3);
ALTER TABLE "HotelStayRoom" ADD COLUMN IF NOT EXISTS "supplierCost" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "HotelStayRoom" ADD COLUMN IF NOT EXISTS "sellingPrice" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "HotelStayRoom" ADD COLUMN IF NOT EXISTS "discount" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "HotelStayRoom" ADD COLUMN IF NOT EXISTS "tax" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "HotelStayRoom" ADD COLUMN IF NOT EXISTS "commission" DECIMAL(18,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "HotelStayRoom_status_idx" ON "HotelStayRoom"("status");

CREATE TABLE IF NOT EXISTS "HotelStayTransfer" (
  "id" TEXT NOT NULL,
  "fromRoomId" TEXT NOT NULL,
  "toRoomId" TEXT NOT NULL,
  "reason" TEXT,
  "userId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HotelStayTransfer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "HotelStayTransfer_fromRoomId_idx" ON "HotelStayTransfer"("fromRoomId");
CREATE INDEX IF NOT EXISTS "HotelStayTransfer_toRoomId_idx" ON "HotelStayTransfer"("toRoomId");

ALTER TABLE "HotelStayTransfer"
  ADD CONSTRAINT "HotelStayTransfer_fromRoomId_fkey"
  FOREIGN KEY ("fromRoomId") REFERENCES "HotelStayRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HotelStayTransfer"
  ADD CONSTRAINT "HotelStayTransfer_toRoomId_fkey"
  FOREIGN KEY ("toRoomId") REFERENCES "HotelStayRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HotelStaySegment" DROP CONSTRAINT IF EXISTS "HotelStaySegment_dates_chk";
ALTER TABLE "HotelStaySegment" ADD CONSTRAINT "HotelStaySegment_dates_chk" CHECK ("checkOut" > "checkIn");
ALTER TABLE "HotelBooking" DROP CONSTRAINT IF EXISTS "HotelBooking_dates_chk";
ALTER TABLE "HotelBooking" ADD CONSTRAINT "HotelBooking_dates_chk" CHECK ("checkOut" > "checkIn");
ALTER TABLE "HotelStayRoom" DROP CONSTRAINT IF EXISTS "HotelStayRoom_checkout_chk";
ALTER TABLE "HotelStayRoom" ADD CONSTRAINT "HotelStayRoom_checkout_chk" CHECK ("checkoutAt" IS NULL OR "checkinAt" IS NULL OR "checkoutAt" >= "checkinAt");
