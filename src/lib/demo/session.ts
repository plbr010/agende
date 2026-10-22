import { APPOINTMENT_STATUSES, type AppointmentStatus } from "@/lib/agenda/status";
import {
  DEMO_STORAGE_KEY,
  type DemoAppointment,
  type DemoClient,
} from "@/lib/demo/catalog";

const PAYMENT_METHODS = ["cash", "pix", "debit_card", "credit_card", "bank_transfer", "other"] as const;
export type DemoPaymentMethod = (typeof PAYMENT_METHODS)[number];

export type DemoSession = {
  version: 1;
  visitorAppointments: DemoAppointment[];
  visitorClients: DemoClient[];
  statusOverrides: Record<string, AppointmentStatus>;
  paidEntryIds: string[];
  payments: Record<string, DemoPaymentMethod>;
  highlightId: string | null;
  guideDismissed: boolean;
};

export const EMPTY_DEMO_SESSION: DemoSession = {
  version: 1,
  visitorAppointments: [],
  visitorClients: [],
  statusOverrides: {},
  paidEntryIds: [],
  payments: {},
  highlightId: null,
  guideDismissed: false,
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^\d{2}:\d{2}$/;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function isStatus(value: unknown): value is AppointmentStatus {
  return typeof value === "string" && (APPOINTMENT_STATUSES as readonly string[]).includes(value);
}

function isMethod(value: unknown): value is DemoPaymentMethod {
  return typeof value === "string" && (PAYMENT_METHODS as readonly string[]).includes(value);
}

function readAppointment(value: unknown): DemoAppointment | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (!isUuid(row.id) || !isUuid(row.clientId) || !isUuid(row.professionalMemberId) || !isUuid(row.serviceId)) return null;
  if (typeof row.clientName !== "string" || typeof row.professionalName !== "string" || typeof row.serviceName !== "string") return null;
  if (typeof row.startsAt !== "string" || typeof row.endsAt !== "string" || Number.isNaN(Date.parse(row.startsAt))) return null;
  if (!isStatus(row.status) || row.source !== "visitor") return null;
  if (typeof row.priceCents !== "number" || typeof row.durationMinutes !== "number") return null;
  if (typeof row.localDate !== "string" || !ISO_DATE.test(row.localDate)) return null;
  if (typeof row.localStart !== "string" || !HHMM.test(row.localStart)) return null;
  if (typeof row.localEnd !== "string" || !HHMM.test(row.localEnd)) return null;
  if (row.financeEntryId !== null && !isUuid(row.financeEntryId)) return null;
  return {
    id: row.id,
    clientId: row.clientId,
    clientName: row.clientName.slice(0, 120),
    professionalMemberId: row.professionalMemberId,
    professionalName: row.professionalName.slice(0, 120),
    serviceId: row.serviceId,
    serviceName: row.serviceName.slice(0, 120),
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    status: row.status,
    priceCents: Math.max(0, Math.round(row.priceCents)),
    durationMinutes: Math.max(1, Math.round(row.durationMinutes)),
    notes: typeof row.notes === "string" ? row.notes.slice(0, 500) : null,
    localDate: row.localDate,
    localStart: row.localStart,
    localEnd: row.localEnd,
    source: "visitor",
    settledByPackage: false,
    financeEntryId: row.financeEntryId,
  };
}

function readClient(value: unknown): DemoClient | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (!isUuid(row.id) || typeof row.fullName !== "string" || row.fullName.trim().length < 2) return null;
  return {
    id: row.id,
    fullName: row.fullName.trim().slice(0, 120),
    email: typeof row.email === "string" ? row.email.slice(0, 160) : null,
    phone: typeof row.phone === "string" ? row.phone.slice(0, 20) : null,
    birthDate: typeof row.birthDate === "string" && ISO_DATE.test(row.birthDate) ? row.birthDate : null,
    notes: typeof row.notes === "string" ? row.notes.slice(0, 500) : null,
    source: "visitor",
  };
}

export function parseDemoSession(raw: unknown): DemoSession {
  if (!raw || typeof raw !== "object") return { ...EMPTY_DEMO_SESSION };
  const row = raw as Record<string, unknown>;
  if (row.version !== 1) return { ...EMPTY_DEMO_SESSION };
  const visitorAppointments = Array.isArray(row.visitorAppointments)
    ? row.visitorAppointments.flatMap((item) => {
        const appointment = readAppointment(item);
        return appointment ? [appointment] : [];
      }).slice(0, 24)
    : [];
  const visitorClients = Array.isArray(row.visitorClients)
    ? row.visitorClients.flatMap((item) => {
        const client = readClient(item);
        return client ? [client] : [];
      }).slice(0, 24)
    : [];
  const statusOverrides: Record<string, AppointmentStatus> = {};
  if (row.statusOverrides && typeof row.statusOverrides === "object") {
    for (const [key, value] of Object.entries(row.statusOverrides).slice(0, 40)) {
      if (isUuid(key) && isStatus(value)) statusOverrides[key] = value;
    }
  }
  const paidEntryIds = Array.isArray(row.paidEntryIds)
    ? row.paidEntryIds.filter(isUuid).slice(0, 40)
    : [];
  const payments: Record<string, DemoPaymentMethod> = {};
  if (row.payments && typeof row.payments === "object") {
    for (const [key, value] of Object.entries(row.payments).slice(0, 40)) {
      if (isUuid(key) && isMethod(value)) payments[key] = value;
    }
  }
  return {
    version: 1,
    visitorAppointments,
    visitorClients,
    statusOverrides,
    paidEntryIds,
    payments,
    highlightId: isUuid(row.highlightId) ? row.highlightId : null,
    guideDismissed: row.guideDismissed === true,
  };
}

export function readDemoSession(storage: Pick<Storage, "getItem"> | null): DemoSession {
  if (!storage) return { ...EMPTY_DEMO_SESSION };
  try {
    const raw = storage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return { ...EMPTY_DEMO_SESSION };
    return parseDemoSession(JSON.parse(raw));
  } catch {
    return { ...EMPTY_DEMO_SESSION };
  }
}

export function writeDemoSession(storage: Pick<Storage, "setItem"> | null, session: DemoSession): void {
  if (!storage) return;
  try {
    storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // A full or blocked session store only drops the demo memory. Production data is untouched.
  }
}
