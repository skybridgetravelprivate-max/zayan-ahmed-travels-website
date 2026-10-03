export type InquiryFieldErrors = Record<string, string>;

export type InquiryNotice = {
  tone: "success" | "error";
  message: string;
  fields: InquiryFieldErrors;
};

const fallbackError = "The inquiry could not be sent. Try again later.";

function fieldErrors(value: unknown): InquiryFieldErrors {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const fields: InquiryFieldErrors = {};
  for (const [key, message] of Object.entries(value)) {
    if (typeof message === "string" && message.trim()) fields[key] = message.trim();
  }
  return fields;
}

/** Reads the inquiry response. Success is only the server's own received message. */
export async function readInquiryNotice(response: Response): Promise<InquiryNotice> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { tone: "error", message: fallbackError, fields: {} };
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { tone: "error", message: fallbackError, fields: {} };
  }

  const record = payload as Record<string, unknown>;
  const message = typeof record.message === "string" ? record.message.trim() : "";
  if (response.ok && record.ok === true && message) {
    return { tone: "success", message, fields: {} };
  }

  const error = typeof record.error === "string" ? record.error.trim() : "";
  return {
    tone: "error",
    message: error || fallbackError,
    fields: fieldErrors(record.fields),
  };
}
