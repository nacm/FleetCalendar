# AGENTS.md — Vehicle Resource Booking Timeline PCF

## Purpose

This file provides persistent instructions for AI coding agents working in this repository. The source of truth for product scope and acceptance criteria is [`description.md`](./description.md). Read it before planning, modifying, or reviewing code. If this file and `description.md` conflict, follow `description.md` for product requirements and flag the discrepancy rather than silently changing scope.

## Mission

Build a reusable **Power Apps Component Framework (PCF) React code component** for a Canvas app that displays **SharePoint vehicle bookings** as a resource-based Gantt calendar. Vehicles are rows, time runs horizontally, and bookings are coloured bars. Use **free/open-source `react-calendar-timeline`**, not FullCalendar Scheduler or other commercial resource-timeline packages.

The PCF component **renders data and emits user intent**. The Canvas app/Power Fx owns SharePoint connections, authorization, data retrieval, validation, and persistence. Do not put SharePoint secrets, credentials, or direct write operations in browser code.

## Read-first checklist

1. Read `description.md` in full, including the PCF input/output contract, delivery phases, and acceptance criteria.
2. Inspect `ControlManifest.Input.xml`, `package.json`, `tsconfig.json`, `pcfconfig.json`, existing source, tests, and repository status before editing.
3. Identify the current phase and work only on requested features; **Phase 1 is read-only** unless editing is explicitly authorized.
4. Confirm the actual installed PCF/React/`react-calendar-timeline` versions and their API compatibility from package metadata and types. Do not assume examples from other major versions apply.
5. Propose the smallest verifiable change; run relevant checks and report outcomes.

## Technology and architectural constraints

- **Platform:** Power Apps Canvas, PCF React control, TypeScript, Power Fx, SharePoint Online.
- **Timeline:** `react-calendar-timeline` with compatible Day.js/date utilities; pin compatible versions in the lockfile.
- **PCF:** Follow the manifest contract and generated `IInputs`/`IOutputs`; use the React-control lifecycle (`init`, `updateView`, `getOutputs`, `destroy`) as applicable to the scaffold.
- **React:** Use the version provided/supported by the PCF platform library; do not bundle or upgrade a conflicting React runtime.
- **Data boundary:** Inputs are serializable JSON text or other explicitly documented PCF properties; outputs are serializable values. Validate and normalize at the boundary.
- **SharePoint:** No direct SharePoint REST calls or authentication inside the PCF control unless an explicit architecture change is approved.
- **Licensing:** No FullCalendar Scheduler or paid timeline dependency. Verify actual package licence before adoption.
- **Repository:** Preserve the existing project layout, scripts, lint rules, formatting, and solution packaging approach where present.

## SharePoint model and mapping

The default source model is two SharePoint lists. Column names are examples, not assumptions about a deployed tenant; make mappings configurable or document changes.

| Source | Field | Purpose |
| --- | --- | --- |
| Vehicles | `ID` | Unique vehicle/resource ID |
| Vehicles | `Title` | Display label |
| Vehicles | `Registration` | Optional registration label |
| Vehicles | `Branch` | Optional branch filter |
| Bookings | `ID` | Unique booking ID |
| Bookings | `VehicleID` | References `Vehicles.ID`; Number or Lookup requires different Power Fx mapping |
| Bookings | `Title` | Booking reference/label |
| Bookings | `StartDate` | Start timestamp |
| Bookings | `EndDate` | End timestamp |
| Bookings | `BookingStatus` | Colour/status mapping |

**Identity:** Normalize resource and booking IDs consistently. `react-calendar-timeline` item `group` must exactly match the corresponding resource `id` in type and value. Do not mix numeric IDs and string IDs accidentally.

**Time:** Model reservations as half-open intervals `[start, end)`; overlap iff `existingStart < proposedEnd && existingEnd > proposedStart`. Use timezone-aware ISO 8601 values at boundaries, preserve instants, and test local display (including WA/Australia requirements where relevant). Do not append `Z` to local timestamps without UTC conversion. Date-only inclusive end dates require an explicit conversion rule.

## Expected PCF contract

Follow the authoritative contract in `description.md`. The initial control should accept vehicle and booking payloads and expose booking selection and the visible range. Suggested logical fields:

- Inputs: `VehiclesJson`, `BookingsJson`, and optional initial date/view/filter inputs as documented in the manifest.
- Outputs: `SelectedBookingId`, `VisibleRange` (start inclusive, end exclusive).
- Later-phase editing output: a **proposed** booking change payload, with a monotonically increasing sequence/nonce when needed so repeat changes are observable.

Do not assume an output change automatically triggers a Power Fx action. Confirm supported Canvas PCF event/output patterns; otherwise provide a deliberate Canvas button or event-handler integration. Do not silently persist changes in response to drag or resize.

## Implementation rules

### Timeline rendering

- Render one resource row per vehicle and one bar per booking.
- Support a bounded visible range and navigation for day/week/month as specified.
- Show sensible empty, loading, malformed-input, and error states without crashing the host app.
- Use consistent status colours with text/accessible labels; never communicate status by colour alone.
- Ensure the component sizes to its host container and does not cause uncontrolled page scrolling.
- Keep interactions keyboard-accessible where feasible and provide clear focus/selection states.
- Avoid mutating props, parsed input arrays, or SharePoint-derived objects.

