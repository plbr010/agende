import { MARKETING_CTAS } from "@/lib/marketing/content";

/** Real signup and pricing routes. Prices stay in the marketing catalog. */
export const DEMO_TRIAL_HREF = MARKETING_CTAS.professionalSignup.href;
export const DEMO_PLANS_HREF = "/profissionais#planos";

export const DEMO_CLIENT_HREF = "/demo/cliente";
export const DEMO_BOOK_HREF = "/demo/cliente/agendar";
export const DEMO_PANEL_HREF = "/demo/painel";

export function demoBookHref(serviceId: string | null): string {
  if (!serviceId) return DEMO_BOOK_HREF;
  return `${DEMO_BOOK_HREF}?servico=${encodeURIComponent(serviceId)}`;
}

export function demoAgendaHref(date: string, highlightId?: string | null): string {
  const params = new URLSearchParams({ date, view: "day" });
  if (highlightId) params.set("destaque", highlightId);
  return `/demo/painel/agenda?${params.toString()}`;
}
