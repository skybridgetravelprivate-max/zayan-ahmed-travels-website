-- Phase 9 STAR bookings (separate from Reservation HotelBooking)

CREATE TABLE IF NOT EXISTS "StarBooking" (
  "id" TEXT NOT NULL,
  "bookingNumber" TEXT NOT NULL,
  "customerId" TEXT,
  "supplierId" TEXT,
  "groupName" TEXT,
  "groupCode" TEXT,
  "status" TEXT NOT NULL DEFAULT 'Tentative Request',
  "autoAllocate" BOOLEAN NOT NULL DEFAULT true,
  "unlockPackage" BOOLEAN NOT NULL DEFAULT false,
  "unlockRoomType" BOOLEAN NOT NULL DEFAULT false,
  "unlockNotes" TEXT,
  "confirmationNo" TEXT,
  "adults" INTEGER NOT NULL DEFAULT 0,
  "children" INTEGER NOT NULL DEFAULT 0,
  "infants" INTEGER NOT NULL DEFAULT 0,
  "totalBeds" INTEGER NOT NULL DEFAULT 0,
  "cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "sellingPrice" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "profit" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "paid" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
  "branchId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StarBooking_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StarBooking_bookingNumber_key" ON "StarBooking"("bookingNumber");
CREATE INDEX IF NOT EXISTS "StarBooking_customerId_idx" ON "StarBooking"("customerId");
CREATE INDEX IF NOT EXISTS "StarBooking_status_idx" ON "StarBooking"("status");

CREATE TABLE IF NOT EXISTS "StarBookingRoom" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "roomType" TEXT NOT NULL,
  "roomNo" TEXT,
  "qty" INTEGER NOT NULL DEFAULT 1,
  "checkIn" TIMESTAMP(3) NOT NULL,
  "checkOut" TIMESTAMP(3) NOT NULL,
  "viewType" TEXT,
  "mealPlan" TEXT,
  "cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "sale" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "extra" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ALLOCATED',
  CONSTRAINT "StarBookingRoom_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StarBookingRoom_bookingId_idx" ON "StarBookingRoom"("bookingId");
CREATE INDEX IF NOT EXISTS "StarBookingRoom_hotelId_idx" ON "StarBookingRoom"("hotelId");
CREATE INDEX IF NOT EXISTS "StarBookingRoom_roomNo_idx" ON "StarBookingRoom"("roomNo");

CREATE TABLE IF NOT EXISTS "StarBookingRoomPax" (
  "roomId" TEXT NOT NULL,
  "passengerId" TEXT NOT NULL,
  CONSTRAINT "StarBookingRoomPax_pkey" PRIMARY KEY ("roomId","passengerId")
);

ALTER TABLE "StarBooking" DROP CONSTRAINT IF EXISTS "StarBooking_customerId_fkey";
ALTER TABLE "StarBooking" ADD CONSTRAINT "StarBooking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StarBooking" DROP CONSTRAINT IF EXISTS "StarBooking_supplierId_fkey";
ALTER TABLE "StarBooking" ADD CONSTRAINT "StarBooking_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StarBooking" DROP CONSTRAINT IF EXISTS "StarBooking_branchId_fkey";
ALTER TABLE "StarBooking" ADD CONSTRAINT "StarBooking_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StarBookingRoom" DROP CONSTRAINT IF EXISTS "StarBookingRoom_bookingId_fkey";
ALTER TABLE "StarBookingRoom" ADD CONSTRAINT "StarBookingRoom_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "StarBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StarBookingRoom" DROP CONSTRAINT IF EXISTS "StarBookingRoom_hotelId_fkey";
ALTER TABLE "StarBookingRoom" ADD CONSTRAINT "StarBookingRoom_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StarBookingRoomPax" DROP CONSTRAINT IF EXISTS "StarBookingRoomPax_roomId_fkey";
ALTER TABLE "StarBookingRoomPax" ADD CONSTRAINT "StarBookingRoomPax_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "StarBookingRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StarBookingRoomPax" DROP CONSTRAINT IF EXISTS "StarBookingRoomPax_passengerId_fkey";
ALTER TABLE "StarBookingRoomPax" ADD CONSTRAINT "StarBookingRoomPax_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "Passenger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
