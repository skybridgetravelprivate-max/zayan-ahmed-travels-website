-- Phase 7 ticket invoice/refund remaining balance

ALTER TABLE "TicketSale" ADD COLUMN IF NOT EXISTS "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "TicketSale" ADD COLUMN IF NOT EXISTS "cabin" TEXT;
ALTER TABLE "TicketSale" ADD COLUMN IF NOT EXISTS "baggage" TEXT;
ALTER TABLE "TicketSale" ADD COLUMN IF NOT EXISTS "sectors" JSONB;
