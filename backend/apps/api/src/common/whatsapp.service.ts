import { Injectable } from "@nestjs/common";

@Injectable()
export class WhatsAppService {
  async send(to: string, message: string) {
    const url = process.env.WHATSAPP_API_URL;
    const token = process.env.WHATSAPP_API_TOKEN;
    if (!url || !token) {
      console.warn("WhatsApp API not configured; message skipped", { to });
      return { skipped: true, to, message };
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to, text: message, phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID }),
    });
    return res.json();
  }
}
