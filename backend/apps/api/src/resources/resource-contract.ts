import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { RESOURCES, actionPermission } from "./registry";
import { AuthUser, can } from "../auth/auth.types";

export type ManagementField = {
  name: string;
  label: string;
  type: string;
  required: boolean;
  nullable: boolean;
  options?: string[];
  reference?: string;
};
type ModuleSpec = {
  title: string;
  group: string;
  fields: string;
  write?: string;
  superOnly?: boolean;
  create?: boolean;
};

// Explicit public projection and write contract. Prisma owns scalar types and enums;
// adding a database column never automatically exposes it through this console.
export const MANAGEMENT: Record<string, ModuleSpec> = {
  "passenger-documents": {
    title: "Passenger documents",
    group: "CRM",
    fields: "passengerId kind documentId status notes expiresAt",
    write: "passengerId kind documentId status notes expiresAt",
  },
  leads: {
    title: "Inquiries & leads",
    group: "CRM",
    fields:
      "leadNumber fullName mobile whatsapp email city country source priority status nextFollowUpAt assignedUserId assignedAgentId branchId adults children infants travelDate returnDate budget notes lostReason",
    write:
      "fullName mobile whatsapp email city country source priority branchId adults children infants travelDate returnDate budget notes",
  },
  customers: {
    title: "Customers",
    group: "CRM",
    fields:
      "customerNumber fullName fatherName gender dateOfBirth phone whatsapp email address nationality emergencyContact branchId agentId leadId",
    write:
      "fullName fatherName gender dateOfBirth phone whatsapp email address nationality emergencyContact branchId agentId leadId",
  },
  passengers: {
    title: "Passengers",
    group: "CRM",
    fields:
      "fullName fatherName customerId gender dateOfBirth mobile whatsapp email nationality passportNumber passportExpiryDate cnic address",
    write:
      "fullName fatherName customerId gender dateOfBirth mobile whatsapp email nationality passportNumber passportExpiryDate cnic address",
  },
  "follow-ups": {
    title: "Follow-ups",
    group: "CRM",
    fields:
      "subject type dueAt priority status notes leadId customerId assignedUserId",
    write:
      "subject type dueAt priority status notes leadId customerId assignedUserId",
  },
  tasks: {
    title: "Tasks",
    group: "CRM",
    fields:
      "title description priority dueDate status leadId customerId assignedUserId",
    write:
      "title description priority dueDate status leadId customerId assignedUserId",
  },
  quotations: {
    title: "Quotations",
    group: "CRM",
    fields:
      "quotationNumber leadId customerId branchId status currency sellingTotal costTotal discount tax net terms notes expiresAt",
    write: "terms notes expiresAt",
    create: false,
  },
  complaints: {
    title: "Complaints",
    group: "CRM",
    fields:
      "complaintNumber subject description module category status priority customerId passengerId branchId assignedUserId resolution",
    write:
      "subject description module category priority customerId passengerId branchId",
  },
  "umrah-packages": {
    title: "Umrah packages",
    group: "Travel",
    fields:
      "packageNumber name description packageType durationDays departureCity arrivalCity departureDate returnDate flightInfo makkahHotelId makkahNights madinahHotelId madinahNights roomType includesTransport includesVisa includesMeals includesZiyarat adultPrice adultCost childPrice childCost infantPrice infantCost isPublic status",
    write:
      "name description packageType durationDays departureCity arrivalCity departureDate returnDate flightInfo makkahHotelId makkahNights madinahHotelId madinahNights roomType includesTransport includesVisa includesMeals includesZiyarat adultPrice adultCost childPrice childCost infantPrice infantCost isPublic status",
  },
  "umrah-bookings": {
    title: "Umrah bookings",
    group: "Travel",
    fields:
      "bookingNumber customerId packageId groupId branchId departureDate returnDate status workflowStep cost sellingPrice discount tax net paid balance profit notes",
  },
  "umrah-groups": {
    title: "Umrah groups",
    group: "Travel",
    fields:
      "groupNumber name packageId departureDate returnDate totalSeats reservedSeats branchId status",
    write: "name packageId departureDate returnDate totalSeats branchId status",
  },
  "umrah-visas": {
    title: "Umrah visas",
    group: "Travel",
    fields:
      "visaNumber applicationNumber passportNumber passengerId bookingId status submittedAt approvedAt expiresAt notes",
    write:
      "visaNumber applicationNumber passportNumber passengerId bookingId status submittedAt approvedAt expiresAt notes",
    superOnly: true,
  },
  ziyarat: {
    title: "Ziyarat",
    group: "Travel",
    fields: "name city description durationHours cost sellingPrice status",
    write: "name city description durationHours cost sellingPrice status",
  },
  intimations: {
    title: "Intimations",
    group: "Travel",
    fields:
      "type location groupId passengerId bookingId occurredAt remarks status",
    write:
      "type location groupId passengerId bookingId occurredAt remarks status",
    superOnly: true,
  },
  hotels: {
    title: "Hotels",
    group: "Hotels",
    fields: "hotelNumber name city country address contact category status",
    write: "name city country address contact category status",
  },
  "hotel-rooms": {
    title: "Hotel room types",
    group: "Hotels",
    fields: "hotelId name occupancy totalInventory costRate sellingRate",
    write: "hotelId name occupancy totalInventory costRate sellingRate",
  },
  "hotel-inventory": {
    title: "Hotel inventory",
    group: "Hotels",
    fields: "roomTypeId date total booked blocked kind status",
    superOnly: true,
  },
  "hotel-physical-rooms": {
    title: "Physical rooms",
    group: "Hotels",
    fields: "hotelId roomTypeId roomNumber floor status",
    write: "hotelId roomTypeId roomNumber floor status",
  },
  "hotel-bookings": {
    title: "Hotel reservations",
    group: "Hotels",
    fields:
      "bookingNumber customerId passengerId hotelId roomTypeId branchId checkIn checkOut nights rooms status cost sellingPrice discount tax net paid balance notes specialRequests cancelReason",
  },
  "star-bookings": {
    title: "Star bookings",
    group: "Hotels",
    fields:
      "bookingNumber groupName groupCode confirmationNo customerId supplierId branchId status cost sellingPrice paid profit",
  },
  "hotel-vouchers": {
    title: "Hotel vouchers",
    group: "Hotels",
    fields: "voucherNo bookingId issuedAt notes",
    superOnly: true,
  },
  tickets: {
    title: "Tickets",
    group: "Flights",
    fields:
      "ticketNumber customerId passengerId airlineId pnrId flightNumber sector departureAt arrivalAt cabin baggage currency fare tax cost discount net profit paidAmount branchId status",
  },
  "ticket-refunds": {
    title: "Ticket refunds",
    group: "Flights",
    fields:
      "ticketId refundAmount airlineDeduction agencyDeduction otherCharges netRefund reason refundedAt",
  },
  "ticket-reissues": {
    title: "Ticket reissues",
    group: "Flights",
    fields:
      "originalTicketId newTicketId fareDifference airlineChangeFee agencyFee totalAdditional reason reissuedAt",
  },
  "ticket-groups": {
    title: "Ticket groups",
    group: "Flights",
    fields:
      "groupNumber sector airlineId departureDate totalSeats reservedSeats status",
    write: "sector airlineId departureDate totalSeats status",
  },
  pnr: {
    title: "PNR records",
    group: "Flights",
    fields: "pnr airlineId passengerCount status",
    write: "pnr airlineId passengerCount status",
  },
  airlines: {
    title: "Airlines",
    group: "Flights",
    fields: "name code status",
    write: "name code status",
  },
  airports: {
    title: "Airports",
    group: "Flights",
    fields: "iata icao name cityId countryId status",
    write: "iata icao name cityId countryId status",
  },
  vehicles: {
    title: "Vehicles",
    group: "Transport",
    fields: "plateNumber type capacity supplierId status",
    write: "plateNumber type capacity supplierId status",
  },
  drivers: {
    title: "Drivers",
    group: "Transport",
    fields: "fullName phone licenseNo status",
    write: "fullName phone licenseNo status",
  },
  "transport-bookings": {
    title: "Transport bookings",
    group: "Transport",
    fields:
      "bookingNumber customerId passengerId vehicleId driverId branchId pickup dropoff route tripDate tripTime paxCount status cost sellingPrice net paid",
  },
  "transport-vouchers": {
    title: "Transport vouchers",
    group: "Transport",
    fields: "voucherNo bookingId issuedAt",
    superOnly: true,
  },
  "visa-applications": {
    title: "Visa applications",
    group: "Travel",
    fields:
      "applicationNo visaNumber customerId passengerId category country visaTypeId branchId status submittedAt notes",
    write:
      "visaNumber customerId passengerId category country visaTypeId branchId status submittedAt notes",
  },
  agents: {
    title: "Agents",
    group: "Partners",
    fields: "name company phone email parentId status",
    write: "name company phone email parentId status",
  },
  suppliers: {
    title: "Suppliers",
    group: "Partners",
    fields:
      "name company kind contact email address currency paymentTerms status",
    write:
      "name company kind contact email address currency paymentTerms status",
  },
  "agent-commissions": {
    title: "Agent commissions",
    group: "Finance",
    fields: "agentId sourceType sourceId amount status createdAt",
    superOnly: true,
  },
  "chart-of-accounts": {
    title: "Chart of accounts",
    group: "Finance",
    fields: "code name type parentId isPosting currency status",
    superOnly: true,
  },
  journals: {
    title: "Journals",
    group: "Finance",
    fields: "entryNumber date memo kind module sourceId branchId status",
    superOnly: true,
  },
  payments: {
    title: "Payments",
    group: "Finance",
    fields: "paymentNo supplierId date amount method branchId notes journalId",
    superOnly: true,
  },
  receipts: {
    title: "Receipts",
    group: "Finance",
    fields:
      "receiptNo customerId bookingId date amount method branchId notes journalId",
    superOnly: true,
  },
  expenses: {
    title: "Expenses",
    group: "Finance",
    fields:
      "expenseNo category amount date supplierId branchId notes journalId",
    superOnly: true,
  },
  "bank-accounts": {
    title: "Bank accounts",
    group: "Finance",
    fields: "name accountNumber iban currency status",
    write: "name accountNumber iban currency status",
    superOnly: true,
  },
  "cash-accounts": {
    title: "Cash accounts",
    group: "Finance",
    fields: "name currency status",
    write: "name currency status",
    superOnly: true,
  },
  employees: {
    title: "Employees",
    group: "Team",
    fields: "employeeNo fullName department designation joinDate status",
    write: "fullName department designation joinDate status",
    superOnly: true,
  },
  attendance: {
    title: "Attendance",
    group: "Team",
    fields: "employeeId date status checkIn checkOut",
    write: "employeeId date status checkIn checkOut",
    superOnly: true,
  },
  holidays: {
    title: "Holidays",
    group: "Team",
    fields: "name date",
    write: "name date",
    superOnly: true,
  },
  payroll: {
    title: "Payroll",
    group: "Team",
    fields: "period runDate status",
    superOnly: true,
  },
  "salary-slips": {
    title: "Salary slips",
    group: "Team",
    fields: "slipNo employeeId payrollId basic allowances deductions net paid",
    superOnly: true,
  },
  users: {
    title: "Staff accounts",
    group: "Administration",
    fields: "fullName username email phone status defaultBranchId",
    write: "fullName email phone",
    create: false,
    superOnly: true,
  },
  roles: {
    title: "Roles",
    group: "Administration",
    fields: "name description",
    superOnly: true,
  },
  branches: {
    title: "Branches",
    group: "Administration",
    fields: "code name address phone email status",
    write: "code name address phone email status",
    superOnly: true,
  },
  documents: {
    title: "Documents",
    group: "Administration",
    fields: "fileName mimeType sizeBytes entityType entityId createdAt",
    superOnly: true,
  },
  notifications: {
    title: "Notifications",
    group: "Administration",
    fields: "title body type readAt createdAt",
  },
  "audit-logs": {
    title: "Audit history",
    group: "Administration",
    fields: "action entity entityId userId ipAddress createdAt",
    superOnly: true,
  },
  "cms-pages": {
    title: "Website pages",
    group: "Website",
    fields: "slug title body status",
    superOnly: true,
  },
  currencies: {
    title: "Currencies",
    group: "Settings",
    fields: "code name symbol isBase",
    write: "code name symbol",
    superOnly: true,
  },
  "exchange-rates": {
    title: "Exchange rates",
    group: "Settings",
    fields: "currencyId rateToBase effectiveAt",
    write: "currencyId rateToBase effectiveAt",
    superOnly: true,
  },
  countries: {
    title: "Countries",
    group: "Settings",
    fields: "iso2 iso3 name nationality status",
    write: "iso2 iso3 name nationality status",
    superOnly: true,
  },
  cities: {
    title: "Cities",
    group: "Settings",
    fields: "name countryId",
    write: "name countryId",
    superOnly: true,
  },
  "visa-types": {
    title: "Visa types",
    group: "Settings",
    fields: "code name category countryId status",
    write: "code name category countryId status",
    superOnly: true,
  },
  services: {
    title: "Services",
    group: "Settings",
    fields: "code name category defaultCost defaultPrice status",
    write: "code name category defaultCost defaultPrice status",
    superOnly: true,
  },
  "payment-methods": {
    title: "Payment methods",
    group: "Settings",
    fields: "code name kind status",
    write: "code name kind status",
    superOnly: true,
  },
  "room-types": {
    title: "Room categories",
    group: "Settings",
    fields: "code name defaultOccupancy status",
    write: "code name defaultOccupancy status",
    superOnly: true,
  },
};

