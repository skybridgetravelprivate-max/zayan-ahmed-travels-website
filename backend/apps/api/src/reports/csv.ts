import { Prisma } from "@prisma/client";

/** RFC 4180 quoting; neutralise spreadsheet formulas in untrusted text cells. */
export function reportCsv(rows: Record<string, unknown>[], keys = [...new Set(rows.flatMap(row => Object.keys(row)))]) {
  const cell = (value: unknown) => {
    let text = "";
    if (value instanceof Date) {
      text = Number.isFinite(value.getTime()) ? value.toISOString() : "";
    } else if (Prisma.Decimal.isDecimal(value)) {
      text = value.toFixed();
    } else if (value != null) {
      text = typeof value === "object" ? JSON.stringify(value) : String(value);
    }
    if (typeof value === "string" && /^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return [keys.map(cell).join(","), ...rows.map(row => keys.map(key => cell(row[key])).join(","))].join("\r\n");
}
