# Vehicle Resource Booking Timeline — Power Apps PCF

## Project overview

Build a reusable **Power Apps Component Framework (PCF)** code component for a Microsoft Power Apps Canvas application that visualizes vehicle reservations from SharePoint as an interactive, resource-based Gantt calendar. Each vehicle appears on its own row, dates and times run horizontally, and bookings appear as coloured bars spanning their reservation periods.

The component will use **React, TypeScript, and the free/open-source `react-calendar-timeline` library**, rather than FullCalendar Scheduler. Power Apps remains responsible for SharePoint connectivity, authorization, business validation, and saving changes. The PCF component is responsible for rendering the timeline and communicating user actions back to the Canvas app.

## Objectives

1. Provide a clear, responsive scheduling overview for a fleet of vehicles.
2. Show existing bookings against their assigned vehicles across configurable date ranges.
3. Help staff identify availability, overlapping reservations, and operational blocks.
4. Allow users to select bookings and open the corresponding Power Apps booking form.
5. Support optional drag-and-drop reassignment and resizing, subject to validation and explicit save confirmation.
6. Keep the component reusable across Canvas apps and SharePoint list implementations.
7. Avoid commercial calendar-library licensing requirements.

## Technology stack

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Host application | Microsoft Power Apps Canvas | App navigation, forms, permissions and orchestration |
| Component framework | Power Apps Component Framework (PCF) | Reusable custom control and input/output properties |
| UI | React + TypeScript | Timeline presentation and interaction |
| Timeline library | `react-calendar-timeline` | Resource rows, bookings, navigation, drag and resize |
| Date utilities | Day.js (compatible with selected library version) | Date/time manipulation |
| Data storage | SharePoint Online lists | Vehicles and reservations |
| Data access | Power Fx SharePoint connector | Delegable filtering and updates |
| Build tools | Node.js, npm, Power Platform CLI, .NET SDK | Build, package and deploy |

**Compatibility requirement:** Pin and test a `react-calendar-timeline` version compatible with the React version supplied by the target PCF platform. Do not independently bundle a conflicting React version. Confirm package licences and API signatures for the selected version.

## Data sources

### Vehicles SharePoint list

Expected list name: `MasterFleetList` (configurable).

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `ID` | Built-in integer | Yes | Unique vehicle identifier |
| `Title` | Text | Yes | Vehicle Registration|
| `AssetNmber` | Text | Recommended | Fleet number |
| `VehicleCurrentLocation` | LookUp | Optional | Operating branch |
| `VehicleCondition` | Text | Optional | Ready for Hire, Damaged, maintenance, etc. |

### Bookings SharePoint list

Expected list name: `HireRecords` (configurable).

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `ID` | Built-in integer | Yes | Unique booking identifier |
| `Title` | Text | Yes | Booked Customer name |
| `VehicleID` | Number| Yes | Links booking to `MasterFleetList.ID` |
| `PickupDate` | Date and Time | Yes | Scheduled Booking start |
| `CheckoutTime` | Date and Time | optional | Actual Hire Started Date |
| `ReturnDate` | Date and Time | Yes | Scheduled Booking end |
| `DroppedOffDate` | Date and Time | Optional | Actuatl Returned Date |
| `HireStatus` | Choice or text | Recommended | Booked, Hired, Returned, Cancelled |
| `VehicleRego` | Text | Yes | Vehicle Registration |

The mapping layer must accommodate either a numeric `VehicleID` or a SharePoint Lookup value (`MasterFleetList.ID`). The component must not assume that SharePoint field internal names match display names.

## Core functional requirements

### FR-01 — Resource timeline
- Display one row per vehicle with vehicle name and optional registration.
- Render bookings on the corresponding vehicle row using their vehicle ID.
- Display an adjustable date/time axis and horizontal scrolling.
- Show bookings that begin before or end after the visible range, clipped to the viewport.
- Handle vehicles without bookings and bookings with missing/invalid vehicle references gracefully.

### FR-02 — Date navigation
- Support day, week and month views or equivalent configurable zoom levels.
- Provide Previous, Next and Today navigation.
- Expose the visible date range to Power Apps for data filtering.
- Synchronize external date-range changes from Power Apps with the displayed timeline.
- Use a single `StartDate`, `EndDate` for each hire record based on the `HireStatus`.
- Use a consistent **exclusive end** convention: a booking occupies `[StartDate, EndDate)`.

