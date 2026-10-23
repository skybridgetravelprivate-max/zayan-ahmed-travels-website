# Focused production presentation audit

Base: `a30e9d713059e08a7227606f364ec137a2b7e0e2` (2026-10-19).
Existing staged/unstaged changes are preserved; publish only this audit's files.

## Confirmed fixes

- Fictional flight, ticket, hotel, offer, tour and visa lists and detail URLs were
  publicly rendered and indexed. Entry pages now explain real inquiry services;
  fictional detail URLs return not-found and are removed from the sitemap.
- Umrah detail pages fell back to fictional packages when no published records
  were returned. They now require a matching record from the published-only API.
  Private supplier drafts remain private; nothing was activated or imported.
- The signed-out account showed a fabricated profile; disconnected panels and
  support answers incorrectly described functioning authentication as a demo.
  Replaced with real sign-in/registration, booking and contact navigation.
- Original local vector illustration replaces placeholder artwork on the new
  service pages and published Umrah details. No remote asset/dependency added.
- Service pages use the existing validated inquiry API rather than local-only
  success buttons. Inquiry submission does not claim a reservation or payment.

## Traced boundaries and verification limits

Reviewed inquiry form → validation → server-token CRM lead creation, customer
session → server-derived CRM customer ID → booking DTO projection, and existing
management JWT/origin/field allowlist/branch checks. No new backend defect was
confirmed in these targeted paths; no speculative backend rewrite was made.
Existing regressions cover these paths with fixtures/mocks. This is not a live
database/concurrency test or an exhaustive review of every business operation.

Legal/privacy/refund/cancellation/payment pages need business-approved wording
and terms. Their notices that final policies are unavailable remain explicit;
this audit does not invent binding terms, fees, refund rules or data practices.
Old unused demo fixtures/components remain in source, but the targeted production
routes no longer render them. They are not relabelled as genuine inventory.

WhatsApp +923121558860, upload-disable protections, private configuration and TLS
are unchanged. No migration, data operation, real inquiry/booking or deployment.
The PR is for review; merge and deployment require a later instruction.
