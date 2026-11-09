"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import {
  readInquiryNotice,
  type InquiryNotice,
} from "@/components/forms/inquiry-notice";
import type { InquiryType } from "@/lib/inquiries";
import type { PreparedInquiry } from "@/lib/travel-inquiry";
import { submitInquiry } from "./inquiry-submit";

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-white/30 bg-white px-3 py-2.5 text-sm text-foreground focus:border-zayan-orange focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-orange";

export function ServiceInquiryForm({
  type,
  submitLabel,
  context,
  details,
}: {
  type: InquiryType;
  submitLabel: string;
  context?: string;
  details?: PreparedInquiry;
}) {
  const baseId = useId();
  const pendingRef = useRef(false);
  const submission = useRef<Parameters<typeof submitInquiry>[0]["current"]>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<InquiryNotice | null>(null);
  const [confirmedContext, setConfirmedContext] = useState<string | null>(null);
  const contextKey = context ?? "";
  const received = confirmedContext === contextKey;
  const fieldErrors = notice?.tone === "error" ? notice.fields : {};

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current || received) return;
    pendingRef.current = true;
    setPending(true);
    setNotice(null);
    const data = new FormData(event.currentTarget);
    const company = data.get("company");
    try {
      const response = await submitInquiry(submission, JSON.stringify({
          type,
          name: data.get("name"),
          email: data.get("email"),
          phone: data.get("phone"),
          ...(type === "corporate" &&
          typeof company === "string" &&
          company.trim()
            ? { company }
            : {}),
          ...(type === "umrah"
            ? {
                destination: details?.destination ?? data.get("destination"),
                travelDate: details?.travelDate ?? data.get("travelDate"),
                travellers: details?.travellers ?? data.get("travellers"),
              }
            : {}),
          ...(type === "visa"
            ? {
                destination: details?.destination ?? data.get("destination"),
                travelDate: details?.travelDate ?? data.get("travelDate"),
              }
            : {}),
          ...(type === "tour"
            ? {
                destination: details?.destination ?? data.get("destination"),
                travelDate: details?.travelDate ?? data.get("travelDate"),
                travellers: details?.travellers ?? data.get("travellers"),
              }
            : {}),
          ...(type === "transport"
            ? {
                subject: data.get("subject"),
                destination: data.get("destination"),
                travelDate: data.get("travelDate"),
                travellers: data.get("travellers"),
              }
            : {}),
          message: context
            ? `${context}\n\n${data.get("message") || ""}`
            : data.get("message"),
        }));
      const result = await readInquiryNotice(response);
      setNotice(result);
      if (result.tone === "success") {
        submission.current = null;
        setConfirmedContext(contextKey);
      }
    } catch {
      setNotice({
        tone: "error",
        message:
          "Delivery was not confirmed. Your details are preserved. Check with the travel desk before resending.",
        fields: {},
      });
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <form
      className="grid w-full max-w-2xl gap-4 sm:grid-cols-2"
      autoComplete="off"
      aria-busy={pending}
      onSubmit={onSubmit}
    >
      <label htmlFor={`${baseId}-name`} className="block text-sm font-medium">
        Name
        <input
          id={`${baseId}-name`}
          name="name"
          required
          className={fieldClass}
          {...invalid(baseId, "name", fieldErrors)}
        />
        <FieldError id={`${baseId}-name-error`} message={fieldErrors.name} />
      </label>
      <label htmlFor={`${baseId}-email`} className="block text-sm font-medium">
        Email
        <input
          id={`${baseId}-email`}
          name="email"
          type="email"
          required
          className={fieldClass}
          {...invalid(baseId, "email", fieldErrors)}
        />
        <FieldError id={`${baseId}-email-error`} message={fieldErrors.email} />
      </label>
      <label htmlFor={`${baseId}-phone`} className="block text-sm font-medium">
        Phone
        <input
          id={`${baseId}-phone`}
          name="phone"
          type="tel"
          required
          className={fieldClass}
          {...invalid(baseId, "phone", fieldErrors)}
        />
        <FieldError id={`${baseId}-phone-error`} message={fieldErrors.phone} />
      </label>
      {type === "corporate" ? (
        <label
          htmlFor={`${baseId}-company`}
          className="block text-sm font-medium"
        >
          Company
          <input
            id={`${baseId}-company`}
            name="company"
            className={fieldClass}
            {...invalid(baseId, "company", fieldErrors)}
          />
          <FieldError
            id={`${baseId}-company-error`}
            message={fieldErrors.company}
          />
        </label>
      ) : null}
      {type === "umrah" && !details ? (
        <>
          <label
            htmlFor={`${baseId}-destination`}
            className="block text-sm font-medium sm:col-span-2"
          >
            Package or destination
            <input
              id={`${baseId}-destination`}
              name="destination"
              required
              className={fieldClass}
              {...invalid(baseId, "destination", fieldErrors)}
            />
            <FieldError
              id={`${baseId}-destination-error`}
              message={fieldErrors.destination}
            />
          </label>
          <label
            htmlFor={`${baseId}-date`}
            className="block text-sm font-medium"
          >
            Travel date
            <input
              id={`${baseId}-date`}
              name="travelDate"
              type="date"
              required
              className={fieldClass}
              {...invalid(baseId, "travelDate", fieldErrors)}
            />
            <FieldError
              id={`${baseId}-travelDate-error`}
              message={fieldErrors.travelDate}
            />
          </label>
          <label
            htmlFor={`${baseId}-travellers`}
            className="block text-sm font-medium"
          >
            Travellers
            <input
              id={`${baseId}-travellers`}
              name="travellers"
              type="number"
              min={1}
              max={99}
              required
              className={fieldClass}
              {...invalid(baseId, "travellers", fieldErrors)}
            />
            <FieldError
              id={`${baseId}-travellers-error`}
              message={fieldErrors.travellers}
            />
          </label>
        </>
      ) : null}
      {type === "visa" && !details ? (
        <>
          <label
            htmlFor={`${baseId}-destination`}
            className="block text-sm font-medium"
          >
            Visa country or type
            <input
              id={`${baseId}-destination`}
              name="destination"
              required
              className={fieldClass}
              {...invalid(baseId, "destination", fieldErrors)}
            />
            <FieldError
              id={`${baseId}-destination-error`}
              message={fieldErrors.destination}
            />
          </label>
          <label
            htmlFor={`${baseId}-date`}
            className="block text-sm font-medium"
          >
            Travel date
            <input
              id={`${baseId}-date`}
              name="travelDate"
              type="date"
              required
              className={fieldClass}
              {...invalid(baseId, "travelDate", fieldErrors)}
            />
            <FieldError
              id={`${baseId}-travelDate-error`}
              message={fieldErrors.travelDate}
            />
          </label>
        </>
      ) : null}
      {type === "tour" && !details ? (
        <>
          <label
            htmlFor={`${baseId}-destination`}
            className="block text-sm font-medium sm:col-span-2"
          >
            Destination or tour
            <input
              id={`${baseId}-destination`}
              name="destination"
              required
              className={fieldClass}
              {...invalid(baseId, "destination", fieldErrors)}
            />
            <FieldError
              id={`${baseId}-destination-error`}
              message={fieldErrors.destination}
            />
          </label>
          <label
            htmlFor={`${baseId}-date`}
            className="block text-sm font-medium"
          >
            Travel date
            <input
              id={`${baseId}-date`}
              name="travelDate"
              type="date"
              required
              className={fieldClass}
              {...invalid(baseId, "travelDate", fieldErrors)}
            />
            <FieldError
              id={`${baseId}-travelDate-error`}
              message={fieldErrors.travelDate}
            />
          </label>
          <label
            htmlFor={`${baseId}-travellers`}
            className="block text-sm font-medium"
          >
            Travellers
            <input
              id={`${baseId}-travellers`}
              name="travellers"
              type="number"
              min={1}
              max={99}
              required
              className={fieldClass}
              {...invalid(baseId, "travellers", fieldErrors)}
            />
            <FieldError
              id={`${baseId}-travellers-error`}
              message={fieldErrors.travellers}
            />
          </label>
        </>
      ) : null}
      {type === "transport" ? (
        <>
          <label
            htmlFor={`${baseId}-subject`}
            className="block text-sm font-medium sm:col-span-2"
          >
            Transport or service type
            <input
              id={`${baseId}-subject`}
              name="subject"
              required
              className={fieldClass}
              {...invalid(baseId, "subject", fieldErrors)}
            />
            <FieldError
              id={`${baseId}-subject-error`}
              message={fieldErrors.subject}
            />
          </label>
          <label
            htmlFor={`${baseId}-destination`}
            className="block text-sm font-medium sm:col-span-2"
          >
            Destination or pickup
            <input
              id={`${baseId}-destination`}
              name="destination"
              required
              className={fieldClass}
              {...invalid(baseId, "destination", fieldErrors)}
            />
            <FieldError
              id={`${baseId}-destination-error`}
              message={fieldErrors.destination}
            />
          </label>
          <label
            htmlFor={`${baseId}-date`}
            className="block text-sm font-medium"
          >
            Travel date
            <input
              id={`${baseId}-date`}
              name="travelDate"
              type="date"
              required
              className={fieldClass}
              {...invalid(baseId, "travelDate", fieldErrors)}
            />
            <FieldError
              id={`${baseId}-travelDate-error`}
              message={fieldErrors.travelDate}
            />
          </label>
          <label
            htmlFor={`${baseId}-travellers`}
            className="block text-sm font-medium"
          >
            Travellers
            <input
              id={`${baseId}-travellers`}
              name="travellers"
              type="number"
              min={1}
              max={99}
              required
              className={fieldClass}
              {...invalid(baseId, "travellers", fieldErrors)}
            />
            <FieldError
              id={`${baseId}-travellers-error`}
              message={fieldErrors.travellers}
            />
          </label>
        </>
      ) : null}
      <label
        htmlFor={`${baseId}-message`}
        className="block text-sm font-medium sm:col-span-2"
      >
        {context
          ? "Additional notes (optional)"
          : type === "corporate"
            ? "Request details"
            : "Message"}
        <textarea
          id={`${baseId}-message`}
          name="message"
          required={!context}
          rows={4}
          maxLength={4000 - (context ? context.length + 2 : 0)}
          className={fieldClass}
          {...invalid(baseId, "message", fieldErrors)}
        />
        <FieldError
          id={`${baseId}-message-error`}
          message={fieldErrors.message}
        />
      </label>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending || received}>
          {pending ? "Sending…" : received ? "Inquiry received" : submitLabel}
        </Button>
        {notice && (notice.tone === "error" || received) ? (
          <p
            role={notice.tone === "success" ? "status" : "alert"}
            className="mt-3 text-sm font-medium text-white"
          >
            {notice.message}
          </p>
        ) : null}
        {received && (
          <button
            type="button"
            className="mt-3 block min-h-11 text-sm underline"
            onClick={() => {
              setConfirmedContext(null);
              setNotice(null);
            }}
          >
            Prepare another inquiry
          </button>
        )}
      </div>
    </form>
  );
}

function invalid(baseId: string, name: string, fields: Record<string, string>) {
  const message = fields[name];
  if (!message) return {};
  return {
    "aria-invalid": true as const,
    "aria-describedby": `${baseId}-${name}-error`,
  };
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-sm font-medium text-white">
      {message}
    </p>
  );
}
