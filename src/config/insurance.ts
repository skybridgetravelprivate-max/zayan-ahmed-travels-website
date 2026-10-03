export type CoverageCard = {
  title: string;
  description: string;
  cover: string;
  fee: string;
};

export const travelCover: readonly CoverageCard[] = [
  {
    title: "Single-trip demo cover",
    description: "Sample label for one leisure or business trip. This is not a policy.",
    cover: "Demo label: trip delay note",
    fee: "PKR 4,500 demo",
  },
];

export const umrahCover: readonly CoverageCard[] = [
  {
    title: "Umrah journey demo cover",
    description: "Sample label for an Umrah trip. This is not a policy.",
    cover: "Demo label: travel interruption note",
    fee: "PKR 6,500 demo",
  },
];

export const familyCover: readonly CoverageCard[] = [
  {
    title: "Family demo cover",
    description: "Sample label for travellers in one family. This is not a policy.",
    cover: "Demo label: family trip note",
    fee: "PKR 12,000 demo",
  },
  {
    title: "Group demo cover",
    description: "Sample label for a travelling group. This is not a policy.",
    cover: "Demo label: group trip note",
    fee: "PKR 18,000 demo",
  },
];
