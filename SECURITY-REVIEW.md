# Full-stack security review — 2026-10-17

Reviewed 198 first-party frontend, API, configuration and deployment-script source files through Caveman/OpenAI in separate frontend/backend bundles. A follow-up review examined the changed code. Static review and unit tests do not prove the absence of every defect.

## Behavior changes

- A self-registered email no longer automatically attaches an existing CRM customer. Existing email-only links do not authorize booking access.
- Before bookings are shown, a super administrator must independently verify account ownership and explicitly confirm the website/CRM association through POST /api/v1/website/customer-links, with websiteCustomerId, crmCustomerId and ownershipVerified=true. Both emails must match. The operation updates the soft link and records an immutable verification audit in one transaction. No existing account is automatically marked verified by this release. Website sign-up/sign-in remain available; unverified accounts see a verification instruction on the bookings page.
- Staff password reset atomically claims a one-use token, preserves administrative disablement, and revokes sessions and remaining reset tokens. Password changes also revoke sessions. No existing credential is changed by deploying this code. Temporary failed-login locks no longer turn inactive accounts into active ones. Deleted staff accounts cannot authenticate.
- Staff identity administration, role mutation and permission/branch assignment are limited to super administrators. Audit records and posted finance records cannot be modified through generic CRUD. Nested identity hashes are removed from generic resource responses; branch changes and bulk lead archives enforce authorization.
- Dedicated CRM record operations check branch ownership, including linked leads, merge targets and child records. Empty branch membership no longer grants global list access.
- Global dashboard financial summaries/charts and unscoped finance/report controllers require super-admin access. Scoped staff retain their basic staff workspace and authorized branch CRM routes. Delegated branch-level finance/report access requires a separately implemented complete branch projection; it is not enabled by this release.
- Receipt, payment, expense and invoice posting uses a shared transaction. Umrah receipt owner/booking relationships are checked, and receipt balance updates use serializable isolation to prevent lost updates. A serialization conflict returns failure and must be retried; no partial receipt should commit. Receipt bookingId is the schema's UmrahBooking foreign key; arbitrary ticket/hotel ids are not treated as that foreign key.
- Manual/opening/adjustment reversal claims a posted journal once in a transaction. Direct reversal of business journals is rejected; use the source module refund/cancellation workflow to keep source records consistent. Draft posting also atomically claims its status. Ledger readers retain both the REVERSED original and the POSTED offset. Historical journal data is not rewritten or reconciled automatically.
- Customer identity reads no longer delete expired sessions on every request; expiry is still enforced when resolving a token. Invalid upstream booking rows return unavailable rather than a misleading empty list. Inquiry dates reject impossible dates.

## Scope boundaries

No migrations, schema edits, imports, seeds, resets, restores, production account mutations or credential rotations. Uploads remain disabled. No new email ownership proof is inferred, and no live verification audit was inserted during development. SMTP and a public recovery UI are outside this release; staff sign-in continues to direct recovery requests to an administrator.

Existing catalog/demo placeholders remain. No invented packages, fares or customer reviews. Third-party dependencies and generated build output were not included in the source review.
