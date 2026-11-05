/** RFC 4180 quoting; neutralise spreadsheet formulas in untrusted text cells. */
export function reportCsv(rows: Record<string, unknown>[], keys = [...new Set(rows.flatMap(row => Object.keys(row)))]) {
  const cell = (value: unknown) => {
    let text = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
    if (typeof value === "string" && /^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return [keys.map(cell).join(","), ...rows.map(row => keys.map(key => cell(row[key])).join(","))].join("\r\n");
}
