# Local recovery and first hotel journey validation — 30 October 2026

Base: c98b9bcc6f8f05aa53fa750a1bac3b7fcc2883c1. Branch: repair/recovery-operations-20261030. Local implementation and synthetic acceptance only. No migration, push/deployment, production password/data changes, mail/provider activation or policy publication. No additional agents. Everything stayed free.

## Repairs and owning files

- backend/apps/api/src/auth/auth.controller.ts: validates recovery email/token; globally unconfigured SMTP returns503 before account lookup/token creation. Eligible requests create hashed one-hour tokens using the existing store and existing mail adapter. Unknown/inactive users retain generic responses. Failed/skipped delivery invalidates the unissued token and emits a fixed redacted warning. Existing atomic single-use claim, password policy, session revocation and sibling-token invalidation remain. Real provider delivery is unverified and inactive.
- src/app/admin/forgot-password/page.tsx, src/app/reset-password/page.tsx and src/components/admin/StaffRecoveryForm.tsx: accessible staff-only request/reset forms, password confirmation and existing10character/72UTF8-byte constraints, duplicate-submit prevention, unavailable/expired/used/error states and fresh sign-in. Missing/malformed links show recovery guidance. Reset success removes the URL token. Website customer identity/recovery is explicitly separate.
- src/app/admin/login/page.tsx: discoverable staff recovery link.
- next.config.ts: reset route private/no-store, no-referrer and noindex/nofollow. Dynamic page and metadata also prevent public indexing/caching. src/components/layout/SiteChrome.tsx treats the reset page as a staff surface; no public header/footer navigation is required to reset.
- src/lib/staff-workflows.ts and src/components/admin/ManagementWorkspace.tsx: expose existing reservation graph guest allocation for the single-room quick form. Previously check-in required PAX but quick creation could not assign any. Optional labelled guest is assigned to exactly one room; selecting a guest with multiple rooms is rejected rather than duplicating the passenger. Existing backend branch/person/occupancy rules remain. No new endpoint, permission or schema.
- backend/apps/api/src/auth/password-recovery.spec.ts and password-recovery.pg17.spec.ts: unavailable-mail reproduction and realPG17 lifecycle/concurrency/failure proof. backend/apps/api/src/common/security-audit.spec.ts uses the actual64hex issued-token format; atomicity assertions retained. backend/package.json registers unit and opt-in PG17 command.
- backend/scripts/recovery-hotel-journey.cjs: actual installed Chrome against the packaged Next/Nest gateway; explicit local disposable synthetic-only database guard and clean child environment. No email adapter invoked in this browser process.

## Policy drafts

outputs/policy-drafts-2026-10-30 contains privacy-draft.md, terms-draft.md, refund-cancellation-draft.md and owner-decision-register.md. All are INTERNAL/NOT EFFECTIVE and unpublished. Verified business identity/contact and current application behavior are distinguished from unresolved operating practices. No fee, tax rate, payout deadline, retention schedule, legal right, supplier promise, licence or legal certification was fabricated. Owner/professional review and exact-content publication approval remain required. Existing live policies are unchanged.

## Acceptance passed

- Backend143tests; staff11tests.
- RecoveryPG17:7runner tests including parent (6subcases): unknown/inactive generic response, hashed token/correct destination, malformed/weak/expired rejection, concurrent single-use reset, session/sibling revocation, failed-delivery invalidation, disabled-account transaction rollback.
- ReservationPG17:6runner tests including parent: split scope/confirmation, audit rollback, concurrent duplicate split, physical-room collision and cancellation credits preserving balanced journals. Existing payment/payout safeguards retained.
- API build/typecheck and website production/Hostinger packaging passed. API lint clean; website0errors/2existing StaffSessionForm navigation warnings. Diff whitespace check passed after line-ending normalization. No dependencies or lockfiles changed; earlier audit snapshot reused, not a new vulnerability scan.
- Actual Chrome recovery: unavailable-mail UI/503 with no token created; malformed-link guidance; private/no-store/no-referrer/noindex response; confirmation mismatch rejection; reset using a seeded synthetic token; old real-cookie session401; token reuse400; successful fresh login. The token was seeded to test the interface without enabling SMTP. No actual mailbox delivery or production credential change is claimed.
- Actual Chrome hotel: create one-room/one-guest reservation with initial keyed CASH receipt, then check-in and check-out from real staff forms. Checkout before check-in denied400. Net1000.50, cost600.25, paid250.25, balance750.25. Exactly one initial receipt; posted AR and the exact customer's receivables report row equal750.25; posted journals balance. Receipt PDF downloads as private/no-store. Anonymous401 and foreign branch404.375/1440viewport overflow checks pass. Selected reset screenshot visually reviewed.

## Honest scope of first operational journey

The validated journey is the manual staff single-room stay path through checked-out room with a correctly outstanding receivable. It is not proof of fully settled finances, all-room allocation or complete hotel ERP acceptance. No supplier confirmation/payout, customer-facing website hotel history, accommodation voucher generation, room transfer or multi-guest/multi-room GUI acceptance is established. Receipt PDF availability was checked; no template changed and no new full PDF visual audit was performed. Those gaps stay in the backlog rather than being hidden by a completion claim.

## Failures resolved without weakening safeguards

The original unit test reproduced false recovery success with SMTPabsent. The initial PGtest used findUnique on nonunique tokenHash; corrected to the existing schema's findFirst semantics. The existing reset fixture used a non-issued short token; corrected to64hex while preserving claim/revocation assertions. Initial browser run expected403for a foreign reservation, but the established get scope correctly returns404; the assertion was corrected to that non-disclosure contract. Report reconciliation was strengthened to the exact synthetic customer row instead of a substring match. No auth or accounting guard was relaxed.

## Reproduction and environment

Use Node22 and a clean environment containing only operating-system values plus the disposable local database. Existing14migrations were applied only to a fresh zat_synthetic_recovery_ops_* database at127.0.0.1:55321. Production credentials were never loaded; recovered customer data was never used. The browser harness refuses any other database name/host. No paid provider calls.

Commands: npm test --prefix backend; npm run test:recovery:pg17 --prefix backend (ZAT_SYNTHETIC_DATABASE_URL explicitly synthetic); npm run test:staff; npm run build --prefix backend; npm run lint --prefix backend; npm run lint; npm run build:website; backend/node_modules/tsx/dist/cli.mjs --tsconfig backend/apps/api/tsconfig.json --test backend/apps/api/src/reservation/reservation-completion.pg17.spec.ts; node backend/scripts/recovery-hotel-journey.cjs with explicit local output and installed Playwright path. Exact commands/results are in outputs/recovery-operations-checks-2026-10-30.json. Failure logs retained under workspacework.

## Next gates

Review policy decision register before approving publication. Production SMTP/delivery activation and real-password changes require their own authorization; this repair does not activate either. Customer password recovery remains a separate unimplemented/unaccepted scope. No migration is needed for these repairs. A future exact-commit release needs current baseline/recovery/compatibility review and separate push/deployment approval.

Next operational acceptance should address explicit room allocation/transfer and accommodation document persistence/visibility, using established backend invariants and synthetic data. Do not invent supplier confirmation, refund payout or retention policies to force acceptance. Full-platform status remains partial.
