# Agency booking design

Shared approved identity: Zayan Ahmed Travels Private Limited, the existing
Abbottabad address, zayanahmedtravels@gmail.com, website and +923121558860.
Defaults live in `backend/packages/config/agency-brand.cjs`, packaged with the
existing runtime. Saved company settings still override PDF defaults; no settings
or credentials were written. The form masthead uses the approved shared identity.

The existing management form/workflow renderer now groups the same declared
fields into customer, journey, pricing, notes and reference sections. Field names,
payload allowlists, permissions, confirmations and financial workflows are intact.
This brands all existing management modules; it does not create missing booking
engines or imply that an unsaved form is a confirmed booking.

Existing quotation, Umrah, hotel, transport, ticket, refund, invoice, receipt and
salary PDF routes share the redesigned A4 header, wrapped key/value rows, contact
details, continuation headers, footer pagination and signature area. Added
read-only transport-booking and visa-application summaries using the existing
document and owner/branch authorization. Visa summaries are not visas or approval.
Saved-record PDF links appear only when staff have document.view; the API checks
document permission and the relevant entity's scope again. Price-excluded mode
and supplier-cost filtering remain enforced.

PDF generation now returns its promise to controllers, so settings failures do
not leave an unhandled asynchronous render. Responses are private/no-store with
safe filenames. Company terms are rendered only if configured; none are invented.

The synthetic preview uses no database or customer documents. Its ten sample
sections and continuation rows demonstrate design and pagination, not production
records. Print output uses the current PDFKit Latin fonts, as before.

No schema, migrations, imports, financial writes, upload activation or deployment.
PR #29 remains a separate unmerged presentation audit; this change is independent.
