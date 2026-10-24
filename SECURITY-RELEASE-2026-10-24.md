# Security dependency release — 24 October 2026

The owner authorized fixes and deployment. The preceding application release 85f152c completed on Hostinger as deployment 01a16ce8-34f9-7372-bb51-359d40fa6deb.

GitHub reported dependency alerts during that push. Lockfile-only npm audits confirmed critical Next.js, high Zod, high Multer/body-parser and moderate Nodemailer advisories. This follow-up updates affected dependencies without application workflow changes or database migrations.

Validated installed versions: Next.js/eslint-config-next 16.4.3; Zod 4.6.6; Multer 2.5.0; body-parser 2.4.0; Nodemailer 10.2.1; Nest platform-express 11.2.8. A backend Multer override removes Nest's exact vulnerable nested version without downgrading or changing Nest's major version. Root and backend lockfiles both report zero known vulnerabilities in the current npm audit snapshot. Future advisories remain possible.

Validation ran in a separate clean source copy with no application environment files or production credentials. Free npm dependencies were installed only there, with lifecycle scripts disabled; Prisma client generation was explicit and no migration/seed ran. Installed Next upgrade guidance was read. All 136 backend regression tests, 15 customer-booking tests and 3 receipt retry tests passed. API compilation and the Next.js production build with combined Hostinger packaging passed.

Actual Chrome and HTTP/proxy synthetic PG17 checks passed with the new dependency set: real login cookies, branch/customer isolation, quotation totals/conversion, lost payment response, same-key two-tab retry, reload and full browser closure recovery, explicit review, PDF access and authenticated private/no-store cache assertions. All financial test data remained in the loopback synthetic database. Off-system providers and production financial writes were not tested.

The exact pre-release application bundle and a separate receipt-write-blocked recovery bundle are retained locally with owner/SYSTEM-only access. The old bundle contains the old dependency versions: use only as an emergency recovery artifact, with receipt writes blocked and public exposure restricted until patched service is restored. Do not restore a database snapshot to undo a code release. Do not delete financial records or review events.

This report records validation, not completion of every platform module. Final Hostinger build status and live smoke checks are recorded separately after deployment. No paid services, plan changes, production migrations, seeds, credential or permission changes are included.
