import { BOOKING_HORIZON_DAYS, BOOKING_MIN_LEAD_MINUTES } from "@/lib/booking/config";
import type { PublicBookingCatalog } from "@/lib/booking/queries";
import type { AppointmentStatus } from "@/lib/agenda/status";
import type { PublicWorkspaceProfile } from "@/lib/workspace/public";

/** Stable UUID-shaped ids. They never leave the browser and are not queried. */
export function demoId(n: number): string {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

export const DEMO_TIMEZONE = "America/Sao_Paulo";
export const DEMO_SLUG = "studio-bella-demonstracao";
export const DEMO_NAME = "Studio Bella — Demonstração";
export const DEMO_OPEN_WEEKDAYS = [2, 3, 4, 5, 6] as const;
export const DEMO_DAY_START = "09:00";
export const DEMO_DAY_END = "18:00";
export const DEMO_BREAK_START = "12:00";
export const DEMO_BREAK_END = "13:00";
export const DEMO_STORAGE_KEY = "agende-demo-session-v1";

export const DEMO_IDS = {
  corte: demoId(1),
  escova: demoId(2),
  manicure: demoId(3),
  pedicure: demoId(4),
  sobrancelha: demoId(5),
  hidratacao: demoId(6),
  marina: demoId(11),
  ana: demoId(12),
  livia: demoId(13),
  camila: demoId(21),
  helena: demoId(22),
  rita: demoId(23),
  beatriz: demoId(24),
  olivia: demoId(25),
  visitor: demoId(90),
  apptOlder: demoId(31),
  apptHidra: demoId(32),
  apptManicure: demoId(33),
  apptPedicure: demoId(34),
  apptEscova: demoId(35),
  apptSobrancelha: demoId(36),
  apptCancelled: demoId(37),
  apptNoShow: demoId(38),
  financeOlder: demoId(41),
  financeHidra: demoId(42),
  financePackage: demoId(43),
  financeEsmalte: demoId(44),
  financeLuz: demoId(45),
  esmalte: demoId(51),
  henna: demoId(52),
  mascara: demoId(53),
  algodao: demoId(54),
  packageManicure: demoId(61),
  saleHelena: demoId(62),
  moveEsmalte: demoId(71),
} as const;

export type DemoService = {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  priceCents: number;
};

export type DemoProfessional = {
  id: string;
  displayName: string;
  bio: string;
  role: "owner" | "professional";
  serviceIds: string[];
};

export type DemoClient = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  notes: string | null;
  source: "seed" | "visitor";
};

export type DemoAppointment = {
  id: string;
  clientId: string;
  clientName: string;
  professionalMemberId: string;
  professionalName: string;
  serviceId: string;
  serviceName: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  priceCents: number;
  durationMinutes: number;
  notes: string | null;
  localDate: string;
  localStart: string;
  localEnd: string;
  source: "seed" | "visitor";
  settledByPackage: boolean;
  financeEntryId: string | null;
};

export type DemoProduct = {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  unit: "unidade" | "ml" | "g";
  quantity: number;
  minimumQuantity: number;
  costCents: number | null;
};

export type DemoMovement = {
  id: string;
  productName: string;
  label: string;
  quantityDelta: number;
  note: string | null;
  /** Days before today, resolved when the view is built. */
  daysBeforeToday: number;
};

export const DEMO_SERVICES: readonly DemoService[] = [
  { id: DEMO_IDS.corte, name: "Corte feminino", description: "Corte com lavagem e finalização simples.", durationMinutes: 60, priceCents: 12000 },
  { id: DEMO_IDS.escova, name: "Escova", description: "Escova modelada no comprimento do cabelo.", durationMinutes: 45, priceCents: 9000 },
  { id: DEMO_IDS.manicure, name: "Manicure", description: "Cutilagem e esmaltação das mãos.", durationMinutes: 50, priceCents: 4500 },
  { id: DEMO_IDS.pedicure, name: "Pedicure", description: "Cuidado dos pés e esmaltação.", durationMinutes: 50, priceCents: 5500 },
  { id: DEMO_IDS.sobrancelha, name: "Design de sobrancelhas", description: "Desenho e alinhamento das sobrancelhas.", durationMinutes: 30, priceCents: 4000 },
  { id: DEMO_IDS.hidratacao, name: "Hidratação capilar", description: "Tratamento de hidratação com pausa.", durationMinutes: 70, priceCents: 15000 },
];

