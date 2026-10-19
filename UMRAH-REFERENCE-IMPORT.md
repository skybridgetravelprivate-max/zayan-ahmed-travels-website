# ISB–JED Umrah reference import

The user approved reuse of the packages visible in the authenticated QFC Umrah
Groups page and requested **ISB–JED only**. The local capture contains 77 source
groups and 92 unique source packages. The exact-sector converter selects 56
groups and 67 packages, with four room options each (268 package records) and
13 hotel masters. The raw and prepared business snapshots stay outside Git.

## Existing-model mapping

`UmrahPackage` already owns one room type and per-person price. Each source
package therefore has Sharing, Quad, Triple and Double variants identified by
`QFC-UP-<source-number>-<room-type>`. The catalog groups these records by the
source flight group and package code. This is an offer catalog, not an import of
operational `UmrahGroup` allocations or live ticket inventory.

- Source flight labels/schedules and group IDs remain in `flightInfo`.
- The 14/15/19/20-night values map to the hotel-night fields; `durationDays` is
  total nights + 1. Visible source dates lack a year, so date columns remain null.
- Makkah and Madinah hotels retain their displayed names and distance text.
  Conflicting distance text is not silently reconciled.
- Each adult room rate is the full package price in PKR, not a supplement.
  Child price means **without bed**; infant prices are retained separately.
- All imported records are `REVIEW_REQUIRED` and packages are `isPublic=false`.
  Costs/inclusions are unverified. Existing zero/false defaults are explicitly
  documented as unknown in each package description, not verified supplier terms.
- The API refuses unreviewed packages in dedicated and generic Umrah booking
  paths. Operators must verify year/dates, prices, costs, inclusions and supply
  before activating a package. No booking/financial entry is created by import.

## UI and authorization

`/admin/manage/umrah-packages/catalog` provides flight-group cards, hotel-night
details, room rates, search, duration filtering, price sorting and links to the
existing constrained record editor. The Travel → Umrah packages hub opens this
view. Staff must have `umrah.view`; editing retains `umrah.edit`. Data is served
with private/no-store cache policy and is never returned by public package APIs
unless an operator subsequently activates and publishes it.

## Import/recovery behavior

`backend/scripts/prepare-umrah-reference.mjs --source <local-snapshot.json>` is
dry preparation only. `--out <new-file.json>` writes a new file and refuses to
overwrite one. It validates exact sector, identifiers, complete rates and nights.
It does not connect to a database or apply migrations.

The authorized database import uses one transaction, explicit columns and stable
source-prefixed IDs/numbers. Existing records are never updated: conflicts are
skipped, then counts and field comparisons must match the prepared snapshot.
Capture source/checksum and final counts outside version control. No schema,
credentials, migrations, customer records, bookings or accounting are changed.
If review fails, leave the records private/unreviewed; deletion is not automatic.

The snapshot is not a supplier integration. Seat counts, prices and schedules
can change after capture. No source booking button is clicked. Do not interpret
the imported source-seat count as inventory reserved for this business.
