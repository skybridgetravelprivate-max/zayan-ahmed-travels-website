-- GATE A REVIEW DRAFT. LOCAL SYNTHETIC USE ONLY. PRODUCTION EXECUTION NOT APPROVED.
ALTER TABLE "Receipt"
 ADD COLUMN "ticketSaleId" TEXT,
 ADD COLUMN "hotelBookingId" TEXT,
 ADD COLUMN "transportBookingId" TEXT,
 ADD COLUMN "starBookingId" TEXT,
 ADD COLUMN "submissionFingerprint" VARCHAR(64);
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_single_source_check"
 CHECK (num_nonnulls("bookingId", "ticketSaleId", "hotelBookingId", "transportBookingId", "starBookingId") <= 1);
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_ticketSaleId_fkey" FOREIGN KEY ("ticketSaleId") REFERENCES "TicketSale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Receipt_ticketSaleId_idx" ON "Receipt"("ticketSaleId");
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_hotelBookingId_fkey" FOREIGN KEY ("hotelBookingId") REFERENCES "HotelBooking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Receipt_hotelBookingId_idx" ON "Receipt"("hotelBookingId");
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_transportBookingId_fkey" FOREIGN KEY ("transportBookingId") REFERENCES "TransportBooking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Receipt_transportBookingId_idx" ON "Receipt"("transportBookingId");
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_starBookingId_fkey" FOREIGN KEY ("starBookingId") REFERENCES "StarBooking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Receipt_starBookingId_idx" ON "Receipt"("starBookingId");
