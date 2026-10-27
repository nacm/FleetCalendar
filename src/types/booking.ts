export type ViewMode = "day" | "week" | "month";

export interface DateRange {
  start: number;
  end: number;
}

export interface Vehicle {
  id: string;
  title: string;
  registration?: string;
  branch?: string;
  condition?: string;
  make?: string;
  model?: string;
  year?: string;
  category?: string;
  currentLocation?: string;
}

export interface Booking {
  id: string;
  vehicleId: string;
  title: string;
  start: number;
  end: number;
  status: string;
}

export interface MaintenanceJob {
  id: string;
  vehicleId: string;
  title?: string;
  status: string;
}

export interface TimelineData {
  vehicles: Vehicle[];
  bookings: Booking[];
  issues: string[];
}

export type StatusColors = Record<string, string>;