export const DEMO_PROFESSIONALS: readonly DemoProfessional[] = [
  {
    id: DEMO_IDS.marina,
    displayName: "Marina Costa",
    bio: "Cortes, escova e tratamento capilar.",
    role: "owner",
    serviceIds: [DEMO_IDS.corte, DEMO_IDS.escova, DEMO_IDS.hidratacao],
  },
  {
    id: DEMO_IDS.ana,
    displayName: "Ana Luz",
    bio: "Unhas das mãos e dos pés.",
    role: "professional",
    serviceIds: [DEMO_IDS.manicure, DEMO_IDS.pedicure],
  },
  {
    id: DEMO_IDS.livia,
    displayName: "Lívia Pires",
    bio: "Sobrancelhas e manicure.",
    role: "professional",
    serviceIds: [DEMO_IDS.sobrancelha, DEMO_IDS.manicure],
  },
];

export const DEMO_CLIENTS: readonly DemoClient[] = [
  { id: DEMO_IDS.camila, fullName: "Camila Duarte", email: "camila.duarte@exemplo.agende.test", phone: "11900000001", birthDate: null, notes: "Prefere corte na altura do ombro. Dado fictício.", source: "seed" },
  { id: DEMO_IDS.helena, fullName: "Helena Prado", email: "helena.prado@exemplo.agende.test", phone: "11900000002", birthDate: null, notes: "Usa o pacote de manicure. Dado fictício.", source: "seed" },
  { id: DEMO_IDS.rita, fullName: "Rita Nogueira", email: "rita.nogueira@exemplo.agende.test", phone: "11900000003", birthDate: null, notes: "Chega alguns minutos antes. Dado fictício.", source: "seed" },
  { id: DEMO_IDS.beatriz, fullName: "Beatriz Lemos", email: "beatriz.lemos@exemplo.agende.test", phone: "11900000004", birthDate: null, notes: null, source: "seed" },
  { id: DEMO_IDS.olivia, fullName: "Olívia Martins", email: "olivia.martins@exemplo.agende.test", phone: "11900000005", birthDate: null, notes: "Gosta de um desenho mais marcado na sobrancelha. Dado fictício.", source: "seed" },
];

export const DEMO_VISITOR: DemoClient = {
  id: DEMO_IDS.visitor,
  fullName: "Visitante Demonstração",
  email: null,
  phone: null,
  birthDate: null,
  notes: "Pessoa que está experimentando a demonstração neste navegador. Não é uma cliente real.",
  source: "visitor",
};

export const DEMO_PRODUCTS: readonly DemoProduct[] = [
  { id: DEMO_IDS.esmalte, name: "Esmalte rosa nude", description: "Cor de demonstração.", sku: "DEMO-ESM-01", unit: "unidade", quantity: 12, minimumQuantity: 6, costCents: 890 },
  { id: DEMO_IDS.henna, name: "Henna para sobrancelha", description: null, sku: "DEMO-HEN-01", unit: "unidade", quantity: 2, minimumQuantity: 4, costCents: 2400 },
  { id: DEMO_IDS.mascara, name: "Máscara de hidratação", description: null, sku: "DEMO-MAS-01", unit: "unidade", quantity: 3, minimumQuantity: 2, costCents: 4500 },
  { id: DEMO_IDS.algodao, name: "Algodão", description: null, sku: "DEMO-ALG-01", unit: "unidade", quantity: 0, minimumQuantity: 5, costCents: 1200 },
];

export const DEMO_MOVEMENTS: readonly DemoMovement[] = [
  { id: DEMO_IDS.moveEsmalte, productName: "Esmalte rosa nude", label: "Entrada", quantityDelta: 6, note: "Compra fictícia para a demonstração.", daysBeforeToday: 2 },
];