### FR-03 — Booking presentation
- Display booking reference on each bar.
- Colour bookings by status using a configurable status-to-colour map.
- Provide a tooltip or accessible detail view with booking ID, vehicle, start, end and status.
- Distinguish cancelled bookings, maintenance blocks and other non-rental events if supplied.
- Render overlapping bookings legibly rather than silently hiding them.

### FR-04 — Booking selection
- On click, publish the selected booking ID through a PCF output property.
- Allow Power Apps to open an edit/detail form for the selected SharePoint record.
- Do not assume that changing an output property automatically triggers Canvas navigation; implement a supported host event/action pattern or provide an explicit Canvas button as a fallback.

### FR-05 — Interactive rescheduling (second phase)
- Optionally allow moving a booking to another date or vehicle.
- Optionally allow resizing the start/end of a booking.
- Snap interactions to a configurable interval, initially 15 minutes.
- Emit proposed changes to Power Apps without writing to SharePoint directly.
- Require host-side validation and confirmation before committing a change.
- Restore the previous display if the save fails or is rejected.

### FR-06 — Filtering
- Support filtering by branch, vehicle status and vehicle search text.
- Load only relevant bookings for the visible range.
- Preserve filter settings during navigation where practical.

### FR-07 — Availability and conflict handling
- Treat two bookings as overlapping when `ExistingStart < ProposedEnd && ExistingEnd > ProposedStart`.
- Exclude cancelled bookings from conflict checks according to configurable business rules.
- Warn when a proposed booking conflicts with another booking or maintenance block.
- Enforce final conflict validation server-side to prevent concurrent-user double bookings; a Canvas-only `LookUp` check is not sufficient as a transactional guarantee.

### FR-08 — Responsive and accessible UI
- Adapt to desktop and tablet layouts, with horizontal scrolling on smaller screens.
- Provide sufficient colour contrast and avoid relying solely on colour to communicate status.
- Offer keyboard-accessible selection and descriptive labels wherever supported by the library.
- Display loading, empty-data and error states.

## Component contract

### Proposed PCF inputs

| Property | Type | Purpose |
| --- | --- | --- |
| `VehiclesJson` | Multiline text | JSON array of vehicle resources |
| `BookingsJson` | Multiline text | JSON array of booking records |
| `CalendarStartDate` | Text | Requested initial/current date, ISO 8601 |
| `ViewMode` | Text | Day, week or month |
| `ReadOnly` | Boolean | Disable drag/resize actions |
| `StatusColorsJson` | Multiline text | Optional status-colour configuration |

### Proposed PCF outputs

| Property | Type | Purpose |
| --- | --- | --- |
| `SelectedBookingId` | Text | Last selected booking ID |
| `VisibleRangeJson` | Multiline text | Current visible start and exclusive end |
| `ProposedChangeJson` | Multiline text | Proposed move/resize payload |
| `ActionSequence` | Whole number or text | Changing action token for host event handling |

Confirm supported manifest property types and Canvas PCF output/event behavior against the installed Power Platform CLI and target runtime.

### Example vehicles payload

```json
[
  { "id": 101, "title": "Toyota Corolla - 1ABC234" },
  { "id": 102, "title": "Nissan X-Trail - 1XYZ567" }
]
```

### Example bookings payload

```json
[
  {
    "id": 5001,
    "vehicleId": 101,
    "title": "BK-5001",
    "start": "2026-10-26T09:00:00+08:00",
    "end": "2026-10-29T10:00:00+08:00",
    "status": "Confirmed"
  }
]
```

### Example proposed change output

```json
{
  "bookingId": 5001,
  "vehicleId": 102,
  "start": "2026-10-27T09:00:00+08:00",
  "end": "2026-10-30T10:00:00+08:00",
  "action": "move"
}
```

## Data flow

1. Canvas app connects to the `MasterFleetList` and `HireRecords` SharePoint lists.
2. Power Fx retrieves vehicles for the selected branch and bookings overlapping the requested range.
3. Power Fx converts these records into compact JSON using explicit field mappings.
4. PCF parses and validates the JSON, then maps vehicles to timeline groups and bookings to timeline items.
5. React renders the timeline and handles local interaction.
6. On selection, PCF publishes the booking ID to Canvas.
7. On move/resize, PCF publishes a proposed change. Canvas or a controlled backend validates permissions and conflicts, persists the change, and refreshes the relevant records.

## Performance and reliability requirements

