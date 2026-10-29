export type CrmQueueItem = { id: string; title: string; owner: string | null; at: string | null };
export type CrmQueue = {
  timeZone: string;
  groups: { key: string; label: string; resource: string; allowed: boolean; items: CrmQueueItem[] }[];
};
function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
export function parseCrmQueue(value: unknown): CrmQueue | null {
  const body = record(value), access = record(body?.access);
  if (!body || !access || typeof body.timeZone !== "string") return null;
  try { new Intl.DateTimeFormat("en", { timeZone: body.timeZone }); } catch { return null; }
  const definitions = [
    ["overdueFollowUps", "Overdue follow-ups", "follow-ups", "followUps", "subject", "dueAt"],
    ["todayFollowUps", "Today's follow-ups", "follow-ups", "followUps", "subject", "dueAt"],
    ["tasksDue", "Tasks due", "tasks", "tasks", "title", "dueDate"],
    ["newLeads", "New inquiries today", "leads", null, "fullName", "createdAt"],
    ["openQuotes", "Open quotations", "quotations", "quotations", "quotationNumber", "expiresAt"],
    ["expiringQuotes", "Quotations expiring or overdue", "quotations", "quotations", "quotationNumber", "expiresAt"],
  ] as const;
  const groups: CrmQueue["groups"] = [];
  for (const [key, label, resource, permission, titleField, dateField] of definitions) {
    if (permission && typeof access[permission] !== "boolean") return null;
    const allowed = !permission || access[permission] === true;
    const rows = body[key];
    if (!Array.isArray(rows) || rows.length > 30) return null;
    const items: CrmQueueItem[] = [];
    if (allowed) for (const value of rows) {
      const row = record(value), title = row?.[titleField], at = row?.[dateField];
      if (!row || typeof row.id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(row.id) || typeof title !== "string" || !title.trim() || title.length > 1000 || (at !== null && at !== undefined && (typeof at !== "string" || Number.isNaN(Date.parse(at))))) return null;
      const owner = record(row.lead)?.fullName ?? record(row.customer)?.fullName;
      if (owner !== undefined && owner !== null && typeof owner !== "string") return null;
      items.push({ id: row.id, title, owner: typeof owner === "string" ? owner : (resource === "leads" && row.branchId === null ? "Awaiting branch triage" : null), at: typeof at === "string" ? at : null });
    }
    groups.push({ key, label, resource, allowed, items });
  }
  return { timeZone: body.timeZone, groups };
}
