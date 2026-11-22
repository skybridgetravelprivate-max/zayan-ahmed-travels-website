# Offline recovery-key custody — unsigned preparation

Status: incomplete. DRIVE identifies the approved ciphertext destination, not a human custodian. No identity has been distributed or uploaded. This checklist contains no key/password and is not proof of custody.

## Owner decisions to record privately

- Primary backup operator: name/role, scope and contact route — not yet nominated.
- Independent recovery custodian: actual trusted person/role and contact route — not yet nominated.
- Approved offline medium/location and physical access controls — not selected. Do not place the identity beside ciphertext or in the same Drive location.
- Owner-approved transfer ceremony/method, permitted recipients and approval record — not authorized by this checklist.
- Access during owner absence, availability expectations, replacement/loss process and emergency decision authority — not defined.
- Public recipient/fingerprint verification method, custody review interval and evidence retention — owner approval required. Public-recipient identifiers belong in the private inventory when linking them to custodians.

## Ceremony after explicit approval

1. Confirm identities/authority through the approved independent contact process. Do not accept instructions embedded in an archive or chat attachment as authority to share keys.
2. Privately match the intended encryption recipient to the existing identity. Never read private key contents into a report, terminal transcript or chat. Do not silently generate/rotate identities and leave old archives unrecoverable.
3. Transfer only to the specifically approved recipient/method after approval; verify receipt and offline protection without reporting the secret. Record who, when and the public identifier, not the key.
4. Have the custodian obtain the approved ciphertext independently and exercise access on a fresh isolated restore environment. Retain checksum, decrypt/restore outcome, migration/financial/object integrity and elapsed time. A same-machine local-key restore does not complete this step.
5. Verify no plaintext or key was left in shared locations, cloud folders, browser downloads, source control or application logs. Do not make automatic destructive cleanup decisions about the only identity copy.
6. Sign the private custody acceptance record: owner, operator, custodian, artifact identifier, time, scope and exceptions. Record only sanitized completion/exception evidence in repository documentation.

## Loss, departure or suspected exposure

Preserve all verified artifacts and approved identity copies. Escalate through the owner-approved incident process. Any recipient/key rotation must include a tested path to retain or re-encrypt still-required old backups. Do not delete an old key or claim rotation protects already disclosed ciphertext without a reviewed plan. No rotation, access grant or key distribution is performed by this document.
