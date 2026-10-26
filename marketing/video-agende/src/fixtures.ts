/**
 * Salão fictício para o comercial.
 * Sem telefone, e-mail, documento, credencial ou valor financeiro real.
 */
export const salon = {
  name: "Ateliê Lumière",
  slug: "atelie-lumiere",
  city: "Pinheiros · SP",
  address: "Rua das Acácias, 120",
  description: "Corte, cor e cuidado num ateliê pequeno, com hora marcada.",
  rating: "4,9",
  reviews: "128 avaliações",
  todayLabel: "Terça-feira, 20 de outubro",
  dateLabel: "20/10/2026",
  whenLabel: "terça-feira, 20 de outubro de 2026 às 14:30",
};

export const services = [
  {
    name: "Corte e escova",
    description: "Corte no formato do rosto e escova com movimento.",
    minutes: 70,
    price: "R$ 180,00",
  },
  {
    name: "Coloração",
    description: "Cor uniforme, com teste de mecha incluso.",
    minutes: 120,
    price: "R$ 320,00",
  },
  {
    name: "Manicure",
    description: "Esmaltação e cuidado das unhas.",
    minutes: 45,
    price: "R$ 70,00",
  },
] as const;

export const professionals = [
  { name: "Helena Duarte", role: "Colorista", price: "R$ 180,00", minutes: 70, initials: "HD" },
  { name: "Lia Nogueira", role: "Cabeleireira", price: "R$ 180,00", minutes: 70, initials: "LN" },
  { name: "Caio Mendes", role: "Barbeiro", price: "R$ 70,00", minutes: 45, initials: "CM" },
] as const;

export const slots = ["09:30", "11:00", "13:00", "14:30", "16:00", "17:30"] as const;

export const client = {
  name: "Marina Alves",
};

export const dashboardVisits = [
  { time: "09:30", client: "Camila Reis", service: "Corte e escova", professional: "Lia Nogueira", status: "Confirmado" as const },
  { time: "11:00", client: "Lívia Prado", service: "Coloração", professional: "Helena Duarte", status: "Agendado" as const },
  { time: "14:30", client: "Marina Alves", service: "Corte e escova", professional: "Helena Duarte", status: "Agendado" as const, fresh: true },
  { time: "16:00", client: "Theo Martins", service: "Barba", professional: "Caio Mendes", status: "Agendado" as const },
];

export const dayAppointments = [
  { start: "09:30", end: "10:40", client: "Camila Reis", service: "Corte e escova", professional: "Lia Nogueira", status: "Confirmado" as const, meta: "70 min · R$ 180,00" },
  { start: "11:00", end: "13:00", client: "Lívia Prado", service: "Coloração", professional: "Helena Duarte", status: "Agendado" as const, meta: "120 min · R$ 320,00" },
  { start: "14:30", end: "15:40", client: "Marina Alves", service: "Corte e escova", professional: "Helena Duarte", status: "Confirmado" as const, meta: "70 min · R$ 180,00", fresh: true },
  { start: "16:00", end: "16:45", client: "Theo Martins", service: "Barba", professional: "Caio Mendes", status: "Agendado" as const, meta: "45 min · R$ 70,00" },
];

export const weekColumns = [
  { label: "Domingo", day: "18/10", items: [] as string[] },
  { label: "Segunda", day: "19/10", items: ["10:00 Camila"] },
  { label: "Terça", day: "20/10", items: ["09:30 Camila", "11:00 Lívia", "14:30 Marina", "16:00 Theo"] },
  { label: "Quarta", day: "21/10", items: ["15:00 Nara"] },
  { label: "Quinta", day: "22/10", items: ["09:00 Clara"] },
  { label: "Sexta", day: "23/10", items: ["18:00 Bruno"] },
  { label: "Sábado", day: "24/10", items: [] as string[] },
];

export const team = [
  { name: "Helena Duarte", role: "Dono", status: "Ativo", booking: "Recebe reservas", services: "3 serviços", initials: "HD" },
  { name: "Lia Nogueira", role: "Profissional", status: "Ativo", booking: "Recebe reservas", services: "2 serviços", initials: "LN" },
  { name: "Caio Mendes", role: "Profissional", status: "Ativo", booking: "Recebe reservas", services: "2 serviços", initials: "CM" },
  { name: "Rita Pacheco", role: "Recepção", status: "Ativo", booking: "Não atende clientes (só recepção)", services: "0 serviços", initials: "RP" },
];

export const stock = [
  { name: "Shampoo botânico", detail: "6 unidade · Mínimo 8", state: "Baixo" as const, cost: "R$ 28,00" },
  { name: "Esmalte nude", detail: "0 unidade · Mínimo 6", state: "Sem estoque" as const, cost: "R$ 12,00" },
  { name: "Máscara reparadora", detail: "14 unidade · Mínimo 4", state: "Normal" as const, cost: "R$ 42,00" },
];

export const financeEntries = [
  { title: "Corte e escova", meta: "Entrada · Serviços · Marina Alves", amount: "R$ 180,00", status: "Já entrou" as const, extra: "Data: 20/10/2026 · Pix", kind: "income" as const },
  { title: "Coloração", meta: "Entrada · Serviços · Lívia Prado", amount: "R$ 320,00", status: "Ainda vai entrar" as const, extra: "Data: 21/10/2026", kind: "income" as const },
  { title: "Reposição de produtos", meta: "Saída · Produtos", amount: "R$ 640,00", status: "Já saiu" as const, extra: "Data: 18/10/2026 · Pix", kind: "expense" as const },
];
