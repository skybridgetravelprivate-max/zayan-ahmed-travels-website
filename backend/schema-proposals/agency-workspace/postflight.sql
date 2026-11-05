-- Read-only postflight after separately approved migration. Aggregate outputs only.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';
SELECT audience, count(*) FROM public."Session" GROUP BY audience;
SELECT c.relname, c.relrowsecurity, c.relowner = (SELECT oid FROM pg_roles WHERE rolname=current_user) AS owned_by_current_role
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('AgencyMembership','AgencyRequest');
SELECT r.rolname, has_table_privilege(r.oid, 'public."AgencyMembership"', 'SELECT') AS membership_select,
       has_table_privilege(r.oid, 'public."AgencyRequest"', 'SELECT') AS request_select
FROM pg_roles r WHERE r.rolname IN ('anon','authenticated');
SELECT count(*) AS invalid_active_mappings
FROM public."AgencyMembership" m JOIN public."Agent" a ON a.id=m."agentId"
JOIN public."User" u ON u.id=m."userId"
WHERE m.active AND (a."branchId" IS NULL OR a.status<>'ACTIVE' OR u.status<>'ACTIVE' OR u."deletedAt" IS NOT NULL
 OR EXISTS (SELECT 1 FROM public."UserRole" ur WHERE ur."userId"=u.id));
SELECT count(*) AS unvalidated_new_constraints FROM pg_constraint c
WHERE c.conrelid IN ('public."AgencyMembership"'::regclass, 'public."AgencyRequest"'::regclass) AND NOT c.convalidated;
ROLLBACK;
-- A zero membership count before approved provisioning is expected. Agent feature activation is separate.
