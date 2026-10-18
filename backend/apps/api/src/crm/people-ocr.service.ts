import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { AuditService } from "../common/audit.service";
import { AuthUser } from "../auth/auth.types";
import { assertRecordBranch, assertPassengerBranch, assertPeopleLinks, requirePermission } from "../auth/record-scope";
import { Gender } from "@prisma/client";

function mrzVal(ch: string) {
  if (ch >= "0" && ch <= "9") return ch.charCodeAt(0) - 48;
  if (ch >= "A" && ch <= "Z") return ch.charCodeAt(0) - 55;
  return 0;
}
function mrzCheck(s: string) {
  const w = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < s.length; i += 1) sum += mrzVal(s[i]) * w[i % 3];
  return String(sum % 10);
}
function mrzDate(yymmdd: string) {
  if (!/^\d{6}$/.test(yymmdd)) return "";
  const yy = Number(yymmdd.slice(0, 2));
  const year = yy > 30 ? 1900 + yy : 2000 + yy;
  return `${year}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}`;
}

export function parsePassportMrz(raw: string) {
  const up = String(raw || "").toUpperCase();
  const compact = up.replace(/[^A-Z0-9<]/g, "");
  const idx = compact.indexOf("P<");
  let l1 = "";
  let l2 = "";
  if (idx >= 0 && compact.length >= idx + 88) {
    l1 = compact.slice(idx, idx + 44);
    l2 = compact.slice(idx + 44, idx + 88);
  }
  l1 = l1.padEnd(44, "<").slice(0, 44);
  l2 = l2.padEnd(44, "<").slice(0, 44);
  if (!l1.startsWith("P")) {
    return { ok: false as const, error: "MRZ line 1 must start with P (passport)." };
  }
  const names = l1.slice(5).split("<<");
  const surname = (names[0] || "").replace(/</g, " ").replace(/\s+/g, " ").trim();
  const given = (names[1] || "").replace(/</g, " ").replace(/\s+/g, " ").trim();
  const passportNumber = l2.slice(0, 9).replace(/</g, "");
  const checks = {
    passport: mrzCheck(l2.slice(0, 9)) === l2[9],
    dob: mrzCheck(l2.slice(13, 19)) === l2[19],
    expiry: mrzCheck(l2.slice(21, 27)) === l2[27],
  };
  const confidence = [checks.passport, checks.dob, checks.expiry].filter(Boolean).length / 3;
  return {
    ok: true as const,
    confidence,
    checks,
    mrz: `${l1}\n${l2}`,
    surname,
    given_name: given,
    name: [given, surname].filter(Boolean).join(" "),
    passport_number: passportNumber,
    nationality: l2.slice(10, 13).replace(/</g, ""),
    date_of_birth: mrzDate(l2.slice(13, 19)),
    gender: l2[20] === "F" ? "FEMALE" : l2[20] === "M" ? "MALE" : "OTHER",
    passport_expiry: mrzDate(l2.slice(21, 27)),
  };
}

const EMPTY_KEYS = ["fullName", "fatherName", "gender", "dateOfBirth", "nationality", "cnic", "passportNumber", "passportCountry", "passportIssueDate", "passportExpiryDate", "mobile", "whatsapp", "email", "address", "emergencyContact"] as const;

function isEmpty(v: unknown) {
  return v === undefined || v === null || String(v).trim() === "";
}

