import { describe, expect, it } from "vitest";
import {
  getStatusColor,
  getStatusTextColor,
  parseStatusColors,
  parseTimelineData,
} from "../src/utils/mapping";

describe("parseTimelineData", () => {
  it("normalizes numeric and SharePoint lookup vehicle IDs to matching strings", () => {
    const data = parseTimelineData(
      JSON.stringify([{ ID: 101, Title: "Fleet vehicle" }]),
      JSON.stringify([
        {
          ID: 5001,
          VehicleID: { Id: 101, Value: "Fleet vehicle" },
          Title: "BK-5001",
          PickupDate: "2026-10-26T09:00:00+08:00",
          ReturnDate: "2026-10-29T10:00:00+08:00",
          HireStatus: "Confirmed",
        },
      ])
    );

    expect(data.vehicles[0].id).toBe("101");
    expect(data.bookings[0]).toMatchObject({
      id: "5001",
      vehicleId: "101",
      title: "BK-5001",
      status: "Confirmed",
    });
    expect(data.bookings[0].start).toBe(Date.parse("2026-10-26T09:00:00+08:00"));
    expect(data.issues).toEqual([]);
  });

  it("skips invalid, duplicate, unknown-resource, and non-positive bookings", () => {
    const data = parseTimelineData(
      JSON.stringify([{ id: "v1", title: "Vehicle" }]),
      JSON.stringify([
        { id: "bad-date", vehicleId: "v1", start: "2026-10-26", end: "2026-10-27" },
        {
          id: "zero",
          vehicleId: "v1",
          start: "2026-10-26T09:00:00Z",
          end: "2026-10-26T09:00:00Z",
        },
        {
          id: "unknown",
          vehicleId: "v2",
          start: "2026-10-26T09:00:00Z",
          end: "2026-10-26T10:00:00Z",
        },
        {
          id: "valid",
          vehicleId: "v1",
          start: "2026-10-26T09:00:00Z",
          end: "2026-10-26T10:00:00Z",
        },
        {
          id: "valid",
          vehicleId: "v1",
          start: "2026-10-26T10:00:00Z",
          end: "2026-10-26T11:00:00Z",
        },
      ])
    );

    expect(data.bookings.map((booking) => booking.id)).toEqual(["valid"]);
    expect(data.issues).toHaveLength(4);
  });

  it("returns empty data and a clear issue for malformed JSON", () => {
    const data = parseTimelineData("{", "[]");

    expect(data.vehicles).toEqual([]);
    expect(data.bookings).toEqual([]);
    expect(data.issues).toEqual(["VehiclesJson contains invalid JSON."]);
  });

  it("accepts empty arrays without validation warnings", () => {
    expect(parseTimelineData("[]", "[]")).toEqual({
      vehicles: [],
      bookings: [],
      issues: [],
    });
  });

  it("accepts only safe hexadecimal status colors", () => {
    const colors = parseStatusColors(
      JSON.stringify({ Confirmed: "#abc", Pending: "url(javascript:alert(1))" })
    );

    expect(getStatusColor("confirmed", colors)).toBe("#abc");
    expect(getStatusColor("pending", colors)).toBe("#D97706");
    expect(getStatusTextColor("#abc")).toBe("#111827");
    expect(getStatusTextColor("#123")).toBe("#ffffff");
  });
});
