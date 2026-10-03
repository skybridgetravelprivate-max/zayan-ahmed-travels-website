import { acceptInquiry, validateInquiry } from "@/lib/inquiries";
import { createInquiryLead, CrmNotConfiguredError, CrmRequestError } from "@/server/crm-lead";

const crmLeadTypes = new Set(["contact", "group-booking", "corporate", "umrah", "visa", "tour", "transport"]);

const receivedMessage: Record<string, string> = {
  contact: "The contact inquiry could not be received. Try again later.",
  "group-booking": "The group inquiry could not be received. Try again later.",
  corporate: "The corporate inquiry could not be received. Try again later.",
  umrah: "The Umrah inquiry could not be received. Try again later.",
  visa: "The visa inquiry could not be received. Try again later.",
  tour: "The tour inquiry could not be received. Try again later.",
  transport: "The transport inquiry could not be received. Try again later.",
};

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
    return Response.json({ ok: false, error: "Send the inquiry as JSON." }, { status: 400 });
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
    await createInquiryLead(parsed.data);
  } catch (error) {
    if (error instanceof CrmNotConfiguredError) {
      return Response.json({ ok: false, error: "CRM lead creation is not configured." }, { status: 503 });
    }
    const received = receivedMessage[parsed.data.type] ?? "The inquiry could not be received. Try again later.";
    if (error instanceof CrmRequestError) {
      return Response.json({ ok: false, error: received }, { status: 502 });
    }
    return Response.json({ ok: false, error: received }, { status: 502 });
  }

  return Response.json({
    ok: true,
    message: successMessage[parsed.data.type] ?? "Your inquiry was received.",
  });
}
