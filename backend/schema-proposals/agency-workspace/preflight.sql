-- Read-only metadata preflight. Run through the actual application connection, keep results private.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';
SELECT current_setting('server_version') AS version,
       count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS completed_migrations,
       count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL) AS unfinished_migrations
FROM public."_prisma_migrations";
SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema = 'public' AND ((table_name = 'Session' AND column_name = 'audience')
 OR (table_name = 'Agent' AND column_name = 'branchId'));
SELECT to_regclass('public."AgencyMembership"') AS proposed_membership,
       to_regclass('public."AgencyRequest"') AS proposed_requests;
SELECT r.rolbypassrls, r.rolsuper, c.relowner = r.oid AS owns_existing_session_table
FROM pg_roles r JOIN pg_class c ON c.oid = 'public."Session"'::regclass
WHERE r.rolname = current_user;
ROLLBACK;
-- Expected proposal objects are absent before first application. Stop for any schema mismatch.
-- Separately verify which role will own new tables and how the actual application role accesses them.
