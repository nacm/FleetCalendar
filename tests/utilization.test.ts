import { describe, expect, it } from "vitest";
import { Booking } from "../src/types/booking";
import { computeDailyUtilization } from "../src/utils/utilization";

const at = (iso: string): number => new Date(iso).getTime();

function booking(id: string, vehicleId: string, start: string, end: string, status = "Active"): Booking {
  return { id, vehicleId, title: id, start: at(start), end: at(end), status };
}

describe("computeDailyUtilization", () => {
  const rangeStart = at("2026-10-26T00:00:00");
  const rangeEnd = at("2026-10-29T00:00:00");

  it("reports percentage of vehicles booked per local day and Fully Booked at 100%", () => {
    const days = computeDailyUtilization(
      ["1", "2"],
      [
        booking("a", "1", "2026-10-26T08:00:00", "2026-10-27T10:00:00"),
        booking("b", "2", "2026-10-27T09:00:00", "2026-10-27T17:00:00"),
      ],
      rangeStart,
      rangeEnd
    );

    expect(days.map((d) => d.percent)).toEqual([50, 100, 0]);
    expect(days.map((d) => d.fullyBooked)).toEqual([false, true, false]);
  });

  it("ignores cancelled bookings, other categories, and counts each vehicle once per day", () => {
    const days = computeDailyUtilization(
      ["1", "2", "3"],
      [
        booking("a", "1", "2026-10-26T01:00:00", "2026-10-26T05:00:00"),
        booking("b", "1", "2026-10-26T06:00:00", "2026-10-26T09:00:00"),
        booking("c", "2", "2026-10-26T01:00:00", "2026-10-26T09:00:00", "Cancelled"),
        booking("d", "99", "2026-10-26T01:00:00", "2026-10-26T09:00:00"),
      ],
      rangeStart,
      rangeEnd
    );

    expect(days[0]).toMatchObject({ booked: 1, total: 3, percent: 33 });
  });

  it("treats a booking ending exactly at midnight as not occupying the next day", () => {
    const days = computeDailyUtilization(
      ["1"],
      [booking("a", "1", "2026-10-26T08:00:00", "2026-10-27T00:00:00")],
      rangeStart,
      rangeEnd
    );

    expect(days.map((d) => d.percent)).toEqual([100, 0, 0]);
  });

  it("never rounds a partial day up to 100%", () => {
    const ids = Array.from({ length: 300 }, (_, i) => String(i));
    const bookings = ids.slice(0, 299).map((id) => booking(id, id, "2026-10-26T08:00:00", "2026-10-26T09:00:00"));
    const [day] = computeDailyUtilization(ids, bookings, rangeStart, rangeEnd);

    expect(day.percent).toBe(99);
    expect(day.fullyBooked).toBe(false);
  });

  it("returns nothing for empty categories or ranges", () => {
    expect(computeDailyUtilization([], [], rangeStart, rangeEnd)).toEqual([]);
    expect(computeDailyUtilization(["1"], [], rangeEnd, rangeStart)).toEqual([]);
  });
});
