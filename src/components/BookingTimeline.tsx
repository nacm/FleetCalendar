import * as React from "react";
import Timeline, { TimelineGroupBase, TimelineItemBase } from "react-calendar-timeline";
import { Booking, DateRange, StatusColors, TimelineData, Vehicle, ViewMode } from "../types/booking";
import { buildDateRange, moveDateRange } from "../utils/dates";
import { getStatusColor, getStatusTextColor } from "../utils/mapping";
import { computeDailyUtilization, getUtilizationColors } from "../utils/utilization";
import { TimelineToolbar } from "./TimelineToolbar";
import "react-calendar-timeline/lib/Timeline.css";

interface CategorySummary {
  name: string;
  vehicleIds: string[];
  vehicleCount: number;
  bookingCount: number;
  expanded: boolean;
}

interface TimelineGroup extends TimelineGroupBase {
  id: string;
  title: string;
  vehicle?: Vehicle;
  category?: CategorySummary;
}

const UNCATEGORISED = "Uncategorised";
const CATEGORY_ID_PREFIX = "category::";

function todayColumnClass(start: number, end: number): string[] {
  const now = Date.now();
  return start <= now && now < end ? ["fleet-today-column"] : [];
}

interface TimelineItem extends TimelineItemBase<number> {
  id: string;
  group: string;
  title: string;
  start_time: number;
  end_time: number;
  canSelect?: boolean;
}

interface BookingTimelineProps {
  data: TimelineData;
  statusColors: StatusColors;
  viewMode: ViewMode;
  visibleRange: DateRange;
  selectedBookingId: string;
  readOnly: boolean;
  height?: number;
  showVehicleDetails?: boolean;
  onSelectBooking: (bookingId: string) => void;
  onVisibleRangeChange: (range: DateRange) => void;
  onViewModeChange: (mode: ViewMode) => void;
}

function formatBookingLabel(booking: Booking): string {
  return `#${booking.id} · ${booking.title} · ${booking.status}`;
}

function getVehicleDetailLines(vehicle: Vehicle): string[] {
  const makeModelYear = [vehicle.make, vehicle.model, vehicle.year]
    .filter(Boolean)
    .join(" ");
  const locationStatus = [vehicle.currentLocation, vehicle.condition]
    .filter(Boolean)
    .join(" · ");
  return [makeModelYear, locationStatus].filter((line) => line.length > 0);
}

