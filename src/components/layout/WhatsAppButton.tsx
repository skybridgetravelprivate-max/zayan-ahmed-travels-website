import { defaultWebsiteSettings } from "@/config/website";
import type { WebsiteSettings } from "@/lib/website-content";
import { whatsappLink } from "@/lib/travel-inquiry";
/** Shared by public and staff pages. Only opens WhatsApp when clicked. */
export function WhatsAppButton({
  settings = defaultWebsiteSettings,
}: {
  settings?: WebsiteSettings;
}) {
  if (!settings.whatsapp) return null;
  return (
    <aside
      aria-label="WhatsApp contact"
      className="travel-contact-bar shrink-0 print:hidden"
    >
      <div className="travel-container">
        <p className="text-sm font-medium">
          Chat with our travel desk · +{settings.whatsapp}
        </p>
        <a
          href={whatsappLink(settings.whatsapp)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Chat with ${settings.companyName} on WhatsApp at +${settings.whatsapp} (opens in a new tab)`}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#107c41] px-4 py-3 text-white hover:bg-[#0d703b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#107c41]"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 11.5a9 9 0 0 1-13.4 7.9L3 21l1.6-4.6A9 9 0 1 1 21 11.5Z" />
            <path d="m8 7 2 3-1.2 1.2a9 9 0 0 0 4 4L14 14l3 2c-.5 1.5-1.5 2-3 1.5C9.5 16 6.5 13 6 9c-.2-1 .5-1.8 2-2Z" />
          </svg>
          <span className="text-sm font-semibold">Chat on WhatsApp</span>
        </a>
      </div>
    </aside>
  );
}