export function modelFor(resource: string) {
  const meta = RESOURCES[resource];
  return (
    meta &&
    Prisma.dmmf.datamodel.models.find(
      (m) => m.name.toLowerCase() === meta.model.toLowerCase(),
    )
  );
}
export function fieldsFor(
  resource: string,
  writable = false,
): ManagementField[] {
  const spec = MANAGEMENT[resource];
  const model = modelFor(resource);
  if (!spec || !model) return [];
  return (writable ? (spec.write ?? "") : spec.fields)
    .split(" ")
    .flatMap((name) => {
      const f = model.fields.find(
        (f) =>
          f.name === name &&
          !f.isList &&
          f.kind !== "object" &&
          f.type !== "Json",
      );
      if (!f) return [];
      const relation = model.fields.find((r) =>
        r.relationFromFields?.includes(name),
      );
      const reference =
        relation &&
        Object.keys(MANAGEMENT).find(
          (key) => modelFor(key)?.name === relation.type,
        );
      return [
        {
          name,
          label: name
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (c) => c.toUpperCase()),
          type: f.kind === "enum" ? "select" : f.type,
          required: f.isRequired && !f.hasDefaultValue,
          nullable: !f.isRequired,
          ...(f.kind === "enum"
            ? {
                options: Prisma.dmmf.datamodel.enums
                  .find((e) => e.name === f.type)
                  ?.values.map((v) => v.name),
              }
            : {}),
          ...(reference ? { reference } : {}),
        },
      ];
    });
}
export function allowedModule(user: AuthUser, resource: string) {
  return (
    Object.hasOwn(MANAGEMENT, resource) &&
    (!MANAGEMENT[resource].superOnly || user.isSuperAdmin) &&
    can(user, actionPermission(RESOURCES[resource], "view"))
  );
}
export function moduleContract(user: AuthUser, resource: string) {
  const spec = MANAGEMENT[resource];
  const fields = fieldsFor(resource);
  const writeFields = fieldsFor(resource, true);
  const model = modelFor(resource)!;
  const requiredMissing = model.fields.some(
    (f) =>
      f.kind !== "object" &&
      f.isRequired &&
      !f.hasDefaultValue &&
      !f.isUpdatedAt &&
      !f.isId &&
      !writeFields.some((w) => w.name === f.name) &&
      f.name !== RESOURCES[resource].number?.field &&
      f.name !== "branchId",
  );
  return {
    key: resource,
    title: spec.title,
    group: spec.group,
    fields,
    writeFields,
    canCreate:
      !!spec.write &&
      spec.create !== false &&
      !requiredMissing &&
      can(user, actionPermission(RESOURCES[resource], "create")),
    canEdit:
      !!spec.write && can(user, actionPermission(RESOURCES[resource], "edit")),
  };
}

