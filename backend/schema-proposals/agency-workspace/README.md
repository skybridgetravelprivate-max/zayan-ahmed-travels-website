# Agency workspace additive schema proposal — NOT approved for production

The reviewed SQL has a byte-identical local migration copy at backend/packages/database/prisma/migrations/20261104172419_agency_workspace. The local copy is prepared for review and has not been applied to production. It was applied only after 14 baseline migrations in a fresh loopback PostgreSQL 17 synthetic database. Production execution requires the separate migration approval.

Adds Session.audience (existing rows default staff), nullable Agent.branchId, AgencyMembership and AgencyRequest with foreign keys and unique request identities. Existing Agent business records and child relationships retain their meaning. No historical agency, branch or user assignment is inferred. Multiple users may belong to one agency; each user may belong to at most one agency. Internal-role users fail closed at agency access.

## Gate before production
Review exact SQL against current deployed schema and caller compatibility; reconcile existing Agent branch ownership and proposed external users; verify fresh recovery and retained application artifact. Obtain separate migration, access provisioning, feature activation and exact release approval. Keep AGENT_PORTAL_ENABLED false until approved memberships and branches exist. Uploads and providers remain inactive.

The whole candidate requires this schema even with the feature disabled: Prisma Session reads include audience. It is not a code-only release.

## Recovery
Disable agent feature and stop new external submissions before an approved rollback. Preserve additive schema and request/audit records. Revert to the retained compatible application artifact, verify existing staff/customer login and guarded finance paths. Do not drop new tables or restore a database to undo a code release. External session revocation or membership changes require their applicable approval. Windows synthetic tests are not a Linux production rollback rehearsal.


## Final local acceptance additions

AgencyRequest.leadId optionally links an existing Lead. The linking endpoint requires agent.edit and lead.view, checks the same agency and branch, serializes duplicate links, and audits once. Conflicting links require ownership review. Agent responses disclose operational and released quotation references only while current ownership matches. Lead/customer creation, quotation and booking execution reuse existing CRM services.

The exact draft wraps additive changes in a transaction with a five-second lock timeout and sixty-second statement timeout. New AgencyMembership and AgencyRequest tables enable RLS with default deny. Existing anon/authenticated roles lose direct table privileges for these new tables. Production approval must explicitly include this security scope. Prisma application access requires the runtime database role to own the tables or have an already approved access policy. Review the runtime role before execution. The draft creates no database roles and grants no broader privileges.

Synthetic lifecycle fixtures verify defaults, foreign keys, uniqueness, old-column compatibility, direct anon/authenticated ACL revocation and RLS denial even after deliberate synthetic SELECT grants. Full application HTTP acceptance also passes with RLS enabled. The retained current compiled API/gateway rehearsal uses separate synthetic records. Full Linux dependencies remain outside the rehearsal.

Run preflight.sql through the current application database connection before approved migration execution. Confirm the expected source commit, 14 completed migrations, absent proposal columns/tables and runtime owner/access prerequisites. Apply draft.sql only under exact approval. Run postflight.sql after execution and verify old staff/customer authentication with Agent activation disabled before considering the separate source deployment gate. Never provision external users from an unreviewed mapping.
