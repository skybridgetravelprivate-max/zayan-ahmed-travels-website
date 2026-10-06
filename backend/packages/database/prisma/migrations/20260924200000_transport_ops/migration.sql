-- Phase 8 transport voucher fields + Umrah/Reservation links

ALTER TABLE "TransportBooking" ADD COLUMN IF NOT EXISTS "vehicleType" TEXT;
ALTER TABLE "TransportBooking" ADD COLUMN IF NOT EXISTS "driverName" TEXT;
ALTER TABLE "TransportBooking" ADD COLUMN IF NOT EXISTS "driverContact" TEXT;
ALTER TABLE "TransportBooking" ADD COLUMN IF NOT EXISTS "route" TEXT;
ALTER TABLE "TransportBooking" ADD COLUMN IF NOT EXISTS "tripTime" TEXT;
ALTER TABLE "TransportBooking" ADD COLUMN IF NOT EXISTS "paxCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "TransportBooking" ADD COLUMN IF NOT EXISTS "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID';
ALTER TABLE "TransportBooking" ADD COLUMN IF NOT EXISTS "umrahBookingId" TEXT;
ALTER TABLE "TransportBooking" ADD COLUMN IF NOT EXISTS "hotelBookingId" TEXT;
ALTER TABLE "TransportBooking" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "TransportBooking_customerId_idx" ON "TransportBooking"("customerId");
CREATE INDEX IF NOT EXISTS "TransportBooking_umrahBookingId_idx" ON "TransportBooking"("umrahBookingId");
CREATE INDEX IF NOT EXISTS "TransportBooking_hotelBookingId_idx" ON "TransportBooking"("hotelBookingId");
CREATE INDEX IF NOT EXISTS "TransportBooking_tripDate_idx" ON "TransportBooking"("tripDate");

ALTER TABLE "TransportBooking" DROP CONSTRAINT IF EXISTS "TransportBooking_umrahBookingId_fkey";
ALTER TABLE "TransportBooking" ADD CONSTRAINT "TransportBooking_umrahBookingId_fkey" FOREIGN KEY ("umrahBookingId") REFERENCES "UmrahBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TransportBooking" DROP CONSTRAINT IF EXISTS "TransportBooking_hotelBookingId_fkey";
ALTER TABLE "TransportBooking" ADD CONSTRAINT "TransportBooking_hotelBookingId_fkey" FOREIGN KEY ("hotelBookingId") REFERENCES "HotelBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
