# Vehicle Booking Timeline PCF

A read-only React PCF for displaying SharePoint vehicle bookings by vehicle and time. The Canvas app owns SharePoint connections, authorization, filtering, validation, and persistence. The control only renders the supplied JSON and emits booking selection and visible-range outputs.

## Requirements

- Windows 10/11 or a supported Power Platform CLI environment
- Node.js 20 LTS or later, npm, and Power Platform CLI
- .NET SDK required by the installed PAC CLI
- A Power Platform development environment and a Canvas app to host the control
- `pac` available in the terminal for PCF creation, solution packaging, and deployment

The files here are a source scaffold. Install the Power Platform CLI by following [Microsoft's installation guide](https://learn.microsoft.com/power-platform/developer/cli/introduction) before using the local harness or packaging workflow below.

## Install, test, build

From the project root:

```powershell
npm install
npm test
npm run build
```

Use `npm start` to run the PCF local harness at `http://localhost:8181` (the control source lives in `VehicleBookingTimeline/`, as `pcf-scripts` requires). In the harness, set the Component Container Width/Height (for example 1000 x 600) and paste JSON into `VehiclesJson` and `BookingsJson`. Delete `out/` after an MSBuild/solution build before running `npm start`, and stop any old harness first because port 8181 silently falls back to 8182. `npm run lint` uses the PCF lint task with `eslint.config.mjs`. Sample data for the harness is in `mock/vehicles.json` and `mock/bookings.json` (dates around 26 Oct 2026, +08:00); paste each file's contents into `VehiclesJson` / `BookingsJson` and set `CalendarStartDate` to `2026-10-26T00:00:00+08:00`.

The timeline dependency is pinned to `react-calendar-timeline` 0.28.0 (MIT), which supports the React 16 runtime declared by this PCF and requires Moment as a peer dependency. Day.js handles offset-aware input parsing and view calculations; the timeline's stable React-16-compatible API uses Moment internally. The PCF manifest declares React 16.14.0 as a platform library rather than bundling a separate React runtime.

## Create and deploy a solution

Use PAC CLI to create the PCF project/solution resources in a development environment. If starting from this initialized source, use the standard PCF solution workflow from Microsoft's [PCF packaging guidance](https://learn.microsoft.com/power-apps/developer/component-framework/import-custom-controls). Typical commands are:

```powershell
pac auth create --environment <environment-id>
New-Item -ItemType Directory -Force solution
Set-Location solution
pac solution init --publisher-name <publisher-name> --publisher-prefix <prefix>
pac solution add-reference --path ..\FleetSchedule.pcfproj
dotnet msbuild /t:restore
dotnet msbuild /p:Configuration=Release
pac solution import --path <path-to-built-solution-zip>
```

Do not commit authentication profiles or environment-specific secrets. Confirm that the target environment permits custom controls and that the Canvas app uses the same control version.

## PCF input contract

| Property | Type | Meaning |
| --- | --- | --- |
| `VehiclesJson` | Multiline text | Array of vehicle objects |
| `BookingsJson` | Multiline text | Array of booking objects within the app's bounded range |
| `CalendarStartDate` | Text | Offset-aware ISO 8601 anchor date |
| `ViewMode` | Text | `day`, `week`, or `month` |
| `ReadOnly` | Two options | Defaults to read-only; this initial phase does not implement editing |
| `StatusColorsJson` | Multiline text | Optional status-to-hex-colour map |

Vehicle objects accept `id`/`ID`, `title`/`Title`, and optional registration, branch, and condition. Booking objects accept `id`/`ID`, `vehicleId`/`VehicleID`, `title`/`Title`, `start`/`StartDate`/`PickupDate`, `end`/`EndDate`/`ReturnDate`, and `status`/`HireStatus`/`BookingStatus`. Vehicle IDs are normalized to strings. Lookup-shaped IDs such as `{ "Id": 101, "Value": "..." }` and numeric IDs are both accepted. Dates must be timestamps with an explicit `Z` or UTC offset. Intervals use `[start, end)` and require a positive duration.

Outputs:

- `SelectedBookingId`: selected record ID as text
- `VisibleRangeJson`: `{ "start": "<ISO instant>", "end": "<ISO instant>" }`, with exclusive end
- `ActionSequence`: monotonically increasing action token for selection/range changes

Input records with invalid/duplicate IDs, invalid dates, or unknown vehicles are skipped and reported in the control. User text is rendered as text, not HTML. Custom colours are restricted to hexadecimal values.

## Canvas app data flow

Connect the Canvas app to `MasterFleetList` and `HireRecords`. Query only the displayed date window and map SharePoint fields explicitly; do not pass the full booking history. The following Power Fx illustrates the boundary (adjust SharePoint column internal names and delegation behavior for the tenant):

```powerfx
Set(varRange, ParseJSON(VehicleBookingTimeline1.VisibleRangeJson));
Set(varRangeStart, DateTimeValue(Text(varRange.start)));
Set(varRangeEnd, DateTimeValue(Text(varRange.end)));

ClearCollect(
    colVehicles,
    ShowColumns(MasterFleetList, ID, Title, VehicleRego, VehicleCurrentLocation)
);
ClearCollect(
    colBookings,
    Filter(HireRecords, PickupDate < varRangeEnd && ReturnDate > varRangeStart)
);
```

Map records to the compact canonical properties and bind the serialized arrays:

```powerfx
VehiclesJson =
    JSON(
        ForAll(
            colVehicles,
            {
                id: ID,
                title: Title,
                registration: VehicleRego,
                branch: VehicleCurrentLocation.Value
            }
        ),
        JSONFormat.Compact
    )

BookingsJson =
    JSON(
        ForAll(
            colBookings,
            {
                id: ID,
                vehicleId: VehicleID,
                title: Title,
                start: Switch(
                    HireStatus.Value,
                    "Hired", Coalesce(CheckoutTime, PickupDate),
                    "Returned", Coalesce(CheckoutTime, PickupDate),
                    PickupDate
                ),
                end: Switch(
                    HireStatus.Value,
                    "Returned", Coalesce(DroppedOffDate, ReturnDate),
                    ReturnDate
                ),
                status: HireStatus.Value
            }
        ),
        JSONFormat.Compact
    )
```

For a Lookup vehicle column, map `vehicleId: VehicleID.Id`; for a Number column, map `vehicleId: VehicleID`. The status-based `start`/`end` mapping above is illustrative: align the status names and actual-versus-scheduled date policy with the tenant's business rules, and provide one canonical interval per record. Verify actual `JSON` date serialization in the target Canvas runtime and ensure offset-aware ISO timestamps represent the intended instant. Do not append `Z` to local wall-clock timestamps unless converting them to UTC. SharePoint delegation and list-view thresholds must be tested with the deployed schema; `ClearCollect` in this example is illustrative and is not a guarantee of complete/delegable data.

Power Apps can use `SelectedBookingId` to select/open a record from an explicit host-side button or supported output-change behavior. Bind `VisibleRangeJson` and refresh the bounded booking query when `ActionSequence` changes; verify output/event behavior in the target Canvas runtime rather than assuming a PCF output itself invokes navigation.

## Troubleshooting

- **`pac` is not recognized:** Install or update PAC CLI, reopen the terminal, and confirm `pac --version`.
- **Build reports invalid manifest/resource keys:** Keep the manifest property names and the matching keys in `strings/VehicleBookingTimeline.1033.resx` synchronized.
- **Bookings are skipped:** Check for unique IDs, matching vehicle IDs, positive intervals, and explicit timezone offsets on start/end timestamps.
- **No bookings appear at range edges:** Make the Canvas filter use overlap semantics (`start < rangeEnd && end > rangeStart`), not only bookings whose start falls inside the range.
- **Canvas data appears incomplete:** Test SharePoint delegation and list-view limits against the actual schema; do not assume collections contain every matching record.
- **Times differ between users:** Timeline rendering uses browser-local time. Normalize source instants and agree on the fleet's display timezone before deployment.

## Scope and limitations

- Phase 1 is read-only. No drag/resize proposal, SharePoint writes, conflict checks, or authorization are implemented in the PCF.
- The control clips bookings at the visible range; the Canvas app must query overlapping bookings using `start < rangeEnd && end > rangeStart`.
- Timeline labels use the browser's local timezone. Preserve source instants and standardize the Canvas/browser timezone for users in different locations.
- SharePoint indexes do not alone guarantee delegation. Test filters and volume limits in the actual tenant.
- Successful local build does not verify PAC solution import, Canvas behavior, or SharePoint query delegation; validate these in a development environment.
