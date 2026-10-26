import * as React from "react";
import Timeline, { TimelineGroupBase, TimelineItemBase } from "react-calendar-timeline";
import { Booking, DateRange, StatusColors, TimelineData, ViewMode } from "../types/booking";
import { buildDateRange, moveDateRange } from "../utils/dates";
import { getStatusColor, getStatusTextColor } from "../utils/mapping";
import { TimelineToolbar } from "./TimelineToolbar";
import "react-calendar-timeline/lib/Timeline.css";

interface TimelineGroup extends TimelineGroupBase {
  id: string;
  title: string;
}

interface TimelineItem extends TimelineItemBase<number> {
  id: string;
  group: string;
  title: string;
  start_time: number;
  end_time: number;
}

interface BookingTimelineProps {
  data: TimelineData;
  statusColors: StatusColors;
  viewMode: ViewMode;
  visibleRange: DateRange;
  selectedBookingId: string;
  readOnly: boolean;
  height?: number;
  onSelectBooking: (bookingId: string) => void;
  onVisibleRangeChange: (range: DateRange) => void;
  onViewModeChange: (mode: ViewMode) => void;
}

function formatBookingLabel(booking: Booking): string {
  return `${booking.title} · ${booking.status}`;
}

export function BookingTimeline({
  data,
  statusColors,
  viewMode,
  visibleRange,
  selectedBookingId,
  readOnly,
  height,
  onSelectBooking,
  onVisibleRangeChange,
  onViewModeChange,
}: BookingTimelineProps): React.ReactElement {
  const groups = React.useMemo<TimelineGroup[]>(
    () =>
      data.vehicles.map((vehicle) => ({
        id: vehicle.id,
        title: vehicle.registration
          ? `${vehicle.title} · ${vehicle.registration}`
          : vehicle.title,
      })),
    [data.vehicles]
  );

  const vehicleTitles = React.useMemo(
    () => new Map(data.vehicles.map((vehicle) => [vehicle.id, vehicle.title])),
    [data.vehicles]
  );

  const items = React.useMemo<TimelineItem[]>(
    () =>
      data.bookings.map((booking) => {
        const fullLabel = `${booking.title}; ${booking.status}; ${
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
    ]
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
          {items.length === 0 && (
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
              onItemSelect={(itemId) => onSelectBooking(String(itemId))}
              canMove={false}
              canResize={false}
              stackItems
              itemHeightRatio={0.78}
              sidebarWidth={230}
              lineHeight={48}
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
