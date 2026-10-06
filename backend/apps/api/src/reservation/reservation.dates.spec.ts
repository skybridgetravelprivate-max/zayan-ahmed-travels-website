function nightsBetween(checkIn: Date, checkOut: Date) {
  return Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000);
}

function datesOverlap(aIn: Date, aOut: Date, bIn: Date, bOut: Date) {
  return aIn < bOut && bIn < aOut;
}

function assert(cond: string, ok: boolean) {
  if (!ok) throw new Error(cond);
}

assert("nights", nightsBetween(new Date("2026-10-10"), new Date("2026-10-15")) === 5);
assert("overlap", datesOverlap(new Date("2026-10-10"), new Date("2026-10-15"), new Date("2026-10-14"), new Date("2026-10-20")));
assert("touching not overlap", !datesOverlap(new Date("2026-10-10"), new Date("2026-10-12"), new Date("2026-10-12"), new Date("2026-10-14")));
console.log("reservation date helpers OK");
