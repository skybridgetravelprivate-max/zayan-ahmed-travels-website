# CRM typography

**Inter Variable** sets the staff interface. Its tall x-height keeps labels readable at compact sizes. Use Inter with tabular lining figures for balances, fares, dates and counts. Use the reference variant for PNRs and ticket numbers, where the slashed zero distinguishes `0` from `O`. **JetBrains Mono Regular** gives UUIDs and payloads a fixed character grid with ligatures disabled. [Inter features](https://rsms.me/inter/#features) · [JetBrains Mono](https://www.jetbrains.com/lp/mono/)

Next.js serves both fonts locally in the staff workspace. Inter preloads there, and JetBrains Mono loads when a technical reference uses it. The CSS defines `calt` for contextual alternates, `cv02`, `cv03` and `cv04` for Inter character variants, `tnum` for tabular digits, and `zero` for a slashed zero. Financial amounts use an unslashed zero. Enable slashed zero for references and code.

## Type hierarchy

Pixel equivalents assume a 16 px root. The Tailwind scale uses rem so it follows the user’s font settings.

| Element | Size | Weight | Line height | Letter spacing | Tailwind and feature classes | Usage |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| Status badge | 11 px | 600 | 16 px | +0.02 em | `text-crm-micro font-semibold` | Short text such as Issued or Refunded |
| Metadata | 12 px | 400 | 18 px | +0.01 em | `text-crm-meta font-normal text-crm-muted` | Record counts, dates, helper notes |
| Technical reference | 12 px | 400 | 18 px | +0.01 em | `text-crm-meta font-crm-code font-normal crm-code` | UUIDs, API logs, payloads |
| Table header or field label | 13 px | 600 | 20 px | +0.01 em | `text-crm-label font-semibold` | Column headers, workflow fields and buttons |
| Table data | 14 px | 400 | 22 px | 0 | `text-crm-table font-normal` | Invoice, manifest and management rows |
| Ticket number or PNR | 14 px | 500 | 22 px | 0 | `text-crm-table font-medium crm-reference` | Booking and airline identifiers |
| Amount | 14 px | 600 | 22 px | 0 | `text-crm-table font-crm-data font-semibold crm-figures text-end` | Right-align the matching header and amounts. Display the currency explicitly. |
| Workflow body | 15 px | 400 | 24 px | 0 | `text-crm-body font-normal` | Form values and multi-step instructions |
| Section title | 18 px | 600 | 26 px | −0.01 em | `text-crm-section font-semibold` | Form steps and summary groups |
| Balance card amount | 24 px | 700 | 32 px | −0.015 em | `text-crm-balance font-crm-data font-bold crm-figures` | Financial balances and prominent totals |
| Page title | 30 px | 700 | 38 px | −0.025 em | `text-crm-title font-bold` | Default staff page heading |
| Wide-screen page title | 36 px | 700 | 44 px | −0.03 em | `lg:text-crm-title-lg font-bold` | Desktop dashboard or invoice heading |

## Contrast

Ratios are foreground against canvas and surface, respectively. The palette meets the WCAG 2.1 AA minimum of 4.5:1 for normal text on those backgrounds, including disabled labels. Apply disabled text directly so opacity does not reduce contrast. Keep status text visible alongside any color treatment. [WCAG 2.1 contrast minimum](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)

| Mode | Canvas | Surface | Role | Text | Canvas | Surface |
| --- | --- | --- | --- | --- | ---: | ---: |
| Light | `#F1F5F9` | `#FFFFFF` | Primary | `#1C2834` | 13.67:1 | 14.97:1 |
| Light | `#F1F5F9` | `#FFFFFF` | Muted | `#4B5B6B` | 6.37:1 | 6.98:1 |
| Light | `#F1F5F9` | `#FFFFFF` | Disabled | `#596879` | 5.21:1 | 5.70:1 |
| Light | `#F1F5F9` | `#FFFFFF` | Alert | `#A12632` | 6.75:1 | 7.40:1 |
| Light | `#F1F5F9` | `#FFFFFF` | Link | `#174C7E` | 8.08:1 | 8.86:1 |
| Dark | `#0F172A` | `#1E293B` | Primary | `#F1F5F9` | 16.30:1 | 13.35:1 |
| Dark | `#0F172A` | `#1E293B` | Muted | `#CBD5E1` | 12.02:1 | 9.85:1 |
| Dark | `#0F172A` | `#1E293B` | Disabled | `#A9B7C9` | 8.76:1 | 7.18:1 |
| Dark | `#0F172A` | `#1E293B` | Alert | `#FDA4AF` | 9.44:1 | 7.74:1 |
| Dark | `#0F172A` | `#1E293B` | Link | `#A9D4FF` | 11.52:1 | 9.44:1 |

The workspace supplies the light palette. A component using only CRM foreground and surface tokens can opt into system dark mode with `crm-type-surface`. Issued Ticket Invoices uses this class on its content panel. Shared management forms and tables use the type scale with their existing light palette.

## React example

Render this component inside the staff workspace. Pass the exact decimal string and currency returned by the API.

```tsx
type InvoiceBalanceProps = {
  pnr: string;
  currency: string;
  amount: string;
  status: "Issued" | "Refunded" | "Reissued";
};

export function InvoiceBalance({ pnr, currency, amount, status }: InvoiceBalanceProps) {
  return (
    <article className="crm-type-surface rounded-xl border border-crm-border bg-crm-surface p-4 text-crm-primary">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-crm-section font-semibold">Invoice balance</h2>
        <span className="rounded-md bg-crm-canvas px-2 py-0.5 text-crm-micro font-semibold">
          {status}
        </span>
      </div>
      <dl className="mt-3 space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <dt className="text-crm-label font-semibold text-crm-muted">PNR</dt>
          <dd className="crm-reference text-crm-table font-medium">{pnr}</dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <dt className="text-crm-label font-semibold text-crm-muted">Balance</dt>
          <dd className="crm-figures max-w-full break-words text-end font-crm-data text-crm-balance font-bold">
            {currency} {amount}
          </dd>
        </div>
      </dl>
    </article>
  );
}
```
