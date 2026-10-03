"use client";

import { DemoForm, MessageField, TextField } from "@/components/forms/DemoForm";

export function ContactForm() {
  return (
    <DemoForm
      submitLabel="Submit"
      inquiryType="contact"
      fieldIds={{
        name: "contact-name",
        email: "contact-email",
        phone: "contact-phone",
        subject: "contact-subject",
        message: "contact-message",
      }}
      toPayload={(data) => ({
        name: data.get("contact-name"),
        email: data.get("contact-email"),
        phone: data.get("contact-phone"),
        subject: data.get("contact-subject"),
        message: data.get("contact-message"),
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="contact-name" label="Name" />
        <TextField id="contact-email" label="Email" type="email" />
        <TextField id="contact-phone" label="Phone" type="tel" />
        <TextField id="contact-subject" label="Subject" />
      </div>
      <MessageField id="contact-message" label="Message" />
    </DemoForm>
  );
}
