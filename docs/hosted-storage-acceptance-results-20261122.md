# Real hosted storage/auth acceptance — 22 November 2026

Verdict: the real Supabase object/auth service checks passed against the approved isolated project. The Nest application and disposable PostgreSQL 17/UTC metadata ran locally. This is not evidence of a hosted application deployment, provider restart/outage, complete disaster recovery or production activation approval.

Target: isolated `zat-storage-acceptance`, project `joptpiauirpqlkvoishp`, private bucket `zat-storage-acceptance`. The owner approved the quoted $0/month setup. Production project `wxevvsnguskhvtnyyggi` was not used. Existing compiled application code matches the deployed backend source; the review changes remain documentation only.

## Credential resolution

After the owner signed into Supabase, the existing test-project secret was read through native Windows browser controls and saved to the prepared owner-restricted environment outside the repository. Private bucket verification returned HTTP 200. No new key/access grant, credential rotation, production-key reuse or public-policy exception was introduced. The connector still only exposes publishable keys; the earlier credential blocker is resolved.

## Actual checks performed

1. Verified the exact approved project/bucket binding, private status, existing size limits and empty initial inventory. A fresh disposable loopback PostgreSQL 17/UTC database received the reviewed migrations.
2. Seeded synthetic branch-scoped staff/customer records. Real staff HTTP login/upload through the compiled Nest API saved synthetic PDF bytes to hosted storage and metadata to the isolated database. Authorized HTTP download returned private/no-store and identical SHA256.
3. Against that existing object: anonymous application download returned 401; another branch's permitted staff received 404; anonymous private/public object paths did not succeed. Created and signed in a synthetic Supabase customer without sending email; their actual access token could not download the private object directly. No object policy was added.
4. Stopped and relaunched the isolated application as a new process. The same staff session downloaded identical hosted bytes. A separate fresh Node process using the real adapter independently retrieved the same hash.
5. Injected an object-connection failure only inside the isolated application process while retaining hosted bucket verification. Download returned sanitized 503 without exposing credentials; metadata remained. Restored the connection. This is application-side fault injection, not a Supabase service outage.
6. Exported synthetic metadata and exact object bytes with a SHA256-checked pair manifest; intentionally altered checksum was rejected. Removed only the designated disposable object; download returned 503, metadata remained, and inventory reconciliation detected missing bytes.
7. Removed only that synthetic metadata row, validated the saved pair, restored the hosted object and exact metadata, restarted the application process and downloaded the original bytes/hash. Application-visible metadata fingerprint matched.
8. Created one explicitly disposable orphan fixture. Reconciliation found zero missing and one orphan object; no unknown object was automatically deleted. Cleanup removed only this run's two known fixture objects and synthetic auth user. Provider readback confirmed zero objects/users afterward, bucket still private, RLS enabled and zero object policies. The local database cluster was stopped.

Eight recorded checks passed in 24 seconds. Synthetic PDF SHA256: `bc761d41b6e469186e2a9f16025dd1eaa93a6ca698a15bd15a662ecc94acc7e3`. Private operator code, logs, pair manifest and aggregate result remain outside the repository; credentials are not included in this document.

## Remaining acceptance boundaries

- No hosted Nest application or hosted metadata database was deployed/restarted. Verify the eventual approved hosted runtime, configuration injection, durability and operational ownership before production activation.
- Provider durability guarantees, provider restart and actual hosted service outage were not exercised; a short successful persistence drill is not a retention guarantee.
- The paired backup is synthetic and local. Establish approved scheduled paired database/object backup, offsite retrieval, retention and independent human custody. The separately retrieved production-schema archive has no journals/receipts and excludes object bytes/later writes.
- Review production project/bucket/runtime and prepare a separately approved activation/disable-uploads rollback. Keep `DOCUMENT_UPLOADS_ENABLED=false` until those remaining gates pass and activation is explicitly authorized. Do not deploy or enable uploads as part of this evidence update.
