// All product dates run on IST (UTC+5:30) with a Mon–Sat working week (PRD §13).

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

/** Current date in IST as YYYY-MM-DD. */
export function todayIST(): string {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10)
}

function toDate(s: string): Date {
  return new Date(s + 'T00:00:00Z')
}

function toStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** 0=Sun … 6=Sat for a YYYY-MM-DD string. */
export function dayOfWeek(s: string): number {
  return toDate(s).getUTCDay()
}

export function isWorkingDay(s: string): boolean {
  return dayOfWeek(s) !== 0
}

/** Next working day strictly after the given date (skips Sundays). */
export function nextWorkingDay(s: string): string {
  const d = toDate(s)
  do {
    d.setUTCDate(d.getUTCDate() + 1)
  } while (d.getUTCDay() === 0)
  return toStr(d)
}

/** Previous working day strictly before the given date (skips Sundays). */
export function prevWorkingDay(s: string): string {
  const d = toDate(s)
  do {
    d.setUTCDate(d.getUTCDate() - 1)
  } while (d.getUTCDay() === 0)
  return toStr(d)
}

/** Number of working days in the interval (from, to] — used to count missed carries. */
export function workingDaysBetween(from: string, to: string): number {
  let count = 0
  const d = toDate(from)
  const end = toDate(to)
  while (d < end) {
    d.setUTCDate(d.getUTCDate() + 1)
    if (d.getUTCDay() !== 0) count++
  }
  return count
}

/** Saturday of the week containing the given date (end of the Mon–Sat week). */
export function weekSaturday(s: string): string {
  const d = toDate(s)
  const dow = d.getUTCDay()
  // Sunday belongs to the week that just ended; treat its Saturday as yesterday.
  const delta = dow === 0 ? -1 : 6 - dow
  d.setUTCDate(d.getUTCDate() + delta)
  return toStr(d)
}

/** Saturday of the week AFTER the one containing the given date — where a
 *  carried-forward weekly commitment rolls to. */
export function nextWeekSaturday(s: string): string {
  const d = toDate(weekSaturday(s))
  d.setUTCDate(d.getUTCDate() + 7)
  return toStr(d)
}

/** Monday of the week containing the given date. */
export function weekMonday(s: string): string {
  const d = toDate(s)
  const dow = d.getUTCDay()
  const delta = dow === 0 ? -6 : 1 - dow
  d.setUTCDate(d.getUTCDate() + delta)
  return toStr(d)
}
