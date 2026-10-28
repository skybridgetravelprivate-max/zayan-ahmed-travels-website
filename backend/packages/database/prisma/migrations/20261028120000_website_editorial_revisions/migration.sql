BEGIN;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM "CmsPage" WHERE length(title)>180 OR btrim(title)='' OR length(body)>20000)
 THEN RAISE EXCEPTION 'Legacy CMS content needs review; no content has been truncated'; END IF;
END $$;
-- Additive editorial state. No financial tables or customer records changed.
ALTER TABLE "CmsPage" ADD COLUMN "draft" JSONB,
 ADD COLUMN "published" JSONB,
 ADD COLUMN "reviewState" TEXT NOT NULL DEFAULT 'DRAFT',
 ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "publishedVersion" INTEGER;
CREATE TABLE "CmsPageRevision" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "pageId" TEXT NOT NULL REFERENCES "CmsPage"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "version" INTEGER NOT NULL,
 "action" TEXT NOT NULL,
 "userId" TEXT NOT NULL,
 "content" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CmsPageRevision_pageId_version_key" ON "CmsPageRevision"("pageId", "version");
ALTER TABLE "CmsPage" ADD CONSTRAINT "CmsPage_reviewState_check" CHECK ("reviewState" IN ('DRAFT','REVIEW','PUBLISHED'));
ALTER TABLE "CmsPage" ADD CONSTRAINT "CmsPage_version_check" CHECK ("version" >= 0);
-- Preserve the exact existing published title/body as escaped plain-text content.
UPDATE "CmsPage" SET "draft" = jsonb_build_object(
 'schemaVersion',1,'category','page','title',"title",'summary','','body',"body",'eyebrow','',
 'image','','imageAlt','','actionLabel','','actionHref','','sections','[]'::jsonb);
UPDATE "CmsPage" SET "published"="draft", "publishedVersion"=0, "reviewState"='PUBLISHED' WHERE "status"='PUBLISHED';
INSERT INTO "CmsPageRevision" ("id","pageId","version","action","userId","content","createdAt")
 SELECT 'legacy_'||id,id,0,'IMPORT','schema-migration',draft,"updatedAt" FROM "CmsPage";
-- New relations are private to the application. Do not expose editorial drafts via Data API.
ALTER TABLE "CmsPageRevision" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "CmsPageRevision" FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON TABLE "CmsPageRevision" FROM anon; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON TABLE "CmsPageRevision" FROM authenticated; END IF;
END $$;
ALTER TABLE "CmsPage" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "CmsPage" FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON TABLE "CmsPage" FROM anon; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON TABLE "CmsPage" FROM authenticated; END IF;
END $$;

COMMIT;
