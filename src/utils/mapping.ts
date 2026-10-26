import { Booking, StatusColors, TimelineData, Vehicle } from "../types/booking";
import { parseOffsetDate } from "./dates";

const defaultColors: StatusColors = {
  confirmed: "#2563EB",
  booked: "#2563EB",
  pending: "#D97706",
  active: "#059669",
  hired: "#0F766E",
  returned: "#475569",
  cancelled: "#6B7280",
  maintenance: "#7C3AED",
};

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readField(record: JsonRecord, ...keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) {
      return record[key];
    }
  }
  return undefined;
}

function normalizeId(value: unknown): string | undefined {
  if (
    (typeof value !== "string" && typeof value !== "number") ||
    (typeof value === "number" && !Number.isFinite(value))
  ) {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeVehicleId(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return normalizeId(value);
  }

  return normalizeId(readField(value, "Id", "ID", "id"));
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function parseJsonArray(
  json: string,
  label: string,
  issues: string[]
): unknown[] {
  if (json.trim().length === 0) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      issues.push(`${label} must be a JSON array.`);
      return [];
    }
    return parsed;
  } catch {
    issues.push(`${label} contains invalid JSON.`);
    return [];
  }
}

export function parseTimelineData(
  vehiclesJson: string,
  bookingsJson: string
): TimelineData {
  const issues: string[] = [];
  const vehicleRows = parseJsonArray(vehiclesJson, "VehiclesJson", issues);
  const bookingRows = parseJsonArray(bookingsJson, "BookingsJson", issues);
  const vehicles: Vehicle[] = [];
  const vehicleIds = new Set<string>();

  vehicleRows.forEach((row, index) => {
    if (!isRecord(row)) {
      issues.push(`Vehicle row ${index + 1} is not an object and was skipped.`);
      return;
    }

    const id = normalizeId(readField(row, "id", "ID"));
    if (!id) {
      issues.push(`Vehicle row ${index + 1} has no valid ID and was skipped.`);
      return;
    }
    if (vehicleIds.has(id)) {
      issues.push(`Vehicle ID "${id}" is duplicated; later row was skipped.`);
      return;
    }

    vehicleIds.add(id);
    vehicles.push({
      id,
      title: optionalText(readField(row, "title", "Title")) ?? id,
      registration: optionalText(
        readField(row, "registration", "Registration", "VehicleRego")
      ),
      branch: optionalText(readField(row, "branch", "Branch")),
      condition: optionalText(
        readField(row, "condition", "VehicleCondition", "VehicleStatus")
      ),
    });
  });

  const bookings: Booking[] = [];
  const bookingIds = new Set<string>();
  bookingRows.forEach((row, index) => {
    if (!isRecord(row)) {
      issues.push(`Booking row ${index + 1} is not an object and was skipped.`);
      return;
    }

    const id = normalizeId(readField(row, "id", "ID"));
    const vehicleId = normalizeVehicleId(
      readField(row, "vehicleId", "VehicleID", "vehicle")
    );
    const start = parseOffsetDate(
      readField(row, "start", "StartDate", "PickupDate")
    );
    const end = parseOffsetDate(
      readField(row, "end", "EndDate", "ReturnDate")
    );
    const status =
      optionalText(
        readField(row, "status", "HireStatus", "BookingStatus")
      ) ?? "Unspecified";

    if (!id) {
      issues.push(`Booking row ${index + 1} has no valid ID and was skipped.`);
      return;
    }
    if (bookingIds.has(id)) {
      issues.push(`Booking ID "${id}" is duplicated; later row was skipped.`);
      return;
    }
    if (!vehicleId || !vehicleIds.has(vehicleId)) {
      issues.push(
        `Booking "${id}" references an unknown vehicle and was skipped.`
      );
      return;
    }
    if (start === undefined || end === undefined || end <= start) {
      issues.push(
        `Booking "${id}" has invalid offset-aware dates or a non-positive duration and was skipped.`
      );
      return;
    }

    bookingIds.add(id);
    bookings.push({
      id,
      vehicleId,
      title: optionalText(readField(row, "title", "Title")) ?? id,
      start,
      end,
      status,
    });
  });

  return { vehicles, bookings, issues };
}

export function parseStatusColors(
  json: string,
  issues: string[] = []
): StatusColors {
  if (json.trim().length === 0) {
    return defaultColors;
  }

  try {
    const parsed: unknown = JSON.parse(json);
    if (!isRecord(parsed)) {
      issues.push("StatusColorsJson must be a JSON object.");
      return defaultColors;
    }

    const colors = { ...defaultColors };
    for (const [status, color] of Object.entries(parsed)) {
      if (
        typeof color === "string" &&
        /^(?:#[\da-f]{3}|#[\da-f]{4}|#[\da-f]{6}|#[\da-f]{8})$/i.test(color)
      ) {
        colors[status.toLowerCase()] = color;
      } else {
        issues.push(`Status color for "${status}" is invalid and was ignored.`);
      }
    }
    return colors;
  } catch {
    issues.push("StatusColorsJson contains invalid JSON.");
    return defaultColors;
  }
}

export function getStatusColor(
  status: string,
  colors: StatusColors
): string {
  return colors[status.toLowerCase()] ?? "#334155";
}

export function getStatusTextColor(background: string): string {
  const hex = background.slice(1);
  const channels =
    hex.length === 3 || hex.length === 4
      ? hex.slice(0, 3).split("").map((channel) => parseInt(channel + channel, 16))
      : [
          parseInt(hex.slice(0, 2), 16),
          parseInt(hex.slice(2, 4), 16),
          parseInt(hex.slice(4, 6), 16),
        ];
  const alpha =
    hex.length === 4
      ? parseInt(hex[3] + hex[3], 16) / 255
      : hex.length === 8
        ? parseInt(hex.slice(6, 8), 16) / 255
        : 1;
  const luminance = channels
    .map((channel) => {
      const composited = (channel * alpha + 255 * (1 - alpha)) / 255;
      return composited <= 0.04045
        ? composited / 12.92
        : ((composited + 0.055) / 1.055) ** 2.4;
    })
    .reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);
  const whiteContrast = 1.05 / (luminance + 0.05);
  const darkContrast = (luminance + 0.05) / 0.05;

  return whiteContrast >= darkContrast ? "#ffffff" : "#111827";
}
