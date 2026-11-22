# Isolated hosted-storage setup — 22 November 2026

Historical setup record: the isolated project and private bucket were prepared with an initial server-credential blocker. That blocker was subsequently resolved and the real hosted storage/auth checks passed with local isolated application/database fixtures; see [acceptance results](hosted-storage-acceptance-results-20261122.md). Production uploads remain disabled. No paid resource, deployment or production financial/storage write was performed.

## Quote and authorization

The owner explicitly selected the existing Zayan Ahmed Travels Supabase organization. The project cost tool returned amount 0, recurrence monthly. The quote was reported before creation and the owner explicitly approved the $0/month isolated test project. This quote does not authorize future nonzero charges or establish unlimited free usage.

Created project `zat-storage-acceptance`, ref `joptpiauirpqlkvoishp`, in ap-northeast-1. A separate get-project readback confirmed ACTIVE_HEALTHY and PostgreSQL 17.12 before database operations. This is distinct from production `wxevvsnguskhvtnyyggi`.

## Prepared and verified

- Created only private test bucket `zat-storage-acceptance` on the isolated project, after inspecting its empty bucket/object inventory.
- Limit 8388608 bytes; PDF/JPEG/PNG/WebP/plain-text allowlist, matching existing adapter limits.
- Readback: public=false; storage.objects RLS enabled; zero object policies; zero objects before and after negative probes. No anonymous read/upload policy was added.
- Anonymous private/public-path reads, publishable-only reads and publishable upload probes returned non-success HTTP 400. The paths had no existing test object. These are baseline negative probes, not evidence of authorized storage, customer denial against a real object or hosted durability.
- Prepared an inherited owner-only local configuration outside the repository, restricted to the approved test project/bucket. The server credential field remains blank. No service credential, recovery key or plaintext customer record was reported or committed.
- Production public health returned HTTP 200 with database healthy. hPanel revision/flag readback could not be repeated because browser control was unavailable; the prior verified release/flags remain historical evidence, not a newly inspected setting.

## Concrete credential blocker

Available Supabase connector capabilities return publishable/legacy-anon keys, not an existing server secret. Dashboard browser control timed out; the machine has no authenticated Supabase CLI/session token. The positive adapter path requires this isolated project's existing server secret/service-role key. Do not reuse a production key, extract a signing secret through SQL, add permissive policies, or claim publishable credentials are equivalent.

Resolution: native Windows browser controls reached Supabase; the owner completed sign-in. The existing test-project secret was then retrieved privately, saved to the owner-only local environment file and verified against the correct private bucket with HTTP 200. No credential was created/rotated and no production key was reused. The initial access limitations above are historical, not a current request for the owner to paste the key.

## Remaining hosted acceptance

Once configured, privately verify the exact project/key/bucket binding, then follow `recovery-storage-acceptance.md` using synthetic records: real authorized upload/download and SHA256; anonymous/customer/foreign-branch denial against existing bytes; isolated application restart/fresh-process retrieval; missing-object and object-connection outage with metadata retained; paired metadata/object backup/restoration; non-destructive reconciliation. Label local application versus hosted object-service evidence accurately. Do not claim provider restart durability from restarting a local fixture.

## Independent key custody

The owner answered DRIVE when asked for a custodian. Drive is the approved ciphertext location, not an identified independent human custodian. No recovery identity was uploaded or distributed. Record an actual person's name/role and approved offline access procedure before claiming independent custody. The offsite ciphertext retrieval/restore evidence remains valid within its documented scope.
