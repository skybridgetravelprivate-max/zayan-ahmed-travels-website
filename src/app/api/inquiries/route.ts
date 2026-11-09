import { acceptInquiry, validateInquiry } from "@/lib/inquiries";
import { createInquiryLead, CrmNotConfiguredError } from "@/server/crm-lead";

const crmLeadTypes = new Set([
  "contact",
  "group-booking",
  "corporate",
  "umrah",
  "visa",
  "tour",
  "transport",
]);

const unconfirmedMessage =
  "Delivery of your inquiry was not confirmed. Check with our travel desk before resending.";

const successMessage: Record<string, string> = {
  contact: "Your message was received.",
  "group-booking": "Your group inquiry was received.",
  corporate: "Your corporate inquiry was received.",
  umrah: "Your Umrah inquiry was received.",
  visa: "Your visa inquiry was received.",
  tour: "Your tour inquiry was received.",
  transport: "Your transport inquiry was received.",
};

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Send the inquiry as JSON." },
      { status: 400 },
    );
  }

  const parsed = validateInquiry(body);
  if (!parsed.ok) {
    return Response.json(parsed, { status: 400 });
  }

  if (!crmLeadTypes.has(parsed.data.type)) {
    const result = await acceptInquiry(parsed.data);
    return Response.json(result);
  }

  try {
    const key = request.headers.get("idempotency-key");
    if (key !== null && !/^[A-Za-z0-9_-]{8,100}$/.test(key)) {
      return Response.json({ ok: false, error: "Invalid inquiry submission key." }, { status: 400 });
    }
    await createInquiryLead(parsed.data, key ?? undefined);
  } catch (error) {
    if (error instanceof CrmNotConfiguredError) {
      return Response.json(
        { ok: false, error: "CRM lead creation is not configured." },
        { status: 503 },
      );
    }
    return Response.json(
      { ok: false, error: unconfirmedMessage },
      { status: 502 },
    );
  }

  return Response.json({
    ok: true,
    message: successMessage[parsed.data.type] ?? "Your inquiry was received.",
  });
}
