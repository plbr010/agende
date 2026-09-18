export const BOOKING_MIN_LEAD_MINUTES = 30;
export const BOOKING_HORIZON_DAYS = 90;
export const CLIENT_CANCEL_LEAD_MINUTES = 120;
export const CUSTOMER_NOTE_MAX = 500;
export const PUBLIC_BOOKING_MAX_PER_HOUR = 5;
export const PUBLIC_BOOKING_MAX_PER_DAY = 8;
export const PUBLIC_BOOKING_MAX_WORKSPACE_PER_HOUR = 40;
export const PUBLIC_BOOKING_MAX_WORKSPACE_PER_DAY = 120;

export const BOOKING_STEPS = [
  "service",
  "professional",
  "date",
  "slot",
  "details",
  "confirm",
] as const;

export type BookingStep = (typeof BOOKING_STEPS)[number];

export const ANY_PROFESSIONAL = "any";
