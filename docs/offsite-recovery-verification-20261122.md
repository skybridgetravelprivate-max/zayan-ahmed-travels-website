# Approved offsite ciphertext retrieval and restore — 22 November 2026

Verdict: the approved Drive ciphertext upload/retrieval and isolated public-schema restore leg passed. Independent human key custody and full-platform recovery remain open. No production changes occurred.

## Approval, storage and retrieval

The owner explicitly approved the connected Google Drive My Drive for only the retained encrypted pre-release public-schema backup and its checksum/scope manifest. The two uploads were verified through provider metadata as `shared=false`, with only the owner permission. No public link, recovery identity, password or plaintext data was uploaded. Artifact IDs and private operator paths remain in the owner-restricted recovery inventory outside the repository.

The uploaded ciphertext was retrieved through the Drive connector as a raw-file reference and materialized into a new restricted local directory. The downloaded 354318 bytes matched retained SHA256 `a9c13bc30fba7b1437de8f6693ab4488bd3d8b781d85363c9c8a4cae8435f1af`. The download was not substituted with the existing local ciphertext. The comparison used the previously retained release checksum/fingerprints.

## Isolated restore evidence

- Fresh loopback-only PostgreSQL 17.12 cluster; UTC explicitly verified.
- Decrypted with the existing local recovery identity, which stayed outside Drive/repository/reports. This does not establish independent custody.
- Every restored public table's sorted full-row fingerprint matched the pre-release snapshot, including migration history and financial tables; 178 foreign keys were validated.
- Snapshot migration history: 16 completed, zero unfinished. Applied the two reviewed additive migrations only to the isolated restore: 18 completed, zero unfinished.
- Generated Prisma reads passed for staff, customers, journals, receipts, website customers, stored documents and communication ledger/submission models.
- The successful decryption/restore/verification attempt took 22 seconds, measured separately from provider upload/download and the preceding setup retry. This is one local drill observation, not a production recovery-time guarantee.
- Cluster stopped; decrypted dump removed. Restricted database files/evidence remain under the private operator retention process. No customer rows or secrets were reported.

An initial operator restore omitted the documented `--clean --if-exists` flags and collided with the fresh database's default public schema. It stopped transactionally. The accepted attempt used another fresh isolated cluster and the documented flags; no production or existing customer database was cleaned.

## Exact scope and remaining acceptance

The snapshot predates the PR #44 migrations and subsequent production writes. It has zero journals and receipts: matching financial-table fingerprints therefore does not prove restoration of populated financial balances. The previously verified populated synthetic financial/object drill remains separate local evidence and was not relabeled remote recovery.

This archive excludes storage object bytes, other platform schemas, secrets/configuration, deployment artifacts, mailbox/DNS and supplier state. One approved offsite snapshot is not a scheduled backup service, retention policy, independently held key, hosted role/RLS replacement acceptance or full-platform recovery.

Next: nominate an actual independent custodian and exercise the approved offline key-access process; approve scheduling/retention/recovery targets; pair future accepted database snapshots with object-byte manifests/backups and populated synthetic financial recovery acceptance. Run hosted document acceptance only on an approved isolated project. Production uploads remain disabled until separate acceptance and activation approval.
