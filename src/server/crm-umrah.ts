import { connection } from "next/server";
import type { PublicUmrahPackage } from "@/lib/public-umrah";
import { crmPublicOrigin } from "@/server/crm-public";

function textField(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function dateField(value: unknown) {
  const text = textField(value, 40);
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  return match?.[1] ?? text;
}

function nightCount(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 60) return null;
  return value;
}

function flag(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function readPackage(row: unknown): PublicUmrahPackage | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const record = row as Record<string, unknown>;
  const id = textField(record.id, 80);
  const name = textField(record.name, 160);
  if (!id || !name) return null;

  return {
    id,
    name,
    packageType: textField(record.packageType, 80),
    durationDays: nightCount(record.durationDays),
    departureCity: textField(record.departureCity, 80),
    arrivalCity: textField(record.arrivalCity, 80),
    departureDate: dateField(record.departureDate),
    returnDate: dateField(record.returnDate),
    flightInfo: textField(record.flightInfo, 200),
    makkahNights: nightCount(record.makkahNights),
    madinahNights: nightCount(record.madinahNights),
    roomType: textField(record.roomType, 80),
    includesTransport: flag(record.includesTransport),
    includesVisa: flag(record.includesVisa),
    includesMeals: flag(record.includesMeals),
    includesZiyarat: flag(record.includesZiyarat),
    description: textField(record.description, 400),
  };
}

function readPackages(body: unknown) {
  if (!Array.isArray(body)) return [];
  return body.flatMap((row) => {
    const item = readPackage(row);
    return item ? [item] : [];
  });
}

/** Reads published active Umrah packages. Price fields are not kept. */
export async function getPublicUmrahPackages(): Promise<PublicUmrahPackage[]> {
  await connection();
  const origin = crmPublicOrigin();
  if (!origin) return [];

  try {
    const response = await fetch(`${origin}/api/public/umrah-packages`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return [];
    return readPackages(await response.json());
  } catch {
    return [];
  }
}
