# Historical supplier tickets

The Tickets workspace links to `/admin/manage/tickets/historical` for Super Admins.
This displays historical supplier statement rows stored under
`PnrRecord.rawData.historicalSupplierStatements`, one group per PNR and one row
per passenger ticket. Original supplier invoice dates are labelled as invoice
dates, not departure dates. Currency and supplier charges retain their source
values; these records do not establish customer selling prices or cash received.

The read endpoint projects only the required ticket columns. It does not expose
arbitrary raw data, identity documents or credentials. Since legacy imports do
not have a verified branch owner, scoped staff cannot read or edit them. Both
API operations independently enforce Super Admin access, and mutations retain
the existing explicit Origin guard.

Review notes can be edited with a reason and optimistic version check. A note
edit and its audit entry commit atomically. Concurrent edits produce a conflict
instead of losing a review. Original source values and other metadata remain
unchanged. Posted tickets, receipts, payments, refunds and journals are never
modified by this feature.

No migration, automatic import, seed or startup data mutation is required. The
source records must already exist. No private customer fixture belongs in Git.
There is no sale, payment or refund conversion action: those require established
financial facts and their existing transactional workflows.

The previously reported FAIZAN ticket total discrepancy remains separate; this
page does not correct it or claim that existing accounting is reconciled.
