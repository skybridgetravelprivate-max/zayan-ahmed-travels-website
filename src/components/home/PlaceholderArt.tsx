export type ArtTone = "makkah" | "hotel" | "tour";

const tones: Record<ArtTone, string> = {
  makkah: "from-zayan-blue via-[#145088] to-zayan-orange",
  hotel: "from-zayan-blue-dark via-zayan-blue to-[#3d7ab5]",
  tour: "from-zayan-blue via-[#1a5278] to-zayan-orange-dark",
};

type PlaceholderArtProps = {
  caption: string;
  tone?: ArtTone;
};

export function PlaceholderArt({
  caption,
  tone = "makkah",
}: PlaceholderArtProps) {
  return (
    <div
      role="img"
      aria-label={caption}
      className={`relative h-40 bg-gradient-to-br ${tones[tone]}`}
    >
      <svg
        viewBox="0 0 400 160"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <circle cx="330" cy="28" r="64" fill="white" fillOpacity="0.1" />
        <path
          d="M0 118 C90 78 150 150 230 108 C310 66 350 132 400 96 V160 H0 Z"
          fill="white"
          fillOpacity="0.14"
        />
        <path
          d="M48 148 L96 72 L140 148"
          fill="none"
          stroke="white"
          strokeOpacity="0.45"
          strokeWidth="3"
        />
        <rect
          x="78"
          y="104"
          width="36"
          height="44"
          rx="2"
          fill="white"
          fillOpacity="0.18"
        />
      </svg>
      <p
        aria-hidden="true"
        className="absolute bottom-3 left-3 rounded-full bg-black/30 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white uppercase"
      >
        Placeholder
      </p>
    </div>
  );
}

export function RouteBand({ from, to }: { from: string; to: string }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-zayan-blue px-6 py-6 text-white">
      <span className="text-base font-bold sm:text-lg">{from}</span>
      <span className="text-sm font-semibold tracking-wide text-zayan-orange uppercase">
        to
      </span>
      <span className="text-base font-bold sm:text-lg">{to}</span>
    </div>
  );
}
