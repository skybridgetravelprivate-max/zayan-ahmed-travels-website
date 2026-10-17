export const inquiryTypes = [
  "contact",
  "group-booking",
  "umrah",
  "visa",
  "tour",
  "transport",
  "corporate",
] as const;

export type InquiryType = (typeof inquiryTypes)[number];

export type InquiryInput = {
  type: InquiryType;
  name: string;
  email: string;
  phone: string;
  destination?: string;
  travelDate?: string;
  travellers?: number;
  subject?: string;
  company?: string;
  message: string;
};

export type InquirySuccess = {
  ok: true;
  demo: true;
  message: string;
};

export type InquiryFailure = {
  ok: false;
  error: string;
  fields?: Record<string, string>;
};

export type InquiryAdapter = {
  accept(input: InquiryInput): Promise<void>;
};

const demoAdapter: InquiryAdapter = {
  async accept() {
    return undefined;
  },
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[+()\d][\d\s().-]{5,39}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isInquiryType(value: string): value is InquiryType {
  return (inquiryTypes as readonly string[]).includes(value);
}

export function validateInquiry(body: unknown): { ok: true; data: InquiryInput } | InquiryFailure {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Send the inquiry as a JSON object." };
  }

  const record = body as Record<string, unknown>;
  const fields: Record<string, string> = {};
  const type = text(record.type);

  if (!type) fields.type = "Choose an inquiry type.";
  else if (!isInquiryType(type)) fields.type = "That inquiry type is not accepted.";

  const name = text(record.name);
  if (!name) fields.name = "Enter a name.";
  else if (name.length > 120) fields.name = "Use a name of 120 characters or fewer.";

  const email = text(record.email);
  if (!email) fields.email = "Enter an email address.";
  else if (email.length > 120 || !emailPattern.test(email)) fields.email = "Enter a valid email address.";

  const phone = text(record.phone);
  if (!phone) fields.phone = "Enter a phone number.";
  else if (!phonePattern.test(phone)) fields.phone = "Enter a valid phone number.";

  const message = text(record.message);
  if (!message) fields.message = "Enter a message.";
  else if (message.length > 4000) fields.message = "Use a message of 4000 characters or fewer.";

  let company: string | undefined;
  if (record.company !== undefined && record.company !== "") {
    company = text(record.company);
    if (!company) fields.company = "Enter a company name.";
    else if (company.length > 160) fields.company = "Use a company name of 160 characters or fewer.";
  }

  let subject: string | undefined;
  if (record.subject !== undefined && record.subject !== "") {
    subject = text(record.subject);
    if (!subject) fields.subject = "Enter a subject.";
    else if (subject.length > 200) fields.subject = "Use a subject of 200 characters or fewer.";
  }

  let destination: string | undefined;
  if (record.destination !== undefined && record.destination !== "") {
    destination = text(record.destination);
    if (!destination) fields.destination = "Enter a destination.";
    else if (destination.length > 160) fields.destination = "Use a destination of 160 characters or fewer.";
  }

  let travelDate: string | undefined;
  if (record.travelDate !== undefined && record.travelDate !== "") {
    travelDate = text(record.travelDate);
    const parsed = travelDate ? new Date(`${travelDate}T00:00:00Z`) : null;
    if (!travelDate || !datePattern.test(travelDate) || !parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== travelDate) {
      fields.travelDate = "Use a travel date in YYYY-MM-DD format.";
    }
  }

  let travellers: number | undefined;
  if (record.travellers !== undefined && record.travellers !== "") {
    const raw = typeof record.travellers === "number" ? record.travellers : Number(text(record.travellers));
    if (!Number.isInteger(raw) || raw < 1 || raw > 99) {
      fields.travellers = "Enter a traveller count from 1 to 99.";
    } else {
      travellers = raw;
    }
  }

  if (type === "group-booking" || type === "umrah" || type === "tour") {
    if (!destination && !fields.destination) {
      fields.destination =
        type === "umrah"
          ? "Enter a package or destination."
          : type === "tour"
            ? "Enter a destination or tour."
            : "Enter a destination.";
    }
    if (!travelDate && !fields.travelDate) fields.travelDate = "Enter a travel date.";
    if (!travellers && !fields.travellers) fields.travellers = "Enter a traveller count from 1 to 99.";
  }

  if (type === "visa") {
    if (!destination && !fields.destination) fields.destination = "Enter a visa country or type.";
    if (!travelDate && !fields.travelDate) fields.travelDate = "Enter a travel date.";
  }

  if (type === "transport") {
    if (!subject && !fields.subject) fields.subject = "Enter a transport or service type.";
    if (!destination && !fields.destination) fields.destination = "Enter destination or pickup details.";
    if (!travelDate && !fields.travelDate) fields.travelDate = "Enter a travel date.";
    if (!travellers && !fields.travellers) fields.travellers = "Enter a traveller count from 1 to 99.";
  }

  if (Object.keys(fields).length > 0) {
    return { ok: false, error: "Check the inquiry fields.", fields };
  }

  return {
    ok: true,
    data: {
      type: type as InquiryType,
      name,
      email,
      phone,
      ...(destination ? { destination } : {}),
      ...(travelDate ? { travelDate } : {}),
      ...(travellers ? { travellers } : {}),
      ...(subject ? { subject } : {}),
      ...(company ? { company } : {}),
      message,
    },
  };
}

/** Website boundary for a later CRM adapter. The demo adapter stores and sends nothing. */
export async function acceptInquiry(
  input: InquiryInput,
  adapter: InquiryAdapter = demoAdapter,
): Promise<InquirySuccess> {
  await adapter.accept(input);
  return {
    ok: true,
    demo: true,
    message: "Demo only. This inquiry was checked and was not saved or sent.",
  };
}
