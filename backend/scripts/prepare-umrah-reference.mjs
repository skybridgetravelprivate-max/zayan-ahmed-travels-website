import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const ROOM_OPTIONS = ['SHARING', 'QUAD', 'TRIPLE', 'DOUBLE'];
const digest = value => createHash('sha256').update(value).digest('hex').slice(0, 16);
const required = (match, label) => { if (!match) throw new Error(`Missing or invalid ${label}`); return match; };

/** Pure, exact-sector conversion. Never infers a year, costs or inclusions. */
export function prepareUmrahReference(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.groups) || !snapshot.capturedAt || Number.isNaN(Date.parse(snapshot.capturedAt))) throw new Error('Invalid source snapshot');
  const hotels = new Map();
  const packages = [];
  const seen = new Set();
  const groups = snapshot.groups.filter(g => typeof g.summary === 'string' && g.summary.split('\n')[0].trim() === 'ISB-JED');
  for (const group of groups) {
    const sourceGroup = required(group.summary.match(/\bUG-\d+\b/), 'group code')[0];
    if (!Array.isArray(group.packages)) throw new Error('Invalid package list');
    for (const item of group.packages) {
      const sourcePackage = required(item.package?.match(/^UP-\d+\b/), 'package code')[0];
      if (seen.has(sourcePackage)) throw new Error('Duplicate source package');
      seen.add(sourcePackage);
      const makkahNights = Number(required(item.package.match(/Makkah:\s*(\d+)\s*Nights/), 'Makkah nights')[1]);
      const madinahNights = Number(required(item.package.match(/Madinah:\s*(\d+)\s*Nights/), 'Madinah nights')[1]);
      const total = Number(required(item.package.match(/Total:\s*(\d+)\s*Nights/), 'total nights')[1]);
      if (total < 1 || total > 60 || makkahNights + madinahNights !== total) throw new Error(`Night totals disagree for ${sourcePackage}`);
      const prices = [...required(typeof item.prices === 'string' && item.prices, 'prices').matchAll(/PKR\s*([\d,]+(?:\.\d{1,2})?)/g)].map(m => Number(m[1].replaceAll(',', '')));
      if (prices.length !== 6 || prices.some(n => !Number.isFinite(n) || n < 0 || n > 1e12) || prices.slice(0, 4).some(n => n <= 0)) throw new Error(`Incomplete rate table for ${sourcePackage}`);
      const hotelId = (text, city) => {
        if (typeof text !== 'string' || !text.trim()) throw new Error(`Missing ${city} hotel`);
        const [first, ...rest] = text.trim().split('\n');
        const [name, ...distance] = first.split('|');
        const key = digest(`${city}:${name.trim().toUpperCase()}`);
        const hotel = { id: `qfc_h_${key}`, hotelNumber: `QFC-HTL-${key}`, name: name.trim(), city, country: 'Saudi Arabia', distance: [...distance, ...rest].map(x => x.trim()).filter(Boolean).join('; ') || null, status: 'REVIEW_REQUIRED' };
        if (hotels.has(hotel.id) && hotels.get(hotel.id).distance !== hotel.distance) throw new Error(`Conflicting hotel distance for ${hotel.name}`);
        hotels.set(hotel.id, hotel);
        return hotel.id;
      };
      const makkahHotelId = hotelId(item.makkahHotel, 'Makkah');
      const madinahHotelId = hotelId(item.madinahHotel, 'Madinah');
      for (const [index, roomType] of ROOM_OPTIONS.entries()) packages.push({
        id: `qfc_${sourcePackage.toLowerCase().replace('-', '_')}_${roomType.toLowerCase()}`,
        packageNumber: `QFC-${sourcePackage}-${roomType}`, name: `${sourceGroup} · ${sourcePackage} · ${total} nights · ${roomType}`,
        packageType: 'STANDARD', durationDays: total + 1, departureCity: 'Islamabad', arrivalCity: 'Jeddah',
        departureDate: null, returnDate: null, flightInfo: `${group.airline || 'Airline not verified'}\n${group.summary}`,
        makkahHotelId, madinahHotelId, makkahNights, madinahNights, roomType,
        adultPrice: prices[index], childPrice: prices[4], infantPrice: prices[5],
        includesTransport: false, includesVisa: false, includesMeals: false, includesZiyarat: false,
        isPublic: false, status: 'REVIEW_REQUIRED',
        description: `Approved source: ${snapshot.source || 'QFC Umrah Groups'}\nCaptured: ${snapshot.capturedAt}\nSource group: ${sourceGroup}\nSource package: ${sourcePackage}\nSector: ISB-JED\nRoom rate is the full per-person package price in PKR. Child price is WITHOUT BED.\nSnapshot only: confirm dates/year, seats, prices, inclusions and supplier costs before sale. Dates are unset because the visible source did not specify a year. Costs and inclusion flags are unverified; zero/false defaults are not confirmed costs or exclusions. Not synchronized with the supplier.`,
      });
    }
  }
  if (!packages.length) throw new Error('No ISB-JED packages found');
  return { source: snapshot.source, capturedAt: snapshot.capturedAt, sector: 'ISB-JED', sourceGroups: groups.length, sourcePackages: seen.size, hotels: [...hotels.values()], packages };
}

async function main() {
  const args = process.argv.slice(2);
  const source = args[args.indexOf('--source') + 1];
  if (!args.includes('--source') || !source) throw new Error('Use --source <snapshot.json> [--out <new-file.json>]');
  const prepared = prepareUmrahReference(JSON.parse(await readFile(source, 'utf8')));
  if (args.includes('--out')) await writeFile(args[args.indexOf('--out') + 1], JSON.stringify(prepared, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ sector: prepared.sector, sourceGroups: prepared.sourceGroups, sourcePackages: prepared.sourcePackages, roomOptions: prepared.packages.length, hotels: prepared.hotels.length, databaseWrites: 0 }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
