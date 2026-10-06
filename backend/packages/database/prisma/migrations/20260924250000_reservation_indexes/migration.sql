-- Date indexes for reservation KPI aggregates (not a UI-only 500 cap)

CREATE INDEX IF NOT EXISTS "HotelBooking_checkIn_idx" ON "HotelBooking"("checkIn");
CREATE INDEX IF NOT EXISTS "HotelBooking_status_idx" ON "HotelBooking"("status");
CREATE INDEX IF NOT EXISTS "HotelStaySegment_checkIn_checkOut_idx" ON "HotelStaySegment"("checkIn", "checkOut");
