# Hotel operations release validation — 2026-10-30

This focused code-only release completes the tested hotel allocation/transfer/check-in/out path. It does not establish completion of the entire travel platform.

## Behavior

- Existing staff hotel workflows now offer **Assign room guest** and **Transfer room guests**. Assignment appends one guest before the room starts, is safe to repeat, enforces capacity and branch scope, and rejects duplicate assignment in the same stay. Transfer moves all source guests to a new room in the same stay without changing booked charges.
- Check-in, checkout and transfer enforce the booking in the URL. Closed/transferred/cancelled sources cannot be resurrected. Existing destinations enforce capacity and compatible check-in state. The booking row lock prevents duplicate concurrent transfers; allocation/audit share the same transaction.
- Physical room IDs, master-room number aliases and entered room numbers use one serialized occupancy check. Check-in renaming and transfer destinations recheck collisions. Conflict errors no longer identify another booking.
- Customer hotel summaries derive Completed from all current non-transferred/non-cancelled rooms checking out. Cancellation takes precedence. This presentation does not assert settlement or financial closure.
- Existing private reservation PDFs include current stays/rooms/guests, actual net/paid/balance and two-decimal amounts. Price-excluded mode omits money. Transferred history is retained in the database but not duplicated as a current room in the document. The document explicitly distinguishes an agency record from supplier confirmation.
- Mobile staff layout uses a bounded single grid column so navigation does not widen and clip the workspace.

## Reproduction and validation

All seven original defect cases failed before repairs. Final isolated PostgreSQL 17 test run: **13 tests passed (12 cases and parent)**. Coverage includes concurrent transfer and allocation retries, capacity, room alias collision, wrong booking, terminal states, cross-stay transfer denial, successful transfer, consistent check-in stage, financial preservation, branch isolation, customer projection/isolation and audit-failure rollback.

**144 backend regressions**, **11 staff tests**, API type check, both production builds and patch whitespace checks passed. API lint passed with no warnings. Website lint had zero errors and two pre-existing StaffSessionForm navigation warnings.

Actual installed Chrome against the packaged Next/Nest gateway and a loopback-only synthetic PostgreSQL database passed: two-room form creation; three guests; two-guest transfer using the new staff controls; duplicate source/wrong URL rejection; UI and HTTP check-in/out; private documents; anonymous/foreign branch denial; customer internal HTTP projection/isolation; receipt and receivables reconciliation. Net **2001.00**, paid **250.25**, balance and posted AR **1750.75**. One receipt; all journals balanced. No production credentials entered test processes.

Four PDFs (one- and two-page reservations in both price modes) were text-checked and all six rendered pages visually inspected. The long case has eight rooms and sixteen long guest names. Mobile375 and desktop1440 screenshots checked; final mobile bounding checks additionally verify the navigation and heading fit the viewport.

Commands: `npm run test:hotel:pg17 --prefix backend` and `npm run test:hotel:browser --prefix backend` require explicit disposable synthetic database variables; browser acceptance also requires its output and installed Playwright paths. The browser script refuses production/non-loopback databases and real repository environment files.

## Recovery and compatibility

Base release: `1b9aa05b2fddc17c7b5e543997220432087bd3e2`, Hostinger `01a18b78-64ad-739d-aaea-7f73c837b5be`. Exact deployed application archive retained locally, credentials/logs/uploads/storage excluded. SHA256: `ffa5cfa5ce94cb66d680919a1eeab9f79fa7a65a78fed9d893f46033df1add9e`.

Retained compiled API was started against synthetic candidate records with local installed dependencies: health/login, candidate hotel read, anonymous denial, receipt-write maintenance503 and unchanged financial state passed. This is not a full Linux bundle rehearsal. No schema migration or historical rewrite is required. Existing repository room callers use booking URL plus body room ID. The old room-ID-in-URL fallback is no longer accepted by HTTP actions; undocumented external hotel clients would need to use the booking URL. No external hotel clients were observed or contacted.

If rollback is required: obtain authorization for production write maintenance, keep receipt/business writes held, restore the retained application or redeploy the recorded base commit, then verify identity/health/auth/cache and payment safeguards before reopening. Never restore a database snapshot for this code release. Reverting removes new hotel protections and UI, so do not reopen hotel operations until the defect is addressed.

## Capability checkpoint

| Capability | Evidence/status | Remaining limit |
| --- | --- | --- |
| Multi-room guest allocation | Working; Chrome/API/PG17 | Booking graph editing and passenger merges not accepted here |
| Room transfer/check-in/out | Working; retries/capacity/scope/occupancy covered | Supplier room confirmation remains external |
| Hotel receipts/accounting/report | Working in synthetic partial-payment journey | Full settlement, supplier settlement and refund payouts not accepted |
| Customer hotel visibility | Working internal HTTP projection, completed and isolation | Public account login unchanged; not repeated this release |
| Reservation documents | Working current stays/guests, one/two-page PDFs, both price modes | Production uploads remain disabled |
| Recovery | Exact application retained; old compiled API compatibility passed | Full Linux/offsite disaster recovery remains partial |
| SMTP recovery delivery | Blocked; held | Owner must correct mailbox credential; no unchanged-auth retries or messages |
| Policies | Pending owner decisions | No publication or invented refund/retention rules |
| Umrah/STAR/ticketing/transport/visa/complaints/staff | Existing implementations preserved | Subsequent operational acceptance remains separately scoped |
| Integrations/independent monitoring | Inactive/proposal stage | Approved free access and business requirements still needed |

Deployment is authorized by the owner's request to finish and deploy once checks pass. No migration, production business-data change, upload/provider activation, policy publication, mail delivery, credential change, backup export or database restore is part of this release. Everything stays within existing free allowances.
