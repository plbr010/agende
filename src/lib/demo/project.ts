import type { AdvancedReport } from "@/lib/reports/queries";
import { addDaysIso } from "@/lib/time/timezone";
import {
  DEMO_CLIENTS,
  DEMO_DEFAULT_PAID_ENTRY_IDS,
  DEMO_EXPENSES,
  DEMO_MOVEMENTS,
  DEMO_PACKAGE,
  DEMO_PRODUCTS,
  DEMO_REVIEWS,
  DEMO_TIMEZONE,
  DEMO_VISITOR,
  type DemoAppointment,
  type DemoClient,
} from "@/lib/demo/catalog";
import { adjacentOpenDay } from "@/lib/demo/schedule";
import type { DemoPaymentMethod, DemoSession } from "@/lib/demo/session";

export type DemoEntry = {
  id: string;
  title: string;
  kind: "income" | "expense";
  status: "pending" | "paid" | "cancelled";
  amountCents: number;
  categoryLabel: string;
  clientName: string | null;
  dueDate: string;
  paymentMethodLabel: string | null;
  source: "appointment" | "package_sale" | "manual";
};

const METHOD_LABEL: Record<DemoPaymentMethod, string> = {
  pix: "Pix",
  cash: "Dinheiro",
  debit_card: "Cartão de débito",
  credit_card: "Cartão de crédito",
  bank_transfer: "Transferência",
  other: "Outro",
};

export function demoClients(session: DemoSession, appointments: readonly DemoAppointment[]): DemoClient[] {
  const extras = [...session.visitorClients];
  if (appointments.some((item) => item.clientId === DEMO_VISITOR.id) && !extras.some((client) => client.id === DEMO_VISITOR.id)) {
    extras.push(DEMO_VISITOR);
  }
  return [...DEMO_CLIENTS, ...extras].sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"));
}

function paidState(id: string, session: DemoSession, fallbackMethod: DemoPaymentMethod | null, initiallyPaid: boolean) {
  const marked = session.paidEntryIds.includes(id);
  const paid = initiallyPaid || marked;
  const method = session.payments[id] ?? (paid ? fallbackMethod : null);
  return {
    status: paid ? "paid" as const : "pending" as const,
    paymentMethodLabel: paid && method ? METHOD_LABEL[method] : null,
  };
}

export function demoEntries(today: string, session: DemoSession, appointments: readonly DemoAppointment[]): DemoEntry[] {
  const entries: DemoEntry[] = [];
  for (const appointment of appointments) {
    if (appointment.status !== "completed" || appointment.settledByPackage || !appointment.financeEntryId) continue;
    const state = paidState(
      appointment.financeEntryId,
      session,
      "pix",
      DEMO_DEFAULT_PAID_ENTRY_IDS.has(appointment.financeEntryId),
    );
    entries.push({
      id: appointment.financeEntryId,
      title: "Atendimento concluído",
      kind: "income",
      amountCents: appointment.priceCents,
      categoryLabel: "Atendimentos",
      clientName: appointment.clientName,
      dueDate: appointment.localDate,
      source: "appointment",
      ...state,
    });
  }
  const saleDate = adjacentOpenDay(today, -1, 1);
  const sale = paidState(DEMO_PACKAGE.financeEntryId, session, "pix", true);
  entries.push({
    id: DEMO_PACKAGE.financeEntryId,
    title: `Venda de pacote: ${DEMO_PACKAGE.name}`,
    kind: "income",
    amountCents: DEMO_PACKAGE.priceCents,
    categoryLabel: "Pacotes",
    clientName: DEMO_PACKAGE.clientName,
    dueDate: saleDate,
    source: "package_sale",
    ...sale,
  });
  for (const expense of DEMO_EXPENSES) {
    const state = paidState(expense.id, session, expense.method, expense.paid);
    entries.push({
      id: expense.id,
      title: expense.title,
      kind: "expense",
      amountCents: expense.amountCents,
      categoryLabel: expense.category,
      clientName: null,
      dueDate: addDaysIso(today, -expense.daysBeforeToday),
      source: "manual",
      ...state,
    });
  }
  return entries.sort((a, b) => b.dueDate.localeCompare(a.dueDate) || a.title.localeCompare(b.title, "pt-BR"));
}

export function entriesInPeriod(entries: readonly DemoEntry[], startDate: string, endDate: string): DemoEntry[] {
  return entries.filter((entry) => entry.dueDate >= startDate && entry.dueDate <= endDate);
}

export function financeSummary(entries: readonly DemoEntry[]) {
  const paidRevenueCents = sum(entries, (entry) => entry.kind === "income" && entry.status === "paid");
  const paidExpenseCents = sum(entries, (entry) => entry.kind === "expense" && entry.status === "paid");
  const pendingCents = sum(entries, (entry) => entry.status === "pending");
  return {
    paidRevenueCents,
    paidExpenseCents,
    pendingCents,
    refundedCents: 0,
    balanceCents: paidRevenueCents - paidExpenseCents,
  };
}

