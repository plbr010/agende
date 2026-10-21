/** Dados fictícios de demonstração. Nenhum cliente real. */

export const SALON = {
  name: "Studio Pétala",
  slug: "studio-petala",
  owner: "Marina Alves",
  ownerFirst: "Marina",
  role: "Proprietária",
  city: "Juiz de Fora",
  publicUrl: "agendeapp.online/p/studio-petala",
  todayLabel: "Qua, 21 de outubro",
};

export const SERVICES = [
  {
    id: "cilios",
    name: "Extensão de cílios clássica",
    description: "Fio a fio, olhar alongado e natural.",
    minutes: 120,
    price: "R$ 180,00",
    cents: 18000,
  },
  {
    id: "sobrancelha",
    name: "Design de sobrancelhas",
    description: "Design com henna e finalização.",
    minutes: 40,
    price: "R$ 70,00",
    cents: 7000,
  },
  {
    id: "lifting",
    name: "Lash lifting",
    description: "Curvatura e hidratação dos fios naturais.",
    minutes: 75,
    price: "R$ 150,00",
    cents: 15000,
  },
] as const;

export const PROS = [
  { id: "marina", name: "Marina Alves", role: "Cílios e lash", initials: "MA" },
  { id: "camila", name: "Camila Ribeiro", role: "Sobrancelhas", initials: "CR" },
] as const;

export const CLIENT = {
  name: "Beatriz Nunes",
  initials: "BN",
  phone: "(32) 98876-4410",
  email: "beatriz.nunes@email.com",
};

export const BOOKING = {
  dateIso: "2026-10-22",
  dateLabel: "22/10/2026",
  weekday: "Qui",
  time: "14:30",
  end: "16:30",
  slots: ["09:00", "10:30", "11:15", "14:30", "15:45", "17:00"],
};

export const AGENDA = [
  {
    id: "a1",
    start: "09:00",
    end: "09:40",
    client: "Ana Souza",
    initials: "AS",
    service: "Design de sobrancelhas",
    pro: "Camila Ribeiro",
    status: "confirmed" as const,
    minutes: 40,
    price: "R$ 70,00",
  },
  {
    id: "a2",
    start: "11:00",
    end: "12:15",
    client: "Carla Mendes",
    initials: "CM",
    service: "Lash lifting",
    pro: "Marina Alves",
    status: "confirmed" as const,
    minutes: 75,
    price: "R$ 150,00",
  },
];

export const NEW_APPOINTMENT = {
  id: "new",
  start: "14:30",
  end: "16:30",
  client: CLIENT.name,
  initials: CLIENT.initials,
  service: SERVICES[0].name,
  pro: PROS[0].name,
  status: "scheduled" as const,
  minutes: 120,
  price: SERVICES[0].price,
};

export const CLIENTS = [
  { name: "Ana Souza", contact: "(32) 98811-2200", note: "Prefere henna suave" },
  { name: "Beatriz Nunes", contact: CLIENT.phone, note: "Primeira extensão" },
  { name: "Carla Mendes", contact: "(32) 98765-0102", note: "Lifting a cada 6 semanas" },
  { name: "Daniela Prado", contact: "(32) 99901-3344", note: "" },
];

export const TEAM = [
  { name: "Marina Alves", role: "Proprietária", services: 3, agenda: true },
  { name: "Camila Ribeiro", role: "Profissional", services: 1, agenda: true },
];

export const FINANCE = {
  period: "Este mês",
  in: "R$ 3.240,00",
  out: "R$ 480,00",
  pending: "R$ 180,00",
  leftover: "R$ 2.760,00",
  entries: [
    {
      title: "Extensão de cílios clássica",
      kind: "Entrada" as const,
      meta: "Atendimentos · Beatriz Nunes",
      amount: "R$ 180,00",
      status: "Já entrou",
      date: "21/10/2026 · Pix",
    },
    {
      title: "Design de sobrancelhas",
      kind: "Entrada" as const,
      meta: "Atendimentos · Ana Souza",
      amount: "R$ 70,00",
      status: "Já entrou",
      date: "21/10/2026 · Dinheiro",
    },
    {
      title: "Extensão de cílios clássica",
      kind: "Entrada" as const,
      meta: "Atendimentos · Beatriz Nunes",
      amount: "R$ 180,00",
      status: "Ainda vai entrar",
      date: "22/10/2026",
    },
    {
      title: "Produtos para cílios",
      kind: "Saída" as const,
      meta: "Insumos · Sem cliente",
      amount: "R$ 220,00",
      status: "Já saiu",
      date: "18/10/2026 · Pix",
    },
  ],
};

export const HOME_METRICS = [
  { label: "Agendamentos hoje", value: "6", hint: "Sem cancelados", tone: "blush" },
  { label: "Receita do dia", value: "R$ 980,00", hint: "Soma dos horários, sem faltas", tone: "sand" },
  { label: "Clientes ativos", value: "86", hint: "Cadastrados no salão", tone: "ivory" },
  { label: "Avaliação média", value: "4,9", hint: "18 avaliações recebidas", tone: "lilac" },
] as const;
