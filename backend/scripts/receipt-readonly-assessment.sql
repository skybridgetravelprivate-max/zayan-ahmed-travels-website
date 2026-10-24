\set ON_ERROR_STOP on
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SELECT json_build_object(
  'read_only', current_setting('transaction_read_only'),
  'receipt_count', (SELECT count(*) FROM "Receipt"),
  'legacy_receipt_count', (SELECT count(*) FROM "Receipt" WHERE left(id, 8) <> 'request_'),
  'unreviewed_keyed_count', (SELECT count(*) FROM "Receipt" r WHERE left(r.id, 8) = 'request_' AND NOT EXISTS (SELECT 1 FROM "AuditLog" a WHERE a.action = 'REVIEW_RECEIPT' AND a.entity = 'Receipt' AND a."entityId" = r.id)),
  'missing_journal_count', (SELECT count(*) FROM "Receipt" r LEFT JOIN "JournalEntry" j ON j.id = r."journalId" WHERE j.id IS NULL),
  'unbalanced_posted_journal_count', (SELECT count(*) FROM (SELECT j.id FROM "JournalEntry" j LEFT JOIN "JournalLine" l ON l."journalId" = j.id WHERE j.status IN ('POSTED','REVERSED') GROUP BY j.id HAVING coalesce(sum(l.debit-l.credit),0) <> 0 OR count(l.id) = 0) q),
  'booking_paid_mismatch_count', (SELECT count(*) FROM "UmrahBooking" b LEFT JOIN (SELECT "bookingId", sum(amount) paid FROM "Receipt" WHERE "bookingId" IS NOT NULL GROUP BY "bookingId") r ON r."bookingId" = b.id WHERE b.paid <> coalesce(r.paid,0)),
  'repeated_payment_candidate_groups_30d', (SELECT count(*) FROM (SELECT "customerId", "bookingId", "branchId", amount, method, date::date FROM "Receipt" WHERE date >= current_timestamp - interval '30 days' GROUP BY "customerId", "bookingId", "branchId", amount, method, date::date HAVING count(*) > 1) q)
);
ROLLBACK;
