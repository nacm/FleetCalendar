import { Booking } from "../types/booking";

export interface DayUtilization {
  start: number;
  end: number;
  booked: number;
  total: number;
  percent: number;
  fullyBooked: boolean;
}

function startOfLocalDay(time: number): number {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function nextLocalDay(time: number): number {
  const date = new Date(time);
  date.setDate(date.getDate() + 1);
  return date.getTime();
}

/**
 * Share of the given vehicles that have a booking overlapping each local calendar day.
 * Cancelled bookings do not count. Bookings are half-open [start, end), so one that
 * ends exactly at midnight does not occupy the next day.
 */
export function computeDailyUtilization(
  vehicleIds: readonly string[],
  bookings: readonly Booking[],
  rangeStart: number,
  rangeEnd: number
): DayUtilization[] {
  const total = vehicleIds.length;
  if (total === 0 || !(rangeEnd > rangeStart)) {
    return [];
  }

  const members = new Set(vehicleIds);
  const relevant = bookings.filter(
    (booking) =>
      members.has(booking.vehicleId) && booking.status.trim().toLowerCase() !== "cancelled"
  );

  const days: DayUtilization[] = [];
  for (
    let dayStart = startOfLocalDay(rangeStart);
    dayStart < rangeEnd;
    dayStart = nextLocalDay(dayStart)
  ) {
    const dayEnd = nextLocalDay(dayStart);
    const bookedVehicles = new Set<string>();
    relevant.forEach((booking) => {
      if (booking.start < dayEnd && booking.end > dayStart) {
        bookedVehicles.add(booking.vehicleId);
      }
    });

    const booked = bookedVehicles.size;
    const fullyBooked = booked === total;
    const percent = fullyBooked ? 100 : Math.min(99, Math.round((booked / total) * 100));
    days.push({ start: dayStart, end: dayEnd, booked, total, percent, fullyBooked });
  }
  return days;
}

export function getUtilizationColors(day: DayUtilization): { background: string; text: string } {
  if (day.fullyBooked) return { background: "#fc4a4a", text: "#FFFFFF" };
  if (day.percent >= 80) return { background: "#FDBA74", text: "#111827" };
  if (day.percent >= 50) return { background: "#FDE68A", text: "#111827" };
  if (day.percent > 0) return { background: "#BBF7D0", text: "#111827" };
  return { background: "#E5E7EB", text: "#374151" };
}
