"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { readInquiryNotice, type InquiryNotice } from "@/components/forms/inquiry-notice";
import type { InquiryType } from "@/lib/inquiries";

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-white/30 bg-white px-3 py-2.5 text-sm text-foreground focus:border-zayan-orange focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-orange";

export function ServiceInquiryForm({ type, submitLabel }: { type: InquiryType; submitLabel: string }) {
  const baseId = useId();
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<InquiryNotice | null>(null);
  const fieldErrors = notice?.tone === "error" ? notice.fields : {};

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setNotice(null);
    const data = new FormData(event.currentTarget);
    const company = data.get("company");
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          name: data.get("name"),
          email: data.get("email"),
          phone: data.get("phone"),
          ...(type === "corporate" && typeof company === "string" && company.trim() ? { company } : {}),
          ...(type === "umrah"
            ? {
                destination: data.get("destination"),
                travelDate: data.get("travelDate"),
                travellers: data.get("travellers"),
              }
            : {}),
          ...(type === "visa"
            ? {
                destination: data.get("destination"),
                travelDate: data.get("travelDate"),
              }
            : {}),
          ...(type === "tour"
            ? {
                destination: data.get("destination"),
                travelDate: data.get("travelDate"),
                travellers: data.get("travellers"),
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
          message: data.get("message"),
        }),
      });
      setNotice(await readInquiryNotice(response));
    } catch {
      setNotice({
        tone: "error",
        message: "The inquiry could not be sent. Try again later.",
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
        <input id={`${baseId}-name`} name="name" required className={fieldClass} {...invalid(baseId, "name", fieldErrors)} />
        <FieldError id={`${baseId}-name-error`} message={fieldErrors.name} />
      </label>
      <label htmlFor={`${baseId}-email`} className="block text-sm font-medium">
        Email
        <input id={`${baseId}-email`} name="email" type="email" required className={fieldClass} {...invalid(baseId, "email", fieldErrors)} />
        <FieldError id={`${baseId}-email-error`} message={fieldErrors.email} />
      </label>
      <label htmlFor={`${baseId}-phone`} className="block text-sm font-medium">
        Phone
        <input id={`${baseId}-phone`} name="phone" type="tel" required className={fieldClass} {...invalid(baseId, "phone", fieldErrors)} />
        <FieldError id={`${baseId}-phone-error`} message={fieldErrors.phone} />
      </label>
      {type === "corporate" ? (
        <label htmlFor={`${baseId}-company`} className="block text-sm font-medium">
          Company
          <input id={`${baseId}-company`} name="company" className={fieldClass} {...invalid(baseId, "company", fieldErrors)} />
          <FieldError id={`${baseId}-company-error`} message={fieldErrors.company} />
        </label>
      ) : null}
      {type === "umrah" ? (
        <>
          <label htmlFor={`${baseId}-destination`} className="block text-sm font-medium sm:col-span-2">
            Package or destination
            <input id={`${baseId}-destination`} name="destination" required className={fieldClass} {...invalid(baseId, "destination", fieldErrors)} />
            <FieldError id={`${baseId}-destination-error`} message={fieldErrors.destination} />
          </label>
          <label htmlFor={`${baseId}-date`} className="block text-sm font-medium">
            Travel date
            <input id={`${baseId}-date`} name="travelDate" type="date" required className={fieldClass} {...invalid(baseId, "travelDate", fieldErrors)} />
            <FieldError id={`${baseId}-travelDate-error`} message={fieldErrors.travelDate} />
          </label>
          <label htmlFor={`${baseId}-travellers`} className="block text-sm font-medium">
            Travellers
            <input id={`${baseId}-travellers`} name="travellers" type="number" min={1} max={99} required className={fieldClass} {...invalid(baseId, "travellers", fieldErrors)} />
            <FieldError id={`${baseId}-travellers-error`} message={fieldErrors.travellers} />
          </label>
        </>
      ) : null}
      {type === "visa" ? (
        <>
          <label htmlFor={`${baseId}-destination`} className="block text-sm font-medium">
            Visa country or type
            <input id={`${baseId}-destination`} name="destination" required className={fieldClass} {...invalid(baseId, "destination", fieldErrors)} />
            <FieldError id={`${baseId}-destination-error`} message={fieldErrors.destination} />
          </label>
          <label htmlFor={`${baseId}-date`} className="block text-sm font-medium">
            Travel date
            <input id={`${baseId}-date`} name="travelDate" type="date" required className={fieldClass} {...invalid(baseId, "travelDate", fieldErrors)} />
            <FieldError id={`${baseId}-travelDate-error`} message={fieldErrors.travelDate} />
          </label>
        </>
      ) : null}
      {type === "tour" ? (
        <>
          <label htmlFor={`${baseId}-destination`} className="block text-sm font-medium sm:col-span-2">
            Destination or tour
            <input id={`${baseId}-destination`} name="destination" required className={fieldClass} {...invalid(baseId, "destination", fieldErrors)} />
            <FieldError id={`${baseId}-destination-error`} message={fieldErrors.destination} />
          </label>
          <label htmlFor={`${baseId}-date`} className="block text-sm font-medium">
            Travel date
            <input id={`${baseId}-date`} name="travelDate" type="date" required className={fieldClass} {...invalid(baseId, "travelDate", fieldErrors)} />
            <FieldError id={`${baseId}-travelDate-error`} message={fieldErrors.travelDate} />
          </label>
          <label htmlFor={`${baseId}-travellers`} className="block text-sm font-medium">
            Travellers
            <input id={`${baseId}-travellers`} name="travellers" type="number" min={1} max={99} required className={fieldClass} {...invalid(baseId, "travellers", fieldErrors)} />
            <FieldError id={`${baseId}-travellers-error`} message={fieldErrors.travellers} />
          </label>
        </>
      ) : null}
      {type === "transport" ? (
        <>
          <label htmlFor={`${baseId}-subject`} className="block text-sm font-medium sm:col-span-2">
            Transport or service type
            <input id={`${baseId}-subject`} name="subject" required className={fieldClass} {...invalid(baseId, "subject", fieldErrors)} />
            <FieldError id={`${baseId}-subject-error`} message={fieldErrors.subject} />
          </label>
          <label htmlFor={`${baseId}-destination`} className="block text-sm font-medium sm:col-span-2">
            Destination or pickup
            <input id={`${baseId}-destination`} name="destination" required className={fieldClass} {...invalid(baseId, "destination", fieldErrors)} />
            <FieldError id={`${baseId}-destination-error`} message={fieldErrors.destination} />
          </label>
          <label htmlFor={`${baseId}-date`} className="block text-sm font-medium">
            Travel date
            <input id={`${baseId}-date`} name="travelDate" type="date" required className={fieldClass} {...invalid(baseId, "travelDate", fieldErrors)} />
            <FieldError id={`${baseId}-travelDate-error`} message={fieldErrors.travelDate} />
          </label>
          <label htmlFor={`${baseId}-travellers`} className="block text-sm font-medium">
            Travellers
            <input id={`${baseId}-travellers`} name="travellers" type="number" min={1} max={99} required className={fieldClass} {...invalid(baseId, "travellers", fieldErrors)} />
            <FieldError id={`${baseId}-travellers-error`} message={fieldErrors.travellers} />
          </label>
        </>
      ) : null}
      <label htmlFor={`${baseId}-message`} className="block text-sm font-medium sm:col-span-2">
        {type === "corporate" ? "Request details" : "Message"}
        <textarea id={`${baseId}-message`} name="message" required rows={4} className={fieldClass} {...invalid(baseId, "message", fieldErrors)} />
        <FieldError id={`${baseId}-message-error`} message={fieldErrors.message} />
      </label>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : submitLabel}
        </Button>
        {notice ? (
          <p
            role={notice.tone === "success" ? "status" : "alert"}
            className="mt-3 text-sm font-medium text-white"
          >
            {notice.message}
          </p>
        ) : null}
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
