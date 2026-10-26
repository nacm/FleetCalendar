import * as React from "react";
import { IInputs, IOutputs } from "./generated/ManifestTypes";
import { BookingTimeline } from "../src/components/BookingTimeline";
import {
  buildDateRange,
  normalizeViewMode,
  parseOffsetDate,
} from "../src/utils/dates";
import { parseTimelineData, parseStatusColors } from "../src/utils/mapping";
import { DateRange, ViewMode } from "../src/types/booking";

export class VehicleBookingTimeline
  implements ComponentFramework.ReactControl<IInputs, IOutputs>
{
  private notifyOutputChanged: () => void = () => undefined;
  private selectedBookingId = "";
  private visibleRange: DateRange = buildDateRange(undefined, "week");
  private actionSequence = 0;
  private lastStartDate = "";
  private lastRawViewMode = "";
  private viewMode: ViewMode = "week";
  private cachedVehiclesJson = "";
  private cachedBookingsJson = "";
  private cachedStatusColorsJson = "";
  private cachedData = parseTimelineData("", "");
  private cachedStatusColors = parseStatusColors("");
  private cachedColorIssues: string[] = [];
  private rangeInputIssues: string[] = [];

  public init(
    context: ComponentFramework.Context<IInputs>,
    notifyOutputChanged: () => void
  ): void {
    this.notifyOutputChanged = notifyOutputChanged;
    context.mode.trackContainerResize(true);
    this.syncInputs(context, false);
    this.notifyOutputChanged();
  }

  public updateView(
    context: ComponentFramework.Context<IInputs>
  ): React.ReactElement {
    this.syncInputs(context, true);

    return React.createElement(BookingTimeline, {
      data: {
        ...this.cachedData,
        issues: [
          ...this.cachedData.issues,
          ...this.cachedColorIssues,
          ...this.rangeInputIssues,
        ],
      },
      statusColors: this.cachedStatusColors,
      viewMode: this.viewMode,
      visibleRange: this.visibleRange,
      selectedBookingId: this.selectedBookingId,
      readOnly: context.parameters.ReadOnly.raw ?? true,
      showVehicleDetails: context.parameters.ShowVehicleDetails.raw ?? false,
      height: context.mode.allocatedHeight > 0 ? context.mode.allocatedHeight : undefined,
      onSelectBooking: this.handleSelectBooking,
      onVisibleRangeChange: this.handleVisibleRangeChange,
      onViewModeChange: this.handleViewModeChange,
    });
  }

  public getOutputs(): IOutputs {
    return {
      SelectedBookingId: this.selectedBookingId,
      VisibleRangeJson: JSON.stringify({
        start: new Date(this.visibleRange.start).toISOString(),
        end: new Date(this.visibleRange.end).toISOString(),
      }),
      ActionSequence: this.actionSequence,
    };
  }

  public destroy(): void {
    this.notifyOutputChanged = () => undefined;
  }

  private syncInputs(
    context: ComponentFramework.Context<IInputs>,
    notifyOnExternalRangeChange: boolean
  ): void {
    const vehiclesJson = context.parameters.VehiclesJson.raw ?? "";
    const bookingsJson = context.parameters.BookingsJson.raw ?? "";
    const statusColorsJson = context.parameters.StatusColorsJson.raw ?? "";

    if (
      vehiclesJson !== this.cachedVehiclesJson ||
      bookingsJson !== this.cachedBookingsJson
    ) {
      this.cachedVehiclesJson = vehiclesJson;
      this.cachedBookingsJson = bookingsJson;
      this.cachedData = parseTimelineData(vehiclesJson, bookingsJson);
    }

    if (statusColorsJson !== this.cachedStatusColorsJson) {
      this.cachedStatusColorsJson = statusColorsJson;
      const colorIssues: string[] = [];
      this.cachedStatusColors = parseStatusColors(
        statusColorsJson,
        colorIssues
      );
      this.cachedColorIssues = colorIssues;
    }

    const startDate = context.parameters.CalendarStartDate.raw ?? "";
    const rawViewMode = context.parameters.ViewMode.raw ?? "";
    const inputViewMode = normalizeViewMode(rawViewMode);
    const startDateChanged = startDate !== this.lastStartDate;
    const rawViewModeChanged = rawViewMode !== this.lastRawViewMode;
    if (startDateChanged || rawViewModeChanged) {
      this.rangeInputIssues = [];
      if (startDate.length > 0 && parseOffsetDate(startDate) === undefined) {
        this.rangeInputIssues.push(
          "CalendarStartDate must include an explicit ISO 8601 timezone; the current local date is being used."
        );
      }
      if (
        rawViewMode.trim().length > 0 &&
        !["day", "week", "month"].includes(rawViewMode.trim().toLowerCase())
      ) {
        this.rangeInputIssues.push(
          `ViewMode "${rawViewMode}" is unsupported; week view is being used.`
        );
      }

      const nextViewMode = rawViewModeChanged
        ? inputViewMode
        : this.viewMode;
      const nextRange = buildDateRange(startDate, nextViewMode);
      const changed =
        nextRange.start !== this.visibleRange.start ||
        nextRange.end !== this.visibleRange.end;
      this.lastStartDate = startDate;
      this.lastRawViewMode = rawViewMode;
      this.viewMode = nextViewMode;
      this.visibleRange = nextRange;

      if (changed && notifyOnExternalRangeChange) {
        this.actionSequence += 1;
        this.notifyOutputChanged();
      }
    }
  }

  private handleSelectBooking = (bookingId: string): void => {
    this.selectedBookingId = bookingId;
    this.actionSequence += 1;
    this.notifyOutputChanged();
  };

  private handleVisibleRangeChange = (range: DateRange): void => {
    if (
      range.start === this.visibleRange.start &&
      range.end === this.visibleRange.end
    ) {
      return;
    }

    this.visibleRange = range;
    this.actionSequence += 1;
    this.notifyOutputChanged();
  };

  private handleViewModeChange = (viewMode: ViewMode): void => {
    this.viewMode = viewMode;
    this.visibleRange = buildDateRange(
      new Date(this.visibleRange.start).toISOString(),
      viewMode
    );
    this.actionSequence += 1;
    this.notifyOutputChanged();
  };
}
