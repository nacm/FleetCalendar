import { describe, expect, it } from "vitest";
import {
  getStatusColor,
  getStatusTextColor,
  isOpenJob,
  parseMaintenanceJobs,
  parseStatusColors,
  parseTimelineData,
} from "../src/utils/mapping";

describe("parseMaintenanceJobs", () => {
  it("maps lookup vehicles and choice status, and flags only non-Completed jobs as open", () => {
    const issues: string[] = [];
    const jobs = parseMaintenanceJobs(
      JSON.stringify([
        { ID: 1, Title: "Brakes", Vehicle: { Id: 5, Value: "Hilux" }, Job_Status: { Value: "In Progress" } },
        { ID: 2, Vehicle: { Id: 5, Value: "Hilux" }, Job_Status: { Value: "Completed" } },
        { ID: 3, Vehicle: { Id: 9, Value: "Other" }, Job_Status: "New" },
        { ID: 4, Vehicle: 5 },
        { ID: 5, Job_Status: "New" },
      ]),
      new Set(["5"]),
      issues
    );

    expect(jobs.map((job) => job.id)).toEqual(["1", "2", "4"]);
    expect(jobs[0]).toMatchObject({ vehicleId: "5", title: "Brakes", status: "In Progress" });
    expect(jobs.filter(isOpenJob).map((job) => job.id)).toEqual(["1", "4"]);
    expect(issues).toEqual(["Job row 5 has no valid vehicle and was skipped."]);
  });

  it("reports malformed JSON", () => {
    const issues: string[] = [];
    expect(parseMaintenanceJobs("{", new Set(), issues)).toEqual([]);
    expect(issues).toEqual(["JobsJson contains invalid JSON."]);
  });
});

describe("parseTimelineData", () => {
  it("maps vehicle metadata including lookup, choice and numeric shapes", () => {
    const data = parseTimelineData(
      JSON.stringify([
        {
          ID: 1,
          Title: "1ABC123",
          Make: "Toyota",
          Model: { Value: "Hilux" },
          Year: 2022,
          VehicleCurrentLocation: { Id: 7, Value: "Perth Depot" },
          VehicleCondition: "Ready for Hire",
        },
        { ID: 2, Title: "1XYZ789" },
      ]),
      "[]"
    );

    expect(data.vehicles[0]).toMatchObject({
      make: "Toyota",
      model: "Hilux",
      year: "2022",
      currentLocation: "Perth Depot",
      condition: "Ready for Hire",
    });
    expect(data.vehicles[1].make).toBeUndefined();
    expect(data.vehicles[1].currentLocation).toBeUndefined();
    expect(data.vehicles[1].category).toBeUndefined();
  });

  it("reads vehicle category from text and lookup shapes", () => {
    const data = parseTimelineData(
      JSON.stringify([
        { ID: 1, Title: "A", VehicleCategory: "Trucks" },
        { ID: 2, Title: "B", VehicleCategory: { Id: 3, Value: "Buses" } },
      ]),
      "[]"
    );

    expect(data.vehicles.map((vehicle) => vehicle.category)).toEqual(["Trucks", "Buses"]);
  });

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
      JSON.stringify({ Confirmed: "#abc", Booked: "url(javascript:alert(1))" })
    );

    expect(getStatusColor("confirmed", colors)).toBe("#abc");
    expect(getStatusColor("booked", colors)).toBe("#D97706");
    expect(getStatusTextColor("#abc")).toBe("#111827");
    expect(getStatusTextColor("#123")).toBe("#ffffff");
  });
});
