import { ImageResponse } from "next/og";
import { site } from "@/config/site";

export const alt =
  "Zayan Ahmed Travels — Flights, Visa, Umrah and Tours from Abbottabad";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: "linear-gradient(120deg, #0b203a, #194b78)",
          padding: "80px",
          color: "white",
        }}
      >
        <div style={{ fontSize: 26, color: "#f3b75a" }}>{site.shortName}</div>
        <div
          style={{
            marginTop: 32,
            fontSize: 76,
            fontWeight: 700,
            lineHeight: 1.12,
          }}
        >
          Your journey, thoughtfully planned.
        </div>
        <div style={{ marginTop: 38, fontSize: 28 }}>
          Flights · Visa · Umrah · Tours
        </div>
        <div style={{ marginTop: 26, fontSize: 22, color: "#d9e6f3" }}>
          Your travel desk in Abbottabad · zayanahmedtravels.com
        </div>
      </div>
    ),
    size,
  );
}
