import { formatTimeInTimeZone } from "@/lib/time/timezone";

export function buildWhatsAppLink(phoneE164: string | null | undefined, text: string): string | null {
  if (!phoneE164) {
    return null;
  }
  const digits = phoneE164.replace(/\D/g, "");
  if (digits.length < 12) {
    return null;
  }
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function bookingWhatsAppText(input: {
  serviceName: string;
  startsAt: string;
  timezone: string;
}): string {
  const when = new Intl.DateTimeFormat("pt-BR", {
    timeZone: input.timezone,
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(input.startsAt));
  return `Olá! Acabei de agendar ${input.serviceName} para ${when} pelo Agendê.`;
}

export function buildIcs(input: {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  location?: string | null;
}): string {
  const stamp = (iso: string) =>
    new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const escape = (value: string) =>
    value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Agende//Booking//PT",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(input.startsAt)}`,
    `DTEND:${stamp(input.endsAt)}`,
    `SUMMARY:${escape(input.title)}`,
    `DESCRIPTION:${escape(input.description)}`,
    input.location ? `LOCATION:${escape(input.location)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

export function icsDataUrl(ics: string): string {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

export function googleCalendarUrl(input: {
  title: string;
  details: string;
  startsAt: string;
  endsAt: string;
}): string {
  const fmt = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    details: input.details,
    dates: `${fmt(input.startsAt)}/${fmt(input.endsAt)}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function formatSlotLabel(startsAt: string, timezone: string): string {
  return formatTimeInTimeZone(startsAt, timezone);
}