export function parseFields(
  fields: ManagementField[],
  value: unknown,
  create: boolean,
) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new BadRequestException("Invalid form");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !fields.some((f) => f.name === key)))
    throw new BadRequestException("Unsupported field");
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    let v = input[f.name];
    if (f.type === "DateTime" && v instanceof Date) v = v.toISOString();
    if (v === undefined) {
      if (create && f.required)
        throw new BadRequestException(`${f.label} is required`);
      continue;
    }
    if (v === null || v === "") {
      if (!f.nullable) {
        if (create && !f.required) continue;
        throw new BadRequestException(`${f.label} is required`);
      }
      out[f.name] = null;
      continue;
    }
    if (f.type === "Boolean") {
      if (typeof v !== "boolean")
        throw new BadRequestException(`Invalid ${f.label}`);
    } else if (["Int", "Float", "Decimal"].includes(f.type)) {
      if (typeof v !== "string" && typeof v !== "number")
        throw new BadRequestException(`Invalid ${f.label}`);
      if (typeof v === "string" && !/^-?\d+(?:\.\d{1,6})?$/.test(v))
        throw new BadRequestException(`Invalid ${f.label}`);
      const n = Number(v);
      if (
        !Number.isFinite(n) ||
        n < 0 ||
        n > 1e12 ||
        (f.type === "Int" && !Number.isSafeInteger(n))
      )
        throw new BadRequestException(`Invalid ${f.label}`);
      v = f.type === "Decimal" ? String(v) : n;
    } else {
      if (typeof v !== "string")
        throw new BadRequestException(`Invalid ${f.label}`);
      const text = v.trim();
      if (
        !text ||
        text.length >
          (/[Nn]otes|description|body|terms|flightInfo/.test(f.name)
            ? 10000
            : 300) ||
        /\u0000/.test(text)
      )
        throw new BadRequestException(`Invalid ${f.label}`);
      if (f.options && !f.options.includes(text))
        throw new BadRequestException(`Invalid ${f.label}`);
      if (f.reference && !/^[A-Za-z0-9_-]{1,80}$/.test(text))
        throw new BadRequestException(`Invalid ${f.label}`);
      if (/email/i.test(f.name) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text))
        throw new BadRequestException("Invalid email");
      v = text;
      if (f.type === "DateTime") {
        if (
          !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(
            text,
          ) ||
          Number.isNaN(Date.parse(text))
        )
          throw new BadRequestException(`Invalid ${f.label}`);
        if (
          new Date(`${text.slice(0, 10)}T00:00:00Z`)
            .toISOString()
            .slice(0, 10) !== text.slice(0, 10)
        )
          throw new BadRequestException(`Invalid ${f.label}`);
        v = new Date(
          text.includes("T") && !/(Z|[+-]\d{2}:\d{2})$/.test(text)
            ? `${text}Z`
            : text,
        );
      }
    }
    out[f.name] = v;
  }
  return out;
}
