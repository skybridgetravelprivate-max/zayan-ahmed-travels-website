# Management module audit — 19 October 2026

## Scope and evidence

All 62 links exposed by `/admin/manage` were opened through an authenticated
production staff session. Each page rendered its authorized list/count or empty
state without a page/API loading error. This covers CRM, travel, visas, hotels,
flights, transport, partners, finance, HR, staff administration, website pages,
and configuration catalogs. Checks were read-only; no production form was saved.

The workflow integration regression compares every action in
`src/lib/staff-workflows.ts` with the registered Nest controller POST paths and
permission metadata. It catches missing routes and frontend/backend permission
mismatches. Management service permission and branch checks have separate tests.

## Confirmed fixes

- Quotation items reject zero, negative, fractional, non-finite and out-of-range
  quantities, invalid monetary values, and malformed descriptions before writes.
  The frontend also sets a positive minimum for item quantity.
- Hotel room types and physical rooms must belong to the selected hotel; a
  physical room must match the supplied room type and cannot be deleted. The same
  shared check protects generic physical-room/booking writes and reservation
  graph writes, including edits, before records are inserted or changed.

Regression coverage uses isolated mocks to prove rejection before writes and
valid input propagation. It does not prove live database concurrency behavior.

## Limits

A successful list check does not certify every mutation, every staff role, or
every business outcome. Most production modules are currently empty. Financial
transactions, customer records, staff access and production documents were not
created or modified as tests. Advanced workflows outside the implemented slice
remain listed in `STAFF-MANAGEMENT.md`.

No schema change, migration, credential change or upload activation is required.
Document uploads must remain disabled.
