import { getFuzzyLocalTimeFromPoint } from '@mapbox/timespace';

const timezoneCache = new Map<string, string | null>();

interface DateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function readDateTimeParts(parts: Intl.DateTimeFormatPart[]): DateTimeParts | null {
  const readNumber = (type: Intl.DateTimeFormatPartTypes): number | null => {
    const value = parts.find((part) => part.type === type)?.value;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const year = readNumber('year');
  const month = readNumber('month');
  const day = readNumber('day');
  const hour = readNumber('hour');
  const minute = readNumber('minute');
  const second = readNumber('second');

  if ([year, month, day, hour, minute, second].some((value) => value === null)) {
    return null;
  }

  return {
    year: year as number,
    month: month as number,
    day: day as number,
    hour: hour as number,
    minute: minute as number,
    second: second as number,
  };
}

export function getIanaTimeZoneFromCoordinates(latitude: number, longitude: number): string | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const normalizedLatitude = Math.max(-90, Math.min(90, latitude));
  const normalizedLongitude = Math.max(-180, Math.min(180, longitude));
  const cacheKey = `${normalizedLatitude.toFixed(6)},${normalizedLongitude.toFixed(6)}`;

  if (timezoneCache.has(cacheKey)) {
    return timezoneCache.get(cacheKey) ?? null;
  }

  try {
    const moment = getFuzzyLocalTimeFromPoint(Date.now(), [normalizedLongitude, normalizedLatitude]);
    const timezone = moment?._z?.name ?? null;
    timezoneCache.set(cacheKey, timezone);
    return timezone;
  } catch (error) {
    console.error('Failed to resolve IANA timezone from coordinates:', error);
    timezoneCache.set(cacheKey, null);
    return null;
  }
}

export function getUtcOffsetSecondsAtTimestamp(timestampMs: number, timeZone: string): number | null {
  if (!Number.isFinite(timestampMs) || !timeZone?.trim()) return null;

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    const dateTimeParts = readDateTimeParts(formatter.formatToParts(new Date(timestampMs)));
    if (!dateTimeParts) return null;

    const renderedAsUtcMs = Date.UTC(
      dateTimeParts.year,
      dateTimeParts.month - 1,
      dateTimeParts.day,
      dateTimeParts.hour,
      dateTimeParts.minute,
      dateTimeParts.second,
    );

    return Math.round((renderedAsUtcMs - timestampMs) / 1000);
  } catch (error) {
    console.error('Failed to resolve UTC offset for timezone:', error);
    return null;
  }
}
