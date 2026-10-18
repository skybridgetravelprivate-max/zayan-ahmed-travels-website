"use client";

import { DemoForm, MessageField, TextField } from "@/components/forms/DemoForm";

export function GroupBookingForm() {
  return (
    <DemoForm
      submitLabel="Send group booking inquiry"
      inquiryType="group-booking"
      fieldIds={{
        name: "group-name",
        phone: "group-phone",
        email: "group-email",
        destination: "group-destination",
        travelDate: "group-date",
        travellers: "group-travellers",
        message: "group-message",
      }}
      toPayload={(data) => ({
        name: data.get("group-name"),
        phone: data.get("group-phone"),
        email: data.get("group-email"),
        destination: data.get("group-destination"),
        travelDate: data.get("group-date"),
        travellers: data.get("group-travellers"),
        message: data.get("group-message"),
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="group-name" label="Name" />
        <TextField id="group-phone" label="Phone" type="tel" />
        <TextField id="group-email" label="Email" type="email" />
        <TextField id="group-destination" label="Destination" />
        <TextField id="group-date" label="Travel date" type="date" />
        <TextField id="group-travellers" label="Travellers" type="number" />
      </div>
      <MessageField id="group-message" label="Message" />
    </DemoForm>
  );
}
