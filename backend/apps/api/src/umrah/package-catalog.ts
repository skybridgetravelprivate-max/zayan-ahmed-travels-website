import { ForbiddenException, BadRequestException } from "@nestjs/common";
import { Prisma, UmrahPackage } from "@prisma/client";
import { AuthUser, can } from "../auth/auth.types";

type Hotel = { name: string; distance: string | null } | null;
type CatalogRow = Pick<UmrahPackage, "id" | "packageNumber" | "flightInfo" | "departureCity" | "arrivalCity" | "departureDate" | "makkahNights" | "madinahNights" | "roomType" | "adultPrice" | "childPrice" | "infantPrice" | "status" | "isPublic" | "description"> & { makkahHotel: Hotel; madinahHotel: Hotel };
type Rate = { id: string; roomType: string; price: string; childPrice: string; infantPrice: string; status: string; isPublic: boolean };
type Offer = { code: string; nights: number; makkahNights: number; madinahNights: number; makkahHotel: Hotel; madinahHotel: Hotel; rates: Rate[] };
type Group = { id: string; sector: string; airline: string; travelLabel: string; flights: string[]; sourceSeats: number | null; capturedAt: string | null; offers: Offer[] };

export function packageCatalog(user: AuthUser, rows: CatalogRow[]) {
  if (!can(user, "umrah.view")) throw new ForbiddenException();
  const groups = new Map<string, Group>();
  for (const row of rows) {
    const imported = /^QFC-(UP-\d+)-(SHARING|QUAD|TRIPLE|DOUBLE)$/.exec(row.packageNumber);
    const lines = (row.flightInfo || "").split("\n");
    const groupCode = imported ? row.flightInfo?.match(/\bUG-\d+\b/)?.[0] : null;
    const key = groupCode || row.id;
    if (!groups.has(key)) {
      const sectorIndex = lines.indexOf("ISB-JED");
      const seats = row.flightInfo?.match(/\n(\d+)\nSeats\b/);
      groups.set(key, { id: key, sector: imported ? "ISB-JED" : `${row.departureCity} – ${row.arrivalCity}`, airline: imported ? lines[0] : "", travelLabel: imported && sectorIndex >= 0 ? lines[sectorIndex + 1] : row.departureDate?.toISOString().slice(0, 10) || "Date not confirmed", flights: imported ? lines.filter(l => /^[A-Z0-9]{2}\s+\d+\s/.test(l)) : lines.filter(Boolean), sourceSeats: imported && seats ? Number(seats[1]) : null, capturedAt: imported ? row.description?.match(/^Captured: (.+)$/m)?.[1] || null : null, offers: [] });
    }
    const group = groups.get(key)!;
    const code = imported?.[1] || row.packageNumber;
    let offer = group.offers.find(p => p.code === code);
    if (!offer) {
      offer = { code, nights: row.makkahNights + row.madinahNights, makkahNights: row.makkahNights, madinahNights: row.madinahNights, makkahHotel: row.makkahHotel, madinahHotel: row.madinahHotel, rates: [] };
      group.offers.push(offer);
    }
    offer.rates.push({ id: row.id, roomType: row.roomType || "Not specified", price: String(row.adultPrice), childPrice: String(row.childPrice), infantPrice: String(row.infantPrice), status: row.status, isPublic: row.isPublic });
  }
  return { groups: [...groups.values()], canEdit: can(user, "umrah.edit"), canCreate: can(user, "umrah.create") };
}

export async function assertBookablePackage(db: Pick<Prisma.TransactionClient, "umrahPackage">, packageId: unknown) {
  if (!packageId) return;
  if (typeof packageId !== "string") throw new BadRequestException("Invalid package");
  const row = await db.umrahPackage.findUnique({ where: { id: packageId }, select: { status: true } });
  if (!row || row.status !== "ACTIVE") throw new BadRequestException("Review and activate the package before using it in a booking");
}
