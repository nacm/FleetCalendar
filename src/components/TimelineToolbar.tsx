import * as React from "react";
import { ViewMode } from "../types/booking";

interface TimelineToolbarProps {
  viewMode: ViewMode;
  onNavigate: (direction: -1 | 1) => void;
  onToday: () => void;
  onViewModeChange: (mode: ViewMode) => void;
}

const viewModes: ViewMode[] = [ "week", "month"];

export function TimelineToolbar({
  viewMode,
  onNavigate,
  onToday,
  onViewModeChange,
}: TimelineToolbarProps): React.ReactElement {
  return (
    <div className="fleet-timeline-toolbar" role="toolbar" aria-label="Calendar navigation">
      <div className="fleet-timeline-navigation">
        <button type="button" onClick={() => onNavigate(-1)} aria-label="Previous period">
          Previous
        </button>
        <button type="button" onClick={onToday}>
          Today
        </button>
        <button type="button" onClick={() => onNavigate(1)} aria-label="Next period">
          Next
        </button>
      </div>
      <div className="fleet-timeline-view-modes" role="group" aria-label="Calendar view">
        {viewModes.map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={viewMode === mode}
            onClick={() => onViewModeChange(mode)}
          >
            {mode[0].toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}
