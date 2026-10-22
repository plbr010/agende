"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { canTransitionStatus, type AppointmentStatus } from "@/lib/agenda/status";
import type { PublicBookingConfirmation } from "@/lib/booking/queries";
import { DEMO_STORAGE_KEY, DEMO_TIMEZONE, DEMO_VISITOR, type DemoAppointment, type DemoClient } from "@/lib/demo/catalog";
import { buildAppointments, placeDemoAppointment } from "@/lib/demo/schedule";
import {
  EMPTY_DEMO_SESSION,
  parseDemoSession,
  writeDemoSession,
  type DemoPaymentMethod,
  type DemoSession,
} from "@/lib/demo/session";
import { todayInTimeZone } from "@/lib/time/timezone";

const DEMO_EVENT = "agende-demo-session";

type BookingInput = {
  serviceId: string;
  professionalMemberId: string | null;
  localDate: string;
  startsAt: string;
  fullName: string;
  phone: string;
  email: string;
  customerNote: string | null;
};

type DemoContextValue = {
  ready: boolean;
  today: string;
  session: DemoSession;
  appointments: DemoAppointment[];
  reset: () => void;
  dismissGuide: () => void;
  showGuide: () => void;
  confirmBooking: (input: BookingInput) => Promise<{ error?: string; confirmation?: PublicBookingConfirmation }>;
  setStatus: (appointmentId: string, status: AppointmentStatus) => void;
  markPaid: (entryId: string, method: DemoPaymentMethod) => void;
  addClient: (client: DemoClient) => void;
};

const DemoContext = createContext<DemoContextValue | null>(null);

function emptySubscribe() {
  return () => {};
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener(DEMO_EVENT, onStoreChange);
  return () => window.removeEventListener(DEMO_EVENT, onStoreChange);
}

function readRaw(): string {
  try {
    return window.sessionStorage.getItem(DEMO_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function sessionFromRaw(raw: string): DemoSession {
  if (!raw) return EMPTY_DEMO_SESSION;
  try {
    return parseDemoSession(JSON.parse(raw));
  } catch {
    return EMPTY_DEMO_SESSION;
  }
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const raw = useSyncExternalStore(subscribe, readRaw, () => "");
  const hydrated = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const session = useMemo(() => sessionFromRaw(raw), [raw]);
  const today = todayInTimeZone(DEMO_TIMEZONE);
  const update = useCallback((next: DemoSession) => {
    writeDemoSession(window.sessionStorage, next);
    window.dispatchEvent(new Event(DEMO_EVENT));
  }, []);

  const value = useMemo<DemoContextValue>(() => ({
    ready: hydrated,
    today,
    session,
    appointments: buildAppointments(today, session),
    reset: () => update({ ...EMPTY_DEMO_SESSION }),
    dismissGuide: () => update({ ...session, guideDismissed: true }),
    showGuide: () => update({ ...session, guideDismissed: false }),
    confirmBooking: async (input) => {
      const placed = placeDemoAppointment(today, session, input);
      if (!placed.appointment || !placed.confirmation) {
        return { error: placed.error ?? "Não foi possível confirmar a demonstração." };
      }
      const clients = session.visitorClients.some((client) => client.id === DEMO_VISITOR.id)
        ? session.visitorClients
        : [...session.visitorClients, DEMO_VISITOR];
      update({
        ...session,
        visitorAppointments: [...session.visitorAppointments, placed.appointment],
        visitorClients: clients,
        highlightId: placed.appointment.id,
      });
      return { confirmation: placed.confirmation };
    },
    setStatus: (appointmentId, status) => {
      const appointments = buildAppointments(today, session);
      const target = appointments.find((item) => item.id === appointmentId);
      if (!target || !canTransitionStatus(target.status, status, "owner") || target.status === status) return;
      if (target.source === "visitor") {
        update({
          ...session,
          visitorAppointments: session.visitorAppointments.map((item) => item.id === appointmentId ? { ...item, status } : item),
        });
        return;
      }
      update({ ...session, statusOverrides: { ...session.statusOverrides, [appointmentId]: status } });
    },
    markPaid: (entryId, method) => {
      if (session.paidEntryIds.includes(entryId)) return;
      update({
        ...session,
        paidEntryIds: [...session.paidEntryIds, entryId],
        payments: { ...session.payments, [entryId]: method },
      });
    },
    addClient: (client) => update({ ...session, visitorClients: [...session.visitorClients, client] }),
  }), [hydrated, session, today, update]);

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoContextValue {
  const value = useContext(DemoContext);
  if (!value) throw new Error("useDemo precisa do DemoProvider");
  return value;
}
