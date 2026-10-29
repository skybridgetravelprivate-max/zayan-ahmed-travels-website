/** Convert local calendar boundaries with Intl; never assume the server's timezone. */
export function businessDay(timeZone: string, now = new Date()) {
  const format = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const parts = (date: Date) => Object.fromEntries(format.formatToParts(date).filter(p => p.type !== "literal").map(p => [p.type, Number(p.value)]));
  const current = parts(now);
  const midnight = (day: number) => {
    const wall = Date.UTC(current.year, current.month - 1, day);
    let instant = wall;
    for (let i = 0; i < 3; i++) {
      const local = parts(new Date(instant));
      const offset = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second) - instant;
      instant = wall - offset;
    }
    return new Date(instant);
  };
  return { start: midnight(current.day), endExclusive: midnight(current.day + 1) };
}
