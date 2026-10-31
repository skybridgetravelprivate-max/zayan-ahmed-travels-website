export type ManagementField = {
  name: string;
  label: string;
  type: string;
  required: boolean;
  nullable: boolean;
  options?: string[];
  optionLabels?: Record<string, string>;
  reference?: string;
  min?: number;
};
export type ManagementModule = {
  key: string;
  title: string;
  group: string;
  fields: ManagementField[];
  writeFields: ManagementField[];
  canCreate: boolean;
  canEdit: boolean;
};
export type RecordPresentation = {
  timeZone: string;
  references: Record<
    string,
    { id?: string; label: string; resource?: string; link: boolean }
  >;
};
export type ManagementRow = {
  id: string;
  version: string | null;
  presentation?: RecordPresentation;
} & Record<string, unknown>;
export function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return typeof value === "string" || typeof value === "number" ? String(value) : "—";
}
export function rowLabel(row: ManagementRow) {
  return ["fullName", "name", "subject", "title", "receiptNo", "paymentNo", "bookingNumber", "leadNumber", "customerNumber", "ticketNumber", "entryNumber", "code", "id"].map(k => row[k]).find(v => typeof v === "string" && v) as string || row.id;
}
export function formPayload(fields: ManagementField[], form: FormData, create: boolean) {
  const data: Record<string, unknown> = {};
  for (const field of fields) {
    const value = form.get(field.name);
    if (typeof value !== "string") continue;
    if (create && !value && !field.required) continue;
    data[field.name] = field.type === "Boolean" ? value === "true" : value || (field.nullable ? null : "");
  }
  return data;
}
export function staffConflictMessage(body: unknown): string {
  if (body && typeof body === "object" && !Array.isArray(body) && (body as Record<string, unknown>).code === "UMRAH_CANCELLATION_REVIEW_REQUIRED") {
    return "Cancellation requires accounting review. No credit or payout has been recorded.";
  }
  return "The record changed or conflicts with an existing record. Reload and review before saving.";
}

export function humanLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (char) => char.toUpperCase());
}
export function recordSection(field: ManagementField) {
  if (/assigned|branchId|agentId/.test(field.name)) return "Ownership";
  if (
    /fullName|fatherName|mobile|phone|whatsapp|email|address|city|country|nationality|emergency|gender|dateOfBirth/.test(
      field.name,
    )
  )
    return "Contact & identity";
  if (
    /price|cost|net|budget|fare|tax|discount|paid|balance|amount|profit|commission|currency/i.test(
      field.name,
    )
  )
    return "Commercial details";
  if (/notes|terms|description|reason/i.test(field.name))
    return "Notes & instructions";
  if (
    /date|departure|return|adults|children|infants|hotel|room|occupancy|travel|checkIn|checkOut/i.test(
      field.name,
    )
  )
    return "Travel & service";
  return "Record details";
}
export function formatRecordValue(field: ManagementField, row: ManagementRow) {
  const value = row[field.name];
  if (field.reference && value)
    return row.presentation?.references[field.name]?.label || "Linked record";
  if (value == null || value === "") return "—";
  if (field.type === "DateTime" && typeof value === "string") {
    const date = new Date(value);
    if (Number.isNaN(+date)) return "Unavailable";
    return new Intl.DateTimeFormat("en-PK", {
      timeZone: row.presentation?.timeZone || "Asia/Karachi",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }
  if (field.type === "Decimal" && /^-?\d+(\.\d+)?$/.test(String(value))) {
    const [integer, fraction = ""] = String(value).split(".");
    const formatted = new Intl.NumberFormat("en-PK").format(BigInt(integer));
    return `${integer.startsWith("-") && BigInt(integer) === BigInt(0) ? "-" : ""}${formatted}${fraction ? "." + fraction.padEnd(2, "0") : ".00"}`;
  }
  if (
    field.options ||
    ["status", "priority", "workflowStep"].includes(field.name)
  )
    return humanLabel(String(value));
  return displayValue(value);
}

/** Exact Decimal(18,2) form value; never pass through binary floating point. */
export function canonicalMoney(value: unknown): string {
  const text = String(value ?? "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error("Use an amount with at most two decimal places.");
  const [whole, fraction = ""] = text.split(".");
  const normalized = whole.replace(/^0+(?=\d)/, "");
  if (normalized.length > 16) throw new Error("Amount exceeds the supported range.");
  return `${normalized}.${fraction.padEnd(2, "0")}`;
}
