/** Proleptic-Gregorian leap year. */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Days in `month` (1–12) of `year`, leap-aware for February. */
export function daysInMonth(year: number, month: number): number {
  if (month === 2 && isLeapYear(year)) return 29;
  return DAYS[month - 1]!;
}
