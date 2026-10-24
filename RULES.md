# Zayan Ahmed Travels — Development Rules

## Environment
- TEST site: https://lightgreen-lemur-410319.hostingersite.com/
- Production: https://www.zayanahmedtravels.com/
- TEST and production are separate.
- Never modify production unless explicitly instructed.

## Git Safety
- Never reset, clean, revert, rebase, or force-push.
- Never use git add . when committing targeted changes.
- Commit only explicitly approved files.
- Never commit/push unless explicitly instructed.
- Check git status and git diff --check before commits.

## Development
- Make the smallest possible change.
- Reuse existing architecture/components/config.
- Do not create replacement projects.
- Do not rewrite working code.
- Do not upgrade dependencies unless explicitly requested.
- Do not change Next.js/React/Tailwind versions unless explicitly requested.
- Do not change MongoDB/PocketBase architecture unless explicitly requested.
- Do not invent company information, prices, hotels, testimonials, customer data, phone numbers, WhatsApp numbers, or social URLs.
- Use approved company information from existing configuration.

## Production Protection
- Never change DNS.
- Never modify production environment variables.
- Never modify production database/data.
- Never deploy production without explicit approval.
- TEST deployment only unless production deployment is explicitly requested.

## AI/Credit Efficiency
- Prefer read-only inspection before editing.
- One task at a time.
- Do not fix unrelated issues.
- Do not perform broad refactors.
- Do not repeat already-completed work.
- Keep prompts and implementation minimal.
- Stop after the requested task.

## Validation
After code changes, use only relevant checks:
- npm run lint
- npm run build when appropriate
- git diff --check

Report:
1. Files changed
2. What changed
3. Validation
4. Remaining issue

STOP when the requested task is complete.