export function BookingTimeline({
  data,
  statusColors,
  viewMode,
  visibleRange,
  selectedBookingId,
  readOnly,
  height,
  showVehicleDetails = false,
  onSelectBooking,
  onVisibleRangeChange,
  onViewModeChange,
}: BookingTimelineProps): React.ReactElement {
  const hasCategories = React.useMemo(
    () => data.vehicles.some((vehicle) => vehicle.category),
    [data.vehicles]
  );

  const [expandedCategories, setExpandedCategories] = React.useState<ReadonlySet<string>>(
    () => new Set()
  );

  const toggleCategory = React.useCallback((name: string): void => {
    setExpandedCategories((current) => {
      const next = new Set(current);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }, []);

  const categoryNames = React.useMemo(() => {
    const names = new Set<string>();
    data.vehicles.forEach((vehicle) => names.add(vehicle.category ?? UNCATEGORISED));
    return Array.from(names).sort((a, b) =>
      a === UNCATEGORISED ? 1 : b === UNCATEGORISED ? -1 : a.localeCompare(b)
    );
  }, [data.vehicles]);

  const bookingCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    data.bookings.forEach((booking) =>
      counts.set(booking.vehicleId, (counts.get(booking.vehicleId) ?? 0) + 1)
    );
    return counts;
  }, [data.bookings]);

  const groups = React.useMemo<TimelineGroup[]>(() => {
    const toVehicleGroup = (vehicle: Vehicle): TimelineGroup => ({
      id: vehicle.id,
      title: vehicle.registration
        ? `${vehicle.title} · ${vehicle.registration}`
        : vehicle.title,
      vehicle,
    });

    if (!hasCategories) {
      return data.vehicles.map(toVehicleGroup);
    }

    return categoryNames.flatMap((name) => {
      const members = data.vehicles.filter(
        (vehicle) => (vehicle.category ?? UNCATEGORISED) === name
      );
      const expanded = expandedCategories.has(name);
      const header: TimelineGroup = {
        id: `${CATEGORY_ID_PREFIX}${name}`,
        title: name,
        category: {
          name,
          vehicleIds: members.map((vehicle) => vehicle.id),
          vehicleCount: members.length,
          bookingCount: members.reduce(
            (total, vehicle) => total + (bookingCounts.get(vehicle.id) ?? 0),
            0
          ),
          expanded,
        },
      };
      return expanded ? [header, ...members.map(toVehicleGroup)] : [header];
    });
  }, [bookingCounts, categoryNames, data.vehicles, expandedCategories, hasCategories]);

  const hasVehicleDetails = React.useMemo(
    () => showVehicleDetails && data.vehicles.some((vehicle) => getVehicleDetailLines(vehicle).length > 0),
    [showVehicleDetails, data.vehicles]
  );

  const renderGroup = React.useCallback(
    ({ group }: { group: TimelineGroup }): React.ReactNode => {
      if (group.category) {
        const { name, expanded, vehicleCount, bookingCount } = group.category;
        return (
          <button
            type="button"
            className="fleet-category-toggle"
            aria-expanded={expanded}
            aria-label={`${name}, ${vehicleCount} vehicle(s), ${bookingCount} booking(s). ${
              expanded ? "Collapse" : "Expand"
            }`}
            onClick={() => toggleCategory(name)}
          >
            <span className="fleet-category-chevron" aria-hidden="true">
              {expanded ? "▾" : "▸"}
            </span>
            <span className="fleet-category-name">{name}</span>
            <span className="fleet-category-count">
              {vehicleCount} vehicle{vehicleCount === 1 ? "" : "s"} 
            </span>
          </button>
        );
      }

      const lines =
        showVehicleDetails && group.vehicle ? getVehicleDetailLines(group.vehicle) : [];
      return (
        <div className="fleet-vehicle-label">
          <div className="fleet-vehicle-title">{group.title}</div>
          {lines.map((line) => (
            <div key={line} className="fleet-vehicle-detail">
              {line}
            </div>
          ))}
        </div>
      );
    },
    [showVehicleDetails, toggleCategory]
  );

  const vehicleTitles = React.useMemo(
    () => new Map(data.vehicles.map((vehicle) => [vehicle.id, vehicle.title])),
    [data.vehicles]
  );

  const visibleVehicleIds = React.useMemo(
    () => new Set(groups.filter((group) => group.vehicle).map((group) => group.id)),
    [groups]
  );

  const bookingItems = React.useMemo<TimelineItem[]>(
    () =>
      data.bookings
        .filter((booking) => visibleVehicleIds.has(booking.vehicleId))
        .map((booking) => {
        const fullLabel = `#${booking.id}; ${booking.title}; ${booking.status}; ${
          vehicleTitles.get(booking.vehicleId) ?? booking.vehicleId
        }; ${new Date(booking.start).toLocaleString()} – ${new Date(
          booking.end
        ).toLocaleString()}`;

        return {
          id: booking.id,
          group: booking.vehicleId,
          title: formatBookingLabel(booking),
          start_time: booking.start,
          end_time: booking.end,
          canMove: false,
          canResize: false,
          className: selectedBookingId === booking.id ? "fleet-booking-selected" : "",
          itemProps: {
            title: fullLabel,
            "aria-label": fullLabel,
            tabIndex: 0,
            "aria-selected": selectedBookingId === booking.id,
            style: {
              // Library defaults use the `background`/`border` shorthands, so longhands lose when an item is selected.
              background: getStatusColor(booking.status, statusColors),
              border: `1px solid ${getStatusColor(booking.status, statusColors)}`,
              color: getStatusTextColor(
                getStatusColor(booking.status, statusColors)
              ),
              opacity: booking.status.toLowerCase() === "cancelled" ? 0.65 : 1,
            },
            onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectBooking(booking.id);
              }
            },
          },
        };
      }),
    [
      data.bookings,
      onSelectBooking,
      readOnly,
      selectedBookingId,
      statusColors,
      vehicleTitles,
      visibleVehicleIds,
    ]
  );

  // One cell per day on each category row, covering the visible range plus a buffer on both sides so panning stays populated.
  const utilizationItems = React.useMemo<TimelineItem[]>(() => {
    const span = visibleRange.end - visibleRange.start;
    return groups.flatMap((group) => {
      if (!group.category) {
        return [];
      }
      const { name, vehicleIds } = group.category;
      return computeDailyUtilization(
        vehicleIds,
        data.bookings,
        visibleRange.start - span,
        visibleRange.end + span
      ).map((day): TimelineItem => {
        const label = day.fullyBooked ? "Fully Booked" : `${day.percent}%`;
        const colors = getUtilizationColors(day);
        const description = `${name}: ${label} (${day.booked} of ${day.total} vehicle(s) booked) on ${new Date(
          day.start
        ).toLocaleDateString()}`;
        return {
          id: `utilization::${name}::${day.start}`,
          group: group.id,
          title: label,
          start_time: day.start,
          end_time: day.end,
          canMove: false,
          canResize: false,
          canSelect: false,
          className: "fleet-utilization-cell",
          itemProps: {
            title: description,
            "aria-label": description,
            style: {
              background: colors.background,
              border: `1px solid ${colors.background}`,
              color: colors.text,
              cursor: "default",
              fontWeight: 600,
              textAlign: "center"
            },
          },
        };
      });
    });
  }, [data.bookings, groups, visibleRange.end, visibleRange.start]);

  const items = React.useMemo<TimelineItem[]>(
    () => [...utilizationItems, ...bookingItems],
    [bookingItems, utilizationItems]
  );

  const navigate = (direction: -1 | 1): void => {
    onVisibleRangeChange(moveDateRange(visibleRange, viewMode, direction));
  };

  const setToday = (): void => {
    onVisibleRangeChange(buildDateRange(undefined, viewMode));
  };

  return (
    <section
      className="fleet-booking-timeline"
      style={height ? { height } : undefined}
      aria-label="Vehicle booking timeline"
    >
      <TimelineToolbar
        viewMode={viewMode}
        onNavigate={navigate}
        onToday={setToday}
        onViewModeChange={onViewModeChange}
      />
      {data.issues.length > 0 && (
        <div className="fleet-timeline-warning" role="status">
          <strong>Input validation warnings.</strong>{" "}
          {data.issues.slice(0, 3).join(" ")}
          {data.issues.length > 3 ? ` (${data.issues.length - 3} more issue(s).)` : ""}
        </div>
      )}
      {!readOnly && (
        <div className="fleet-timeline-warning" role="status">
          Booking editing is not available in this read-only MVP.
        </div>
      )}
      {groups.length === 0 ? (
        <div className="fleet-timeline-empty" role="status">
          No vehicles were provided. Check the Canvas app data mapping.
        </div>
      ) : (
        <>
          {hasCategories && (
            <div className="fleet-category-actions" role="group" aria-label="Vehicle categories">
              <button type="button" onClick={() => setExpandedCategories(new Set(categoryNames))}>
                Expand all
              </button>
              <button type="button" onClick={() => setExpandedCategories(new Set())}>
                Collapse all
              </button>
            </div>
          )}
          {bookingItems.length === 0 && visibleVehicleIds.size > 0 && (
            <div className="fleet-timeline-empty-bookings" role="status">
              No bookings in the supplied data for these vehicles.
            </div>
          )}
          <div className="fleet-timeline-canvas">
            <Timeline
              groups={groups}
              items={items}
              visibleTimeStart={visibleRange.start}
              visibleTimeEnd={visibleRange.end}
              onTimeChange={(start, end, updateScrollCanvas) => {
                updateScrollCanvas(start, end);
                onVisibleRangeChange({ start, end });
              }}
              onItemSelect={(itemId) => {
                if (!String(itemId).startsWith("utilization::")) {
                  onSelectBooking(String(itemId));
                }
              }}
              canMove={false}
              canResize={false}
              stackItems
              itemHeightRatio={0.50}
              sidebarWidth={hasVehicleDetails ? 260 : 230}
              lineHeight={hasVehicleDetails ? 48 : 30}
              groupRenderer={renderGroup}
              verticalLineClassNamesForTime={todayColumnClass}
              minZoom={60 * 60 * 1000}
              maxZoom={366 * 24 * 60 * 60 * 1000}
              buffer={2}
            />
          </div>
        </>
      )}
      <div className="fleet-timeline-legend" aria-label="Booking status legend">
        {Object.entries(statusColors).map(([status, color]) => (
          <span key={status} className="fleet-timeline-legend-item">
            <span className="fleet-timeline-legend-swatch" style={{ backgroundColor: color }} />
            {status}
          </span>
        ))}
      </div>
    </section>
  );
}
