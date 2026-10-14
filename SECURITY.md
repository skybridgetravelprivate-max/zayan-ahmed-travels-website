# Security Policy

## Supported Versions

The project has not yet defined a version-based security support policy.

## Reporting a Vulnerability

Do not report suspected vulnerabilities in a public issue. Use GitHub's private
vulnerability reporting for this repository when it is available. Otherwise,
contact the repository maintainers through a private channel. Response times
and supported release versions have not been formally defined.

## `deepmerge-ts` advisory

The backend lockfile resolves `deepmerge-ts` to `8.0.2`, above the affected
versions in GHSA-ggr8-5vv4-36mx / CVE-2026-40345. The root and backend npm
audits pass at the moderate threshold with that lockfile.

Prisma 6.19.3's `@prisma/config` dependency declares `deepmerge-ts@7.1.5`, so
the backend override is not an upstream-declared Prisma compatibility
combination and `npm ls deepmerge-ts` reports the overridden package as
invalid. The override has been exercised with a clean CI install, Prisma
validation and client generation, API build and typecheck, and backend tests.
Keep the override until Prisma officially declares a patched compatible
version, and repeat these checks when updating Prisma.
