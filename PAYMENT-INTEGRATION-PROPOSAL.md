# Payment and receipt integration — proposal for approval

The owner selected **prepare explicit payment/receipt integration for approval**. This document is a proposal, not authorization to implement or migrate it. Existing initial-paid behavior has not been blocked or silently changed.

## Confirmed problem

`WorkflowsController.sellTicket` and `sellTransport`, `ReservationService.save`, `UmrahOpsService.save` and the STAR workflow can store an initial paid amount while their creation paths post sale/cost journals without going through the durable receipt recovery/review flow. The forms do not collect enough explicit receipt information. A stored paid amount alone does not prove cash/bank receipt or ledger reconciliation. Do not infer a payment method, create a bank account or retroactively post historical money.

## Proposed behavior

1. An unpaid booking remains available through its existing operational permission. If an initial paid amount is entered, require an explicit approved payment method, a durable client retry key and the existing finance authorization. Never infer CASH, BANK, CARD or ONLINE from missing input.
2. Route initial and later module payments through one shared receipt implementation used by FinanceController. Keep current staff-scoped key identity, transaction-scoped locks, same-payload replay, conflicting replay rejection, pending-receipt review and no-store recovery responses.
3. Lock the target booking and customer scope. Resolve branch/customer/module from the owned booking, not the request. In one transaction create the booking if applicable, post sale/cost entries, post the receipt, store its source allocation, update paid/balance/payment state and audit. Any failure rolls everything back. A retry returns the same linked booking and receipt, not another booking or payment.
4. Keep current super-admin/`account.post` finance boundaries. A ticket/transport/hotel creator must not gain payment authority merely by entering a paid amount. Do not grant new permissions automatically.
5. Keep existing Umrah clients and customer-only receipts compatible. Adding module targets is additive; requests supplying multiple targets or inconsistent customer/branch details are rejected.
6. The UI preserves pending keys across tabs/restarts, shows the saved receipt and requires explicit review. Unknown outcomes remain recoverable. Do not clear the key or silently create a new submission.

## Concrete schema proposal — review only

Extend `Receipt` while preserving its existing `bookingId` (Umrah) field:

| Field | Type / constraint | Purpose |
|---|---|---|
| `ticketSaleId` | nullable FK to TicketSale, delete restricted | Ticket allocation |
| `hotelBookingId` | nullable FK to HotelBooking, delete restricted | Reservation allocation |
| `transportBookingId` | nullable FK to TransportBooking, delete restricted | Transport allocation |
| `starBookingId` | nullable FK to StarBooking, delete restricted | STAR allocation |
| `submissionFingerprint` | nullable SHA-256 text | Detect changed booking/payment payloads on initial-payment replay |

Add a database CHECK permitting **at most one** source among these four and the existing Umrah `bookingId`. Zero sources remains valid for current customer-only receipts. Add indexes to the new foreign keys. Old rows remain untouched; no default monetary values or historical allocations are invented.

The exact SQL/Prisma migration must be generated, reviewed and tested locally after implementation approval. No production migration has been prepared for execution or run in this task.

## Historical data and cutover

- Prepare an aggregate-only reconciliation of stored paid totals, source-linked receipts, posted journals and pending submissions by module. Retrieve detailed customer/payment records only if separately authorized and necessary.
- Historical amounts without a verifiable receipt remain marked as unreconciled for an accountant's decision. Do not automatically generate receipts, journals, refunds, opening balances or migration backfills.
- Owner/accountant must confirm payment-method-to-account mappings and real bank/cash details where needed. Existing GL defaults are not proof of actual account identity or opening balance. No account records or balances are created by this proposal.
- Cash disbursement for refunds is a separate, explicitly approved workflow. A sales credit journal is not evidence that cash was paid out.

## Acceptance criteria

- For each supported module: initial payment and later payment create one receipt/journal, and paid/balance agrees with allocated receipts and posted customer AR.
- Zero, negative, fractional-cent, overpayment and cancelled/replaced-source requests are handled explicitly; no floating-point drift.
- Same key/same payload, lost response, reload, closure/reopen and two tabs return one persisted result. Changed payload or another staff/key cannot bypass pending review.
- Injected journal, receipt, source-update and audit failures leave no partial booking, receipt, sequence use or balance change.
- Branch, customer, permission and generic-CRUD bypass attempts are denied. Key recovery does not expose another staff user's submissions.
- Existing Umrah/customer-only clients pass compatibility tests. New schema passes PostgreSQL 17 rollback and forward tests with synthetic data.
- Browser/mobile, PDF receipt, cancellation credit and accountant reconciliation checks pass without real money or provider calls.

## Approval gates and costs

**A — next approval:** authorize local implementation of this proposal, local draft migration and isolated synthetic PG17/browser tests. No production writes, permissions, migrations or provider activation.

**B — separate production approval:** only after A passes, approve the exact migration and deployment sequence using fresh verified recovery evidence and a read-only reconciliation. A does not authorize B. Keep receipt writes blocked during any incompatible cutover.

**C — separate approval:** any historical correction, real bank/cash setup, refund payout, provider access or live financial transaction.

Cost: free tools, existing PC/hosting and Supabase Free only. No paid services, billing, extra database project or hosted branch is required for local implementation/testing. Check actual Free storage/egress limits before any production change.