### Data processing

- Parse JSON defensively with schema/type checks; reject invalid dates, missing IDs, negative/zero durations, and invalid resource references gracefully.
- Memoize transformations where useful; do not re-create large arrays unnecessarily on every render.
- Do not load every historical booking. The Canvas app should query a **bounded visible window** and optionally filter by branch/resource.
- Treat SharePoint delegation and list-view thresholds as design constraints. Index relevant fields, test delegability, and do not rely on `ClearCollect` for complete large datasets.
- Refresh or reconcile stale booking data before a save, and show failure/conflict states clearly.

### Editing (only when authorized)

- Dragging a bar to another vehicle and resizing a bar should emit a **proposal**, not a committed booking.
- Preserve booking duration on moves and distinguish start-edge/end-edge resizes.
- Validate resource IDs, timestamps, status restrictions, and overlaps before enabling confirmation.
- The Canvas app or server-side booking service owns the final update and authoritative conflict check; a client-side `LookUp` alone cannot prevent concurrent double bookings.
- On rejection or save failure, revert optimistic UI changes and surface an actionable error.
- Do not implement irreversible writes, deletion, or bulk rescheduling without explicit approval.

## Recommended work sequence

1. **Scaffold:** Confirm PCF React project, manifest, package versions, imports, and build scripts.
2. **Data contract:** Define typed resource/booking models, parser/validator, sample fixtures, and output schema.
3. **Read-only MVP:** Render resource rows, booking bars, status styling, selection, navigation, empty/error states.
4. **Canvas integration:** Supply Power Fx examples for loading two SharePoint lists, date-range filtering, JSON mapping, and opening a selected booking.
5. **Testing and packaging:** Unit tests, local PCF harness, solution build/import instructions, and Canvas smoke tests.
6. **Optional editing phase:** Drag, resize, proposal outputs, conflict validation, save confirmation, rollback.

Do not skip ahead to editing or introduce an API/backend that the requirements do not call for.

## Build and verification

Run only scripts actually defined by `package.json`; typical PCF commands are:

```powershell
npm ci
npm run build
npm start
```

For a solution project, follow the repository's `pac solution` workflow and build using the installed .NET tooling. If tests/lint/typecheck scripts exist, run them. Never report a command as passed unless it was executed successfully. If the environment lacks Power Platform credentials or a Canvas runtime, clearly distinguish locally verified behaviour from manual deployment steps.

### Minimum tests

- Valid and malformed JSON inputs; empty arrays; missing/duplicate IDs.
- Vehicle-to-booking mapping for Number and Lookup SharePoint representations.
- Booking before/after visible window; partial overlap; adjacent bookings that do not overlap.
- Timezone offset conversion and start/end boundary handling.
- Status colours, labels, resource ordering, booking selection, and range outputs.
- Repeated selection/range changes without event loops or excessive re-rendering.
- Large fixture performance and visible-window filtering assumptions.
- When editing is enabled: move, resize, conflict rejection, cancelled save, and rollback.

## Code quality and safety

- Prefer strict TypeScript, small pure functions, descriptive names, and explicit interfaces.
- Keep parsing/validation separate from React presentation and PCF host adaptation.
- Never hardcode SharePoint site URLs, tenant identifiers, customer data, tokens, or licence keys.
- Use sanitized text labels; do not inject untrusted booking titles as HTML.
- Avoid new dependencies unless necessary; document licence and maintenance implications.
- Do not alter generated files manually when they can be regenerated from the manifest.
- Do not delete or overwrite user work; inspect `git status` and preserve unrelated changes.
- Do not claim that the calendar guarantees availability; the backend must enforce booking integrity.

## Collaboration and agent responsibilities

When multiple agents are available, assign distinct responsibilities without overlapping edits:

- **Planner:** Inspect requirements and code, identify constraints, produce a small task plan and acceptance checks; avoid modifying source unless asked.
- **Developer:** Implement the agreed change, update types and documentation, run builds/tests, and summarize modified files.
- **Reviewer:** Inspect correctness, PCF lifecycle, React compatibility, date semantics, and scope adherence; report concrete findings.
- **Tester:** Add/run focused unit and integration tests, verify fixtures and edge cases, and document untested Canvas-specific behaviour.
- **Security reviewer:** Check input handling, privilege boundaries, credentials, XSS, dependency risk, and unauthorized writes.

Agents should share findings through committed documentation or concise handoff notes; do not invent test results or approvals. The current repository and `description.md` are the durable shared context.

## Required handoff format

At the end of each task, report:

1. **Implemented:** What changed and why.
2. **Files:** Paths created or modified.
3. **Verification:** Exact commands run and their pass/fail outcomes.
4. **Open issues:** Risks, compatibility questions, unverified Power Apps/SharePoint behaviour.
5. **Next step:** One concrete recommended follow-up.

## Definition of done

A task is done only when it meets the applicable acceptance criteria in `description.md`, the component builds with the pinned dependencies, relevant tests pass (or blockers are clearly stated), and the Canvas integration contract and deployment instructions are documented. A successful local build alone does not prove successful import or operation inside Power Apps.
