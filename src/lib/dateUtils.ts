import { format, isWithinInterval, startOfDay, endOfDay, parseISO, subDays } from "date-fns";

export function safeDate(value: any): Date | null {
  if (!value) return null;
  try {
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }
    // Handle Firestore Timestamp objects or any objects with toDate or seconds/nanoseconds
    if (typeof value === "object") {
      if (typeof value.toDate === "function") {
        const d = value.toDate();
        return isNaN(d.getTime()) ? null : d;
      }
      const seconds = value.seconds ?? value._seconds;
      if (typeof seconds === "number") {
        const d = new Date(seconds * 1000);
        return isNaN(d.getTime()) ? null : d;
      }
    }
    if (typeof value === "string") {
      if (value.includes("T")) {
        const parsed = parseISO(value);
        if (!isNaN(parsed.getTime())) return parsed;
      }
      // fallback to splits for yyyy-mm-dd
      const parts = value.split("-").map(Number);
      if (parts.length === 3 && parts.every(p => !isNaN(p))) {
        const d = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
        if (!isNaN(d.getTime())) return d;
      }
    }
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function safeFormat(value: any, formatStr: string, fallback: string = ""): string {
  const d = safeDate(value);
  if (!d) return fallback;
  try {
    return format(d, formatStr);
  } catch {
    return fallback;
  }
}

export function safeIsWithinInterval(value: any, interval: { start: any; end: any }): boolean {
  const date = safeDate(value);
  const start = safeDate(interval.start);
  const end = safeDate(interval.end);
  if (!date || !start || !end) return false;
  try {
    return isWithinInterval(date, { start, end });
  } catch {
    return false;
  }
}

export function safeStartOfDay(value: any): Date | null {
  const d = safeDate(value);
  if (!d) return null;
  try {
    return startOfDay(d);
  } catch {
    return null;
  }
}

export function safeEndOfDay(value: any): Date | null {
  const d = safeDate(value);
  if (!d) return null;
  try {
    return endOfDay(d);
  } catch {
    return null;
  }
}

export function safeSubDays(value: any, amount: number): Date | null {
  const d = safeDate(value);
  if (!d) return null;
  try {
    return subDays(d, amount);
  } catch {
    return null;
  }
}
