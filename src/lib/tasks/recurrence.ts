import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfMonth,
  getDate,
  setDate,
} from "date-fns";
import type { RecurrenceRule } from "@/types";

/**
 * Compute the next occurrence after `from` for a recurrence rule.
 * Monthly day 31 falls on the last day of shorter months (B3).
 */
export function nextOccurrence(
  from: Date,
  rule: RecurrenceRule,
): Date | null {
  if (!rule || rule.frequency === "none") return null;

  const interval = Math.max(1, rule.interval || 1);

  switch (rule.frequency) {
    case "daily":
      return addDays(from, interval);
    case "weekly": {
      if (rule.byWeekday?.length) {
        const sorted = [...rule.byWeekday].sort((a, b) => a - b);
        for (let offset = 1; offset <= 7 * interval + 7; offset += 1) {
          const candidate = addDays(from, offset);
          if (sorted.includes(candidate.getDay())) {
            return candidate;
          }
        }
      }
      return addWeeks(from, interval);
    }
    case "monthly": {
      const targetDay = rule.byMonthDay ?? getDate(from);
      let next = addMonths(from, interval);
      if (targetDay === -1) {
        return endOfMonth(next);
      }
      const last = getDate(endOfMonth(next));
      return setDate(next, Math.min(targetDay, last));
    }
    case "yearly":
      return addYears(from, interval);
    case "custom":
      return addDays(from, interval);
    default:
      return null;
  }
}
