import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepareUmrahReference } from './prepare-umrah-reference.mjs';

const group = sector => ({ airline: 'Synthetic Air', summary: `${sector}\n22 Oct\nUG-100001\n14\nNights\nSA 101 22 Oct ISB-JED 10:00 - 12:00\n2\nSeats`, packages: [{ package: 'UP-100001\nMakkah: 8 Nights\nMadinah: 6 Nights\nTotal: 14 Nights', makkahHotel: 'Synthetic Makkah | 500 M', madinahHotel: 'Synthetic Madinah | 200 M', prices: 'PKR 100,000 PKR 110,000 PKR 120,000 PKR 130,000 Child Without Bed: PKR 80,000 Infant Price: PKR 20,000' }] });
const snapshot = groups => ({ source: 'https://example.invalid', capturedAt: '2026-10-19T00:00:00Z', groups });

test('only the exact ISB-JED sector is converted, preserving all four rates', () => {
  const result = prepareUmrahReference(snapshot([group('ISB-JED'), group('LHE-JED'), group('ISB-JEDDAH')]));
  assert.equal(result.sourceGroups, 1); assert.equal(result.sourcePackages, 1); assert.equal(result.packages.length, 4);
  assert.deepEqual(result.packages.map(p => p.adultPrice), [100000, 110000, 120000, 130000]);
  for (const row of result.packages) { assert.equal(row.isPublic, false); assert.equal(row.status, 'REVIEW_REQUIRED'); assert.equal(row.departureDate, null); assert.equal(row.childPrice, 80000); assert.equal(row.infantPrice, 20000); assert.equal(row.durationDays, 15); assert.match(row.description, /WITHOUT BED/); }
  assert.equal(result.hotels.length, 2);
});
test('preparation is deterministic and never overwrites or duplicates identifiers', () => {
  assert.deepEqual(prepareUmrahReference(snapshot([group('ISB-JED')])), prepareUmrahReference(snapshot([group('ISB-JED')])));
  assert.throws(() => prepareUmrahReference(snapshot([group('ISB-JED'), group('ISB-JED')])), /Duplicate/);
});
test('incomplete rates and inconsistent night totals fail instead of inventing values', () => {
  for (const mutate of [g => { g.packages[0].prices = 'PKR 100'; }, g => { g.packages[0].package = g.packages[0].package.replace('Total: 14', 'Total: 15'); }]) {
    const g = group('ISB-JED'); mutate(g); assert.throws(() => prepareUmrahReference(snapshot([g])));
  }
  assert.throws(() => prepareUmrahReference(snapshot([group('LHE-JED')])), /No ISB-JED/);
});
