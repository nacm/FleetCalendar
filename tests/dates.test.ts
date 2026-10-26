import { describe, expect, it } from "vitest";
import { buildDateRange, moveDateRange, normalizeViewMode, parseOffsetDate } from "../src/utils/dates";

describe("date utilities", () => {
  it("preserves the instant represented by an explicit ISO offset", () => {
    expect(parseOffsetDate("2026-10-26T09:00:00+08:00")).toBe(
      Date.parse("2026-10-26T09:00:00+08:00")
    );
    expect(parseOffsetDate("2026-10-26T09:00:00")).toBeUndefined();
  });

  it("builds a Monday-to-Monday exclusive week range", () => {
    const range = buildDateRange("2026-10-28T12:00:00+08:00", "week");
    const start = new Date(range.start);
    const end = new Date(range.end);

    expect(start.getDay()).toBe(1);
    expect(start.getHours()).toBe(0);
    expect(end.getTime() - start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("moves to adjacent month boundaries and normalizes unknown view modes", () => {
    const range = buildDateRange("2026-10-26T09:00:00Z", "month");
    const next = moveDateRange(range, "month", 1);

    expect(new Date(next.start).getMonth()).toBe(10);
    expect(new Date(next.start).getDate()).toBe(1);
    expect(new Date(next.end).getMonth()).toBe(11);
    expect(normalizeViewMode("unexpected")).toBe("week");
  });
});
