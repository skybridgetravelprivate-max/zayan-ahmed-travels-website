# Staff portal

Staff sign in: `/admin/login`. Protected workspace: `/admin`.
Customer sign in remains `/account`. Use existing staff credentials privately;
this change never creates an administrator or resets a password.

The server validates the access cookie against `/api/auth/me` before rendering
private content. Permissions come from the backend. Super-admins see four real
operational summary counts; other staff see their account workspace only when
they have dashboard permission. This is a minimal dashboard, not a complete CRM
management interface. No financial data or arbitrary record list is exposed.

Staff authentication now rejects missing, revoked, expired or mismatched sessions
on every protected request. Login/logout use the existing same-origin backend
and HttpOnly cookies; credentials and tokens are never stored in browser storage.
After access expiry, sign in again. Pages use private/no-store cache headers.

No migrations, credential changes, uploads, hosting changes or seeds are needed.
The production gateway already supplies the internal API address. Separate local
website/API processes need `CRM_API_URL` pointing to the local API.

Before rollout, sign in privately with an existing staff account, inspect the
dashboard, sign out and confirm a fresh visit returns to sign-in. No real staff
password was available during automated checks; live staff sign-in is unverified.