- Do not fetch the entire booking history into a Canvas collection.
- Filter bookings by overlapping visible date range: `StartDate < RangeEnd && EndDate > RangeStart`.
- Index relevant SharePoint fields, including `VehicleID`, `StartDate`, `EndDate` and frequently used branch/status filters.
- Test SharePoint delegation and list-view-threshold behavior with realistic datasets; indexes alone do not guarantee delegation.
- Avoid repeated JSON parsing and React rerenders when inputs have not changed.
- Define reasonable limits and clear messaging for exceptionally large date ranges or fleets.
- Reject malformed JSON and invalid date ranges without crashing the app.
- Standardize timezones. Prefer explicit offset-aware ISO 8601 values at the component boundary, and test SharePoint/Power Apps date conversion behavior.

## Security requirements

- Use the Canvas app's authenticated SharePoint connection; do not store SharePoint credentials or secrets in the PCF control.
- Enforce access through SharePoint permissions and any backend authorization layer.
- Treat all incoming JSON and booking labels as untrusted data; render text safely.
- Do not assume hidden rows or disabled UI actions enforce security.
- Log technical errors without exposing customer personal information.

## Suggested repository structure

```text
vehicle-booking-timeline/
├── README.md
├── description.md
├── package.json
├── tsconfig.json
├── pcfconfig.json
├── ControlManifest.Input.xml
├── index.ts
├── components/
│   ├── BookingTimeline.tsx
│   ├── BookingItem.tsx
│   ├── TimelineToolbar.tsx
│   └── TimelineLegend.tsx
├── types/
│   └── booking.ts
├── utils/
│   ├── mapping.ts
│   ├── dates.ts
│   ├── validation.ts
│   └── colors.ts
├── styles/
│   └── timeline.css
├── tests/
│   ├── mapping.test.ts
│   ├── overlap.test.ts
│   └── dates.test.ts
└── solution/
    └── (Power Platform solution project)
```

Adapt the exact structure to the files generated by `pac pcf init`; do not delete framework-required resources or metadata.

## Delivery phases

### Phase 1 — Read-only MVP
- Create the React PCF project and install a compatible timeline library version.
- Define manifest input/output properties.
- Map SharePoint vehicles and bookings to JSON.
- Display timeline groups and booking bars.
- Add navigation, status colours, selection and empty/error states.
- Package and import into a development environment.

### Phase 2 — Canvas integration
- Connect the two SharePoint lists.
- Add branch and date-range filtering.
- Synchronize Canvas date controls with the PCF timeline.
- Open the booking form using selected booking ID.
- Refresh after form save and validate timezones.

### Phase 3 — Editing and validation
- Implement proposed move/resize outputs.
- Add confirmation, permissions and conflict validation.
- Save changes via an authorized host/backend workflow.
- Handle rejected changes, concurrency and rollback.

### Phase 4 — Operational enhancements
- Add maintenance blocks, availability indicators and overdue returns.
- Add vehicle category grouping, search and optional utilization metrics.
- Optimize large fleet/date-range performance and accessibility.

## Acceptance criteria

1. Vehicles appear as distinct timeline rows with correct labels.
2. Every valid booking is displayed on the correct vehicle and time span.
3. Bookings overlapping the edges of the visible range are displayed correctly.
4. Day/week/month navigation works and requests the corresponding SharePoint records.
5. Selecting a booking exposes its correct SharePoint ID to Canvas.
6. Confirmed, pending, active and cancelled bookings are visually distinguishable.
7. Invalid or missing records do not crash the component.
8. Read-only mode prevents moving and resizing.
9. Proposed edits cannot bypass permission or double-booking validation.
10. The packaged solution imports and operates in the target Canvas app environment.
11. The component handles realistic fleet and booking volumes without significant interaction lag.
12. No commercial calendar scheduler licence is required.

## Out of scope for the initial MVP

- Direct SharePoint REST requests from the PCF control.
- Automatic payment processing or rental invoicing.
- Customer-facing online reservations.
- GPS/telematics integration.
- Full maintenance management workflows.
- Guaranteed transactional booking writes using SharePoint alone.

## Key assumptions and decisions to confirm

- Actual SharePoint list names and internal field names.
- Whether `VehicleID` is a Number or Lookup column.
- Whether bookings include times or dates only.
- Whether the application operates in one timezone or multiple branches/timezones.
- Which booking statuses should block vehicle availability.
- Expected vehicle count and booking volume.
- Whether users need drag-and-drop editing in the first release.

## Definition of done

The project is complete when a packaged, tested PCF control can be added to a Canvas app, display SharePoint vehicle bookings accurately as a free React resource timeline, navigate and filter date ranges, select a booking for editing, and handle data loading and errors reliably. Interactive edits, if enabled, must pass authorization and conflict validation before being committed.
