"use client";

import { createContext, useContext, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { readInquiryNotice, type InquiryFieldErrors, type InquiryNotice } from "@/components/forms/inquiry-notice";
import type { InquiryType } from "@/lib/inquiries";
import { submitInquiry } from "./inquiry-submit";

const FieldErrorContext = createContext<InquiryFieldErrors>({});

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-line bg-background px-3 py-2.5 text-sm focus:border-zayan-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-blue";

type DemoFormProps = {
  children: ReactNode;
  submitLabel: string;
  inquiryType: InquiryType;
  toPayload: (data: FormData) => Record<string, unknown>;
  /** Maps an API field name to the input id that should show its message. */
  fieldIds?: Record<string, string>;
};

export function DemoForm({ children, submitLabel, inquiryType, toPayload, fieldIds = {} }: DemoFormProps) {
  const pendingRef = useRef(false);
  const submission = useRef<Parameters<typeof submitInquiry>[0]["current"]>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<InquiryNotice | null>(null);
  const apiFields = notice?.tone === "error" ? notice.fields : {};
  const fields = Object.fromEntries(
    Object.entries(apiFields).flatMap(([key, message]) => {
      const inputId = fieldIds[key];
      return inputId ? [[inputId, message]] : [];
    }),
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setNotice(null);
    try {
      const response = await submitInquiry(submission, JSON.stringify({ type: inquiryType, ...toPayload(new FormData(event.currentTarget)) }));
      const result = await readInquiryNotice(response);
      if (result.tone === "success") submission.current = null;
      setNotice(result);
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
    <form className="space-y-4" autoComplete="off" aria-busy={pending} onSubmit={onSubmit}>
      <FieldErrorContext.Provider value={fields}>{children}</FieldErrorContext.Provider>
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : submitLabel}
      </Button>
      {notice ? (
        <p role={notice.tone === "success" ? "status" : "alert"} className="text-sm font-medium text-zayan-blue">
          {notice.message}
        </p>
      ) : null}
    </form>
  );
}

export function TextField({
  id,
  label,
  type = "text",
  required = true,
}: {
  id: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  const message = useContext(FieldErrorContext)[id];
  const errorId = `${id}-error`;

  return (
    <label htmlFor={id} className="block text-sm font-medium">
      {label}
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        className={fieldClass}
        aria-invalid={message ? true : undefined}
        aria-describedby={message ? errorId : undefined}
      />
      {message ? (
        <p id={errorId} className="mt-1 text-sm font-medium text-zayan-blue">
          {message}
        </p>
      ) : null}
    </label>
  );
}

export function MessageField({ id, label }: { id: string; label: string }) {
  const message = useContext(FieldErrorContext)[id];
  const errorId = `${id}-error`;

  return (
    <label htmlFor={id} className="block text-sm font-medium">
      {label}
      <textarea
        id={id}
        name={id}
        required
        rows={5}
        className={fieldClass}
        aria-invalid={message ? true : undefined}
        aria-describedby={message ? errorId : undefined}
      />
      {message ? (
        <p id={errorId} className="mt-1 text-sm font-medium text-zayan-blue">
          {message}
        </p>
      ) : null}
    </label>
  );
}
