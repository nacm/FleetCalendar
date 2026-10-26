import dayjs from "dayjs";
import { DateRange, ViewMode } from "../types/booking";

const isoDateWithOffset =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i;

export function normalizeViewMode(value: string | null | undefined): ViewMode {
  const normalized = value?.trim().toLowerCase();
  return normalized === "day" || normalized === "month" ? normalized : "week";
}

export function parseOffsetDate(value: unknown): number | undefined {
  if (typeof value !== "string" || !isoDateWithOffset.test(value)) {
    return undefined;
  }

  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.valueOf() : undefined;
}

export function buildDateRange(
  anchorValue: string | undefined,
  viewMode: ViewMode
): DateRange {
  const parsedAnchor =
    anchorValue && parseOffsetDate(anchorValue) !== undefined
      ? dayjs(anchorValue)
      : dayjs();

  let start: dayjs.Dayjs;
  let end: dayjs.Dayjs;
  if (viewMode === "day") {
    start = parsedAnchor.startOf("day");
    end = start.add(1, "day");
  } else if (viewMode === "month") {
    start = parsedAnchor.startOf("month");
    end = start.add(1, "month");
  } else {
    const mondayOffset = (parsedAnchor.day() + 6) % 7;
    start = parsedAnchor.subtract(mondayOffset, "day").startOf("day");
    end = start.add(7, "day");
  }

  return { start: start.valueOf(), end: end.valueOf() };
}

export function moveDateRange(
  range: DateRange,
  viewMode: ViewMode,
  direction: -1 | 1
): DateRange {
  const currentStart = dayjs(range.start);
  const nextStart =
    viewMode === "day"
      ? currentStart.add(direction, "day")
      : viewMode === "month"
        ? currentStart.add(direction, "month")
        : currentStart.add(direction * 7, "day");
  const duration =
    viewMode === "day" ? 1 : viewMode === "month" ? 1 : 7;
  const unit = viewMode === "month" ? "month" : "day";

  return {
    start: nextStart.valueOf(),
    end: nextStart.add(duration, unit).valueOf(),
  };
}
