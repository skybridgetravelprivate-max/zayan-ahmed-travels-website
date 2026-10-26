export type ManagementField = { name: string; label: string; type: string; required: boolean; nullable: boolean; options?: string[]; optionLabels?: Record<string, string>; reference?: string; min?: number };
export type ManagementModule = { key: string; title: string; group: string; fields: ManagementField[]; writeFields: ManagementField[]; canCreate: boolean; canEdit: boolean };
export type ManagementRow = { id: string; version: string | null } & Record<string, unknown>;
export function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return typeof value === "string" || typeof value === "number" ? String(value) : "—";
}
export function rowLabel(row: ManagementRow) {
  return ["fullName", "name", "subject", "title", "receiptNo", "bookingNumber", "leadNumber", "customerNumber", "ticketNumber", "entryNumber", "code", "id"].map(k => row[k]).find(v => typeof v === "string" && v) as string || row.id;
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