export const DEMO_REVIEWS: readonly { appointmentId: string; rating: number; comment: string }[] = [
  { appointmentId: DEMO_IDS.apptOlder, rating: 5, comment: "Corte no ponto e sem pressa. Comentário fictício." },
  { appointmentId: DEMO_IDS.apptManicure, rating: 4, comment: "Esmalte durou bem a semana. Comentário fictício." },
];

export const DEMO_PACKAGE = {
  id: DEMO_IDS.packageManicure,
  name: "Manicure mensal",
  description: "Quatro manicures para usar no estúdio. Pacote fictício.",
  priceCents: 16000,
  validityDays: 60,
  serviceId: DEMO_IDS.manicure,
  serviceName: "Manicure",
  sessions: 4,
  saleId: DEMO_IDS.saleHelena,
  clientId: DEMO_IDS.helena,
  clientName: "Helena Prado",
  financeEntryId: DEMO_IDS.financePackage,
  used: 1,
} as const;

export const DEMO_EXPENSES = [
  { id: DEMO_IDS.financeEsmalte, title: "Reposição de esmaltes", amountCents: 8600, category: "Produtos", method: "cash" as const, paid: true, daysBeforeToday: 1 },
  { id: DEMO_IDS.financeLuz, title: "Conta de luz do estúdio", amountCents: 21000, category: "Contas", method: null, paid: false, daysBeforeToday: 0 },
] as const;

export const DEMO_DEFAULT_PAID_ENTRY_IDS = new Set<string>([
  DEMO_IDS.financeOlder,
  DEMO_IDS.financeHidra,
  DEMO_IDS.financePackage,
  DEMO_IDS.financeEsmalte,
]);

export function serviceById(id: string): DemoService | undefined {
  return DEMO_SERVICES.find((service) => service.id === id);
}

export function professionalById(id: string): DemoProfessional | undefined {
  return DEMO_PROFESSIONALS.find((person) => person.id === id);
}

export function demoPublicCatalog(): PublicBookingCatalog {
  return {
    name: DEMO_NAME,
    slug: DEMO_SLUG,
    timezone: DEMO_TIMEZONE,
    logoUrl: null,
    horizonDays: BOOKING_HORIZON_DAYS,
    minLeadMinutes: BOOKING_MIN_LEAD_MINUTES,
    services: DEMO_SERVICES.map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      durationMinutes: service.durationMinutes,
      priceCents: service.priceCents,
      minPriceCents: service.priceCents,
      maxPriceCents: service.priceCents,
    })),
    professionals: DEMO_PROFESSIONALS.map((person) => ({
      id: person.id,
      displayName: person.displayName,
      bio: person.bio,
      photoUrl: null,
      serviceIds: [...person.serviceIds],
      offerings: person.serviceIds.flatMap((serviceId) => {
        const service = serviceById(serviceId);
        if (!service) return [];
        return [{ serviceId, priceCents: service.priceCents, durationMinutes: service.durationMinutes }];
      }),
    })),
  };
}

export function demoPublicProfile(): PublicWorkspaceProfile {
  return {
    workspaceId: null,
    name: DEMO_NAME,
    slug: DEMO_SLUG,
    description: "Estúdio fictício para experimentar o Agendê. Nenhum horário daqui é um agendamento real.",
    address: "Rua das Acácias, 120 — endereço fictício",
    city: "Cidade Demonstração",
    state: "MG",
    instagram: null,
    logo_path: null,
    logoUrl: null,
    coverUrl: null,
    photos: [],
    averageRating: 4.5,
    reviewCount: DEMO_REVIEWS.length,
    services: DEMO_SERVICES.map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      duration_minutes: service.durationMinutes,
      price_cents: service.priceCents,
      min_price_cents: service.priceCents,
      max_price_cents: service.priceCents,
    })),
    professionals: DEMO_PROFESSIONALS.map((person) => ({
      id: person.id,
      display_name: person.displayName,
      bio: person.bio,
      services: person.serviceIds.flatMap((serviceId) => serviceById(serviceId)?.name ?? []),
      photoUrl: null,
    })),
  };
}