@Injectable()
export class PeopleOcrService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  parse(rawText: string) {
    const parsed = parsePassportMrz(rawText);
    if (!parsed.ok) throw new BadRequestException(parsed.error);
    return parsed;
  }

  async storeDraft(user: AuthUser, body: { rawText: string; entityType: "customer" | "passenger"; entityId?: string }) {
    const parsed = this.parse(body.rawText);
    const row = await this.prisma.ocrExtract.create({
      data: {
        entityType: body.entityType,
        entityId: body.entityId,
        customerId: body.entityType === "customer" ? body.entityId : undefined,
        passengerId: body.entityType === "passenger" ? body.entityId : undefined,
        rawText: body.rawText,
        parsed: parsed as object,
        confidence: parsed.confidence,
      },
    });
    await this.audit.log({
      userId: user.id,
      action: "OCR_PARSE",
      entity: "ocrExtract",
      entityId: row.id,
      after: { confidence: parsed.confidence, passport: parsed.passport_number },
    });
    return { extractId: row.id, parsed };
  }

  async confirm(
    user: AuthUser,
    body: {
      extractId: string;
      customerId?: string;
      passengerId?: string;
      overwriteFields?: string[];
      userEdits?: Record<string, string>;
    },
  ) {
    if (Boolean(body.customerId) === Boolean(body.passengerId)) throw new BadRequestException("Select exactly one target");
    requirePermission(user, body.customerId ? "customer.edit" : "passenger.edit");
    const extract = await this.prisma.ocrExtract.findUnique({ where: { id: body.extractId } });
    if (!extract) throw new NotFoundException("OCR extract not found");
    await assertPeopleLinks(this.prisma, user, extract);
    const parsed = extract.parsed as {
      name?: string;
      passport_number?: string;
      nationality?: string;
      date_of_birth?: string;
      gender?: string;
      passport_expiry?: string;
    };
    const incoming: Record<string, unknown> = {
      fullName: body.userEdits?.fullName ?? parsed.name,
      passportNumber: body.userEdits?.passportNumber ?? parsed.passport_number,
      nationality: body.userEdits?.nationality ?? parsed.nationality,
      dateOfBirth: body.userEdits?.dateOfBirth ?? parsed.date_of_birth,
      gender: (body.userEdits?.gender ?? parsed.gender) as Gender | undefined,
      passportExpiryDate: body.userEdits?.passportExpiryDate ?? parsed.passport_expiry,
    };
    const allow = new Set(body.overwriteFields ?? []);
    let before: Record<string, unknown> | null = null;
    let after: Record<string, unknown> | null = null;

    if (body.passengerId) {
      const pax = await this.prisma.passenger.findUnique({ where: { id: body.passengerId } });
      if (!pax) throw new NotFoundException("Passenger not found");
      await assertPassengerBranch(this.prisma, user, pax.customerId);
      before = { ...pax };
      const data: Record<string, unknown> = {};
      const map: Record<string, keyof typeof pax> = {
        fullName: "fullName",
        passportNumber: "passportNumber",
        nationality: "nationality",
        dateOfBirth: "dateOfBirth",
        gender: "gender",
        passportExpiryDate: "passportExpiryDate",
      };
      for (const [k, col] of Object.entries(map)) {
        const inc = incoming[k];
        if (isEmpty(inc)) continue;
        const cur = pax[col];
        if (isEmpty(cur) || allow.has(k)) data[col] = ["dateOfBirth", "passportExpiryDate"].includes(k) ? new Date(String(inc)) : inc;
      }
      if (data.gender && !["MALE", "FEMALE", "OTHER"].includes(String(data.gender))) delete data.gender;
      const updated = await this.prisma.passenger.update({ where: { id: pax.id }, data: data as never });
      after = data;
      if (data.passportNumber && String(data.passportNumber) !== String(pax.passportNumber || "")) {
        await this.prisma.passportHistory.create({
          data: {
            passengerId: pax.id,
            passportNumber: String(data.passportNumber),
            expiryDate: incoming.passportExpiryDate ? new Date(String(incoming.passportExpiryDate)) : undefined,
          },
        });
      }
      await this.prisma.ocrExtract.update({
        where: { id: extract.id },
        data: {
          confirmedAt: new Date(),
          confirmedById: user.id,
          passengerId: pax.id,
          userEdits: body.userEdits as object,
        },
      });
      await this.audit.log({ userId: user.id, action: "OCR_CONFIRM", entity: "passenger", entityId: pax.id, before, after });
      return updated;
    }

    if (body.customerId) {
      const c = await this.prisma.customer.findUnique({ where: { id: body.customerId } });
      if (!c) throw new NotFoundException("Customer not found");
      await assertRecordBranch(this.prisma, user, "customer", c.id);
      before = { ...c };
      const data: Record<string, unknown> = {};
      if (!isEmpty(incoming.fullName) && (isEmpty(c.fullName) || allow.has("fullName"))) data.fullName = incoming.fullName;
      if (!isEmpty(incoming.passportNumber) && (isEmpty(c.passportNumber) || allow.has("passportNumber"))) data.passportNumber = incoming.passportNumber;
      if (!isEmpty(incoming.nationality) && (isEmpty(c.nationality) || allow.has("nationality"))) data.nationality = incoming.nationality;
      if (!isEmpty(incoming.dateOfBirth) && (isEmpty(c.dateOfBirth) || allow.has("dateOfBirth"))) data.dateOfBirth = new Date(String(incoming.dateOfBirth));
      if (!isEmpty(incoming.passportExpiryDate) && (isEmpty(c.passportExpiry) || allow.has("passportExpiryDate"))) data.passportExpiry = new Date(String(incoming.passportExpiryDate));
      const updated = await this.prisma.customer.update({ where: { id: c.id }, data: data as never });
      after = data;
      await this.prisma.ocrExtract.update({
        where: { id: extract.id },
        data: { confirmedAt: new Date(), confirmedById: user.id, customerId: c.id, userEdits: body.userEdits as object },
      });
      await this.audit.log({ userId: user.id, action: "OCR_CONFIRM", entity: "customer", entityId: c.id, before, after });
      return updated;
    }

    throw new BadRequestException("customerId or passengerId required to confirm");
  }
}

void EMPTY_KEYS;
