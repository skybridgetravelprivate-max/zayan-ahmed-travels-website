-- READ ONLY; run only with approved production access. Outputs can identify accounts; keep private.
-- Pre-migration structural compatibility and existing status distributions; no record mutation.
SELECT table_name, column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN ('Agent','Session','User','Branch')
ORDER BY table_name, ordinal_position;
SELECT status, count(*) FROM "Agent" GROUP BY status;
SELECT count(*) AS existing_sessions FROM "Session";
-- Post-migration aggregate preflight, not an automatic repair:
-- SELECT count(*) FROM "AgencyMembership" m JOIN "UserRole" r ON r."userId"=m."userId";
-- SELECT count(*) FROM "AgencyMembership" m JOIN "Agent" a ON a.id=m."agentId" WHERE a."branchId" IS NULL;
-- SELECT "audience", count(*) FROM "Session" GROUP BY "audience";
-- Confirm proposed branch/user ownership manually from approved business evidence; never infer from names.
