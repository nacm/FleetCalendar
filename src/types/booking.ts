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
}

export interface Booking {
  id: string;
  vehicleId: string;
  title: string;
  start: number;
  end: number;
  status: string;
}

export interface TimelineData {
  vehicles: Vehicle[];
  bookings: Booking[];
  issues: string[];
}

export type StatusColors = Record<string, string>;
