import { Injectable } from "@nestjs/common";
import { toZonedTime, format } from "date-fns-tz"; // Or Moment-timezone

@Injectable()
export class TimezoneUtil {
  /**
   * Converts a UTC Date to a Date object in the specified IANA timezone.
   * @param dateUtc The UTC date to convert.
   * @param timezone The IANA timezone string (e.g., 'America/New_York').
   * @returns A Date object representing the time in the target timezone.
   */
  getDateTimeInTimezone(dateUtc: Date, timezone: string): Date {
    try {
      return toZonedTime(dateUtc, timezone);
    } catch (error) {
      console.error(`Invalid timezone: ${timezone}. Using UTC.`, error);
      return dateUtc; // Fallback to UTC if timezone is invalid
    }
  }

  /**
   * Formats a date to 'MM-DD' in a specific timezone for birthday comparison.
   * @param date The date object (can be local or UTC).
   * @param timezone The IANA timezone string.
   * @returns A string in 'MM-DD' format.
   */
  formatDateToMMDD(date: Date, timezone: string): string {
    return format(date, "MM-dd", { timeZone: timezone });
  }
}
