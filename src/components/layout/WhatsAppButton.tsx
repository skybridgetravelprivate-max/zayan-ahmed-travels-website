/** Shared by public and staff pages. Only opens WhatsApp when clicked. */
export function WhatsAppButton() {
  return <>
    <div aria-hidden="true" className="h-24 shrink-0 print:hidden" />
    <a
      href="https://wa.me/923121558860"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with Zayan Ahmed Travels on WhatsApp at +92 312 1558860 (opens in a new tab)"
      className="fixed right-4 z-50 inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-full bg-[#128c4a] p-3 text-white shadow-lg hover:bg-[#0d703b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#128c4a] print:hidden"
      style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a9 9 0 0 1-13.4 7.9L3 21l1.6-4.6A9 9 0 1 1 21 11.5Z" />
        <path d="m8 7 2 3-1.2 1.2a9 9 0 0 0 4 4L14 14l3 2c-.5 1.5-1.5 2-3 1.5C9.5 16 6.5 13 6 9c-.2-1 .5-1.8 2-2Z" />
      </svg>
      <span className="hidden pr-1 text-sm font-semibold sm:inline">WhatsApp</span>
    </a>
  </>;
}
