import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('public service entry points cannot import fictional inventories or local-only inquiry buttons', async () => {
  for (const service of ['flights', 'tickets', 'hotels', 'offers', 'tours', 'visa', 'transport', 'insurance', 'corporate']) {
    const page = await read(`src/app/${service}/page.tsx`);
    assert.doesNotMatch(page, /demo[A-Z]|getDemo|DemoStatusButton|PlaceholderArt/, service);
    assert.match(page, /ServiceLanding/, service);
  }
  assert.match(await read('src/components/layout/ServiceLanding.tsx'), /ServiceInquiryForm/);
});
test('fictional detail URLs are unavailable; Umrah retains only the published lookup', async () => {
  for (const service of ['flights', 'hotels', 'offers', 'tours', 'visa', 'transport']) {
    const page = await read(`src/app/${service}/[id]/page.tsx`);
    assert.match(page, /notFound\(\)/, service);
    assert.doesNotMatch(page, /demo[A-Z]|getDemo|generateStaticParams/, service);
  }
  const umrah = await read('src/app/umrah/[id]/page.tsx');
  assert.match(umrah, /getPublicUmrahPackages/);
  assert.doesNotMatch(umrah, /demoPackages|getDemoPackage|demoRows/);
});
test('sitemap and account do not expose fictional records', async () => {
  assert.doesNotMatch(await read('src/app/sitemap.ts'), /demo[A-Z]|detailPaths/);
  assert.doesNotMatch(await read('src/components/account/ProfileSummary.tsx'), /demoProfile/);
  assert.doesNotMatch(await read('src/components/account/AccountHome.tsx'), /accountPanels/);
});
