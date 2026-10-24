-- REVIEW DRAFT: rollback only when all newly allocated receipts/fingerprints are absent.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM "Receipt" WHERE num_nonnulls("ticketSaleId","hotelBookingId","transportBookingId","starBookingId","submissionFingerprint") > 0)
 THEN RAISE EXCEPTION 'New receipt data exists: retain additive columns and roll application back in write maintenance'; END IF;
END $$;
ALTER TABLE "Receipt" DROP CONSTRAINT "Receipt_single_source_check",
 DROP COLUMN "ticketSaleId", DROP COLUMN "hotelBookingId", DROP COLUMN "transportBookingId", DROP COLUMN "starBookingId", DROP COLUMN "submissionFingerprint";