function sum(entries: readonly DemoEntry[], include: (entry: DemoEntry) => boolean): number {
  return entries.reduce((total, entry) => total + (include(entry) ? entry.amountCents : 0), 0);
}

export function inventorySummary() {
  const active = DEMO_PRODUCTS;
  return {
    products: active.length,
    lowStock: active.filter((product) => product.quantity > 0 && product.quantity <= product.minimumQuantity).length,
    outOfStock: active.filter((product) => product.quantity === 0).length,
    estimatedCostCents: active.reduce((total, product) => total + product.quantity * (product.costCents ?? 0), 0),
  };
}

export function demoReport(
  today: string,
  appointments: readonly DemoAppointment[],
  entries: readonly DemoEntry[],
  period: { startDate: string; endDate: string },
): AdvancedReport {
  const inPeriod = appointments.filter((item) => item.localDate >= period.startDate && item.localDate <= period.endDate);
  const completed = inPeriod.filter((item) => item.status === "completed");
  const cancelled = inPeriod.filter((item) => item.status === "cancelled").length;
  const noShow = inPeriod.filter((item) => item.status === "no_show").length;
  const total = inPeriod.length;
  const completedValue = completed.reduce((totalCents, item) => totalCents + item.priceCents, 0);
  const rate = (count: number) => (total === 0 ? 0 : Math.round((count / total) * 100));
  const firstVisit = new Map<string, string>();
  for (const item of appointments) {
    const current = firstVisit.get(item.clientId);
    if (!current || item.localDate < current) firstVisit.set(item.clientId, item.localDate);
  }
  const unique = [...new Set(inPeriod.map((item) => item.clientId))];
  const newClients = unique.filter((id) => (firstVisit.get(id) ?? period.startDate) >= period.startDate).length;
  const byProfessional = new Map<string, { professionalMemberId: string; professionalName: string; completedCount: number; serviceValueCents: number }>();
  for (const item of completed) {
    const current = byProfessional.get(item.professionalMemberId) ?? {
      professionalMemberId: item.professionalMemberId,
      professionalName: item.professionalName,
      completedCount: 0,
      serviceValueCents: 0,
    };
    current.completedCount += 1;
    current.serviceValueCents += item.priceCents;
    byProfessional.set(item.professionalMemberId, current);
  }
  const periodEntries = entriesInPeriod(entries, period.startDate, period.endDate);
  const categories = new Map<string, { entryType: "income" | "expense"; categoryName: string; paidCents: number; pendingCents: number }>();
  for (const entry of periodEntries) {
    if (entry.status === "cancelled") continue;
    const key = `${entry.kind}:${entry.categoryLabel}`;
    const current = categories.get(key) ?? { entryType: entry.kind, categoryName: entry.categoryLabel, paidCents: 0, pendingCents: 0 };
    if (entry.status === "paid") current.paidCents += entry.amountCents;
    if (entry.status === "pending") current.pendingCents += entry.amountCents;
    categories.set(key, current);
  }
  const stock = inventorySummary();
  const packageSaleInPeriod = periodEntries.some((entry) => entry.id === DEMO_PACKAGE.financeEntryId);
  return {
    period: { startDate: period.startDate, endDate: period.endDate, timezone: DEMO_TIMEZONE },
    operations: {
      appointmentsTotal: total,
      completed: completed.length,
      cancelled,
      noShow,
      completionRatePct: rate(completed.length),
      cancellationRatePct: rate(cancelled),
      noShowRatePct: rate(noShow),
      averageServiceTicketCents: completed.length ? Math.round(completedValue / completed.length) : 0,
      completedServiceValueCents: completedValue,
    },
    clients: {
      uniqueClients: unique.length,
      newClients,
      repeatClients: unique.length - newClients,
    },
    topProfessionals: [...byProfessional.values()].sort((a, b) => b.completedCount - a.completedCount || a.professionalName.localeCompare(b.professionalName, "pt-BR")),
    financeByCategory: [...categories.values()].map((category) => ({
      ...category,
      refundedCents: 0,
      netCents: category.paidCents,
    })),
    paymentMethods: [],
    packages: {
      sold: packageSaleInPeriod ? 1 : 0,
      redemptions: completed.filter((item) => item.settledByPackage).length,
      reversedRedemptions: 0,
    },
    inventory: {
      activeProducts: stock.products,
      lowStock: stock.lowStock,
      outOfStock: stock.outOfStock,
      estimatedStockCostCents: stock.estimatedCostCents,
    },
  };
}

export function demoReviews(appointments: readonly DemoAppointment[]) {
  return DEMO_REVIEWS.flatMap((review) => {
    const appointment = appointments.find((item) => item.id === review.appointmentId);
    if (!appointment) return [];
    return [{
      ...review,
      clientName: appointment.clientName,
      serviceName: appointment.serviceName,
      professionalName: appointment.professionalName,
      createdAt: appointment.endsAt,
    }];
  });
}

export function movementWhen(today: string, daysBeforeToday: number): string {
  return `${addDaysIso(today, -daysBeforeToday)}T15:00:00.000Z`;
}

export { DEMO_MOVEMENTS, DEMO_PRODUCTS, DEMO_PACKAGE };
