# Security Policy

## Supported Versions

Use this section to tell people about which versions of your project are
currently being supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 5.1.x   | :white_check_mark: |
| 5.0.x   | :x:                |
| 4.0.x   | :white_check_mark: |
| < 4.0   | :x:                |

## Reporting a Vulnerability

Use this section to tell people how to report a vulnerability.

Tell them where to go, how often they can expect to get an update on a
reported vulnerability, what to expect if the vulnerability is accepted or
declined, etc.

## Known unresolved dependency advisory

**Status: HIGH severity — UNRESOLVED**

The backend's Prisma CLI dependency `@prisma/config@6.19.3` declares
`deepmerge-ts@7.1.5`. GitHub advisory
[GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)
([CVE-2026-40345](https://nvd.nist.gov/vuln/detail/CVE-2026-40345)) affects
`deepmerge-ts` versions below `8.0.0`, which can exhaust the call stack when
merging matching cyclic object graphs.

Forcing `deepmerge-ts` 8.x is not approved: Prisma does not declare support for
that version, and the upstream 8.0.0 release documents breaking changes. The
current dependency choice is risk mitigation, not remediation. There is no
evidence establishing that the vulnerable path is unreachable in this project.
Do not describe this advisory as fixed or treat security audits as passing
while it remains unresolved.

Resolution requires either an official compatible Prisma config release that
declares a patched `deepmerge-ts` version, or a separately reviewed and
thoroughly tested compatibility plan. After an official fix, regenerate and
check the lockfile, run an online dependency audit, validate the Prisma schema,
generate the Prisma client, and run backend typecheck, lint, build, and tests.
