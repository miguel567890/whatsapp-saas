export type AppointmentStatus =
  | "booked"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show";

export const ACTIVE_STATUSES: AppointmentStatus[] = ["booked", "confirmed"];

export interface BookingSettings {
  workspace_id: string;
  slot_step_min: number;
  min_notice_min: number;
  max_days_ahead: number;
  reminders_enabled: boolean;
  reminder_hours_before: number;
  reminder_template_name: string | null;
  reminder_template_language: string;
}

export const DEFAULT_BOOKING_SETTINGS: Omit<BookingSettings, "workspace_id"> = {
  slot_step_min: 15,
  min_notice_min: 60,
  max_days_ahead: 30,
  reminders_enabled: true,
  reminder_hours_before: 24,
  reminder_template_name: null,
  reminder_template_language: "es",
};

export interface BookingService {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  duration_min: number;
  price: number | null;
  active: boolean;
  sort_order: number;
}

export interface BookingHoursRow {
  id?: string;
  staff_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
}

export interface BookingStaff {
  id: string;
  workspace_id: string;
  name: string;
  active: boolean;
  sort_order: number;
  service_ids: string[];
  hours: BookingHoursRow[];
}

export interface BookingTimeOff {
  id: string;
  workspace_id: string;
  staff_id: string | null;
  starts_at: string;
  ends_at: string;
  reason: string | null;
}

export interface AppointmentRow {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  conversation_id: string | null;
  service_id: string | null;
  staff_id: string | null;
  scheduled_at: string;
  ends_at: string | null;
  status: AppointmentStatus;
  customer_name: string | null;
  customer_phone: string | null;
  notes: string | null;
  source: "agent" | "manual" | "highlevel";
  reminder_sent_at: string | null;
  created_at: string;
}

export interface BookingConfig {
  settings: BookingSettings;
  services: BookingService[];
  staff: BookingStaff[];
  timeOff: BookingTimeOff[];
  timeZone: string;
  /** false si el negocio no ha elegido zona horaria (el agente usaría otra por defecto). */
  timeZoneSet?: boolean;
}
