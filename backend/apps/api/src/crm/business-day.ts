/** Local calendar boundaries independent of the server timezone. */
function calendar(timeZone: string) {
  const format = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = (date: Date) =>
    Object.fromEntries(
      format
        .formatToParts(date)
        .filter((p) => p.type !== "literal")
        .map((p) => [p.type, Number(p.value)]),
    );
  const midnight = (year: number, month: number, day: number) => {
    const wall = Date.UTC(year, month - 1, day);
    let instant = wall;
    for (let i = 0; i < 3; i++) {
      const local = parts(new Date(instant));
      const offset =
        Date.UTC(
          local.year,
          local.month - 1,
          local.day,
          local.hour,
          local.minute,
          local.second,
        ) - instant;
      instant = wall - offset;
    }
    return new Date(instant);
  };
  return { parts, midnight };
}
export function businessDay(timeZone: string, now = new Date()) {
  const { parts, midnight } = calendar(timeZone),
    current = parts(now);
  return {
    start: midnight(current.year, current.month, current.day),
    endExclusive: midnight(current.year, current.month, current.day + 1),
  };
}
export function businessMonth(timeZone: string, now = new Date()) {
  const { parts, midnight } = calendar(timeZone),
    current = parts(now);
  return {
    start: midnight(current.year, current.month, 1),
    endExclusive: midnight(current.year, current.month + 1, 1),
  };
}
export function businessDate(timeZone: string, value: string, nextDay = false) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) !== value
  )
    throw new RangeError("Invalid calendar date");
  const [year, month, day] = value.split("-").map(Number);
  return calendar(timeZone).midnight(year, month, day + (nextDay ? 1 : 0));
}
