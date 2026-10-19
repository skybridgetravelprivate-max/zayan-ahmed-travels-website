# Staff management console

The staff console is at `/admin/manage`. The existing dashboard and read-only
lead URLs remain available; lead details link to the management controls.

## Implemented behavior

- Permission-filtered module navigation across CRM, travel, hotels, flights,
  transport, partners, finance, team, administration, website content and settings.
- Paginated search, explicit scalar field projections, detail screens, typed forms,
  and scoped reference selectors. Database columns are not exposed automatically.
- Lead creation/editing, branch routing (requires `lead.assign` for changes), status
  changes with reasons for lost/cancelled leads, and active staff assignment in the
  lead's branch. Staff assignment preserves the existing agent assignment.
- Customer/passenger records, follow-ups, tasks, complaints, packages, hotel/room
  masters, visas, agents/suppliers, transport masters, employee/attendance/holiday
  records, website pages and configuration catalogs expose constrained create/edit
  forms where their model and permissions support them.
- Dedicated workflow forms for lead notes, customer conversion, quotation
  creation/items/sent status, complaint notes/resolution/closure, ticket issue/refund,
  Umrah creation/stage changes, transport creation, single-stay hotel reservation
  creation, room check-in/check-out, reservation cancellation, receipts, payments,
  expenses and journal posting/reversal. Financial actions use the existing domain
  endpoints, not generic CRUD, and require explicit confirmation in the form.
- Super administrators can create inactive staff accounts, edit staff profiles,
  and configure existing roles, branch membership, default branch and account
  status. Access changes revoke existing sessions. Self-lockout and removal of the
  last active administrator are rejected. Passwords are hashed and never projected
  into records, audit payloads or browser responses.

## Security and consistency

Management requests use the existing staff session guard. The server checks
permissions and branch scope independently of UI visibility. Management mutations
require an explicitly approved Origin and all management responses use
`private, no-store`. Owner-linked task/follow-up scopes check every linked owner;
personal notifications are limited to the current staff member.

Inputs reject unknown/nested fields and validate schema enums, dates, references,
email shape, lengths and numeric ranges. Existing records with `updatedAt` require
the version that was read; stale edits fail instead of silently replacing changes.
Edits and audit writes share a serializable transaction. Assignment/status/access
changes also run in transactions. Models without `updatedAt` cannot offer this
version comparison; concurrent changes can still conflict at database isolation.

Ticket issue, transport booking creation and Umrah save now propagate a single
transaction through their record, number, journal/voucher and audit writes. Ticket
payment status is derived from the paid amount. Customer/passenger links on newly
created travel records must align with the selected booking branch. Existing
refund locking and reservation accounting protections remain in place.

The generic resource sanitizer now converts date/boolean strings only for schema
fields of those types; ordinary text beginning with a date or equal to `true` or
`false` remains text.

## Deliberate boundaries

This is a management expansion, not a claim that every ERP operation is complete.
The UI does not expose bulk deletion, direct ledger editing, role-permission
definition changes, automated payroll execution, ticket reissue, multi-stay
reservation editing/splitting/transfers, STAR room allocation, document upload
activation, or automated communications. Corresponding records may be view-only.
Those workflows need their own narrowly validated screens and acceptance tests;
do not substitute an arbitrary JSON editor or bypass their domain endpoints.

Document uploads remain disabled. No database schema/migration, production data
operation, credential change, backup provisioning or paid service is required by
this change. Creating a staff account in the product requires the administrator to
enter its initial password privately; account activation is a separate action.

## Verification scope

Management regression tests cover catalog projections, permissions, branch scope,
field validation, stale edits, assignment eligibility, transactional propagation,
staff-access validation/session revocation and Origin enforcement. Financial
rollback tests use simulated transactions; they do not prove live PostgreSQL
serialization or locking. The browser fixture uses synthetic records and no
production credentials/database. Production business writes must not be used as
test fixtures.
