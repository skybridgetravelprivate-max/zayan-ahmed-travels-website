import { BadGatewayException, Injectable } from "@nestjs/common";

@Injectable()
export class WhatsAppService {
  async send(to: string, message: string) {
    const url = process.env.WHATSAPP_API_URL;
    const token = process.env.WHATSAPP_API_TOKEN;
    if (!url || !token) {
      console.warn("WhatsApp API not configured; message skipped");
      return { skipped: true, to, message };
    }
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ to, text: message, phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error("Provider rejected request");
      return await res.json();
    } catch {
      // Provider bodies, URLs and fetch errors may contain tokens or customer data.
      throw new BadGatewayException("WhatsApp provider request failed");
    }
  }
}
