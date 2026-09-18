export const MARKETING_NAV = [
  { href: "/#funcionalidades", label: "Funcionalidades" },
  { href: "/#como-funciona", label: "Como funciona" },
  { href: "/#planos", label: "Planos" },
] as const;

export const MARKETING_CTAS = {
  primary: { href: "/cadastro", label: "Começar 7 dias grátis" },
  secondary: { href: "/#como-funciona", label: "Ver como funciona" },
  headerPrimary: { href: "/cadastro", label: "Começar grátis" },
  login: { href: "/login", label: "Entrar" },
} as const;

export const PLANS = [
  {
    id: "solo",
    name: "Solo",
    seats: "1 profissional",
    price: "R$ 89,90",
    period: "/mês",
    popular: false,
  },
  {
    id: "equipe",
    name: "Equipe",
    seats: "Até 5 profissionais",
    price: "R$ 169,90",
    period: "/mês",
    popular: true,
  },
  {
    id: "salao",
    name: "Salão",
    seats: "Até 15 profissionais",
    price: "R$ 299,90",
    period: "/mês",
    popular: false,
  },
] as const;

export const AUDIENCE = [
  "Nail designers",
  "Manicures",
  "Salões",
  "Cabeleireiros",
  "Lash designers",
  "Sobrancelha",
  "Barbeiros",
  "Estética",
] as const;

export const PROBLEMS = [
  {
    title: "Agenda desorganizada",
    text: "Horários no caderno, no celular e na cabeça — e alguém sempre fica de fora.",
  },
  {
    title: "WhatsApp sem fim",
    text: "Clientes perguntando se tem vaga, confirmando, remarcando. O chat vira a sua recepção.",
  },
  {
    title: "Esquecimentos",
    text: "Encaixes de última hora, nomes sem telefone, um horário que você jurou que estava livre.",
  },
  {
    title: "Controle manual",
    text: "Planilha, bloco de notas e memória. Qualquer ausência vira um buraco no dia.",
  },
  {
    title: "Faturamento opaco",
    text: "Difícil saber o que entrou na semana, o que está pendente e o que realmente rendeu.",
  },
  {
    title: "Estoque bagunçado",
    text: "Esmalte, henna, tinta e produto acabando no meio do movimento — sem ninguém perceber.",
  },
  {
    title: "Administrativo demais",
    text: "A rotina do negócio come o tempo que deveria estar no atendimento.",
  },
] as const;

export const SOLUTIONS = [
  "Uma agenda só, visível e calma",
  "Link público para o cliente marcar sozinho",
  "Histórico de quem atende, o quê e quando",
  "Serviços, equipe e clientes no mesmo lugar",
  "Visão de financeiro e estoque no produto",
] as const;

export const FEATURES = [
  {
    id: "agenda",
    title: "Agenda",
    text: "Veja o dia e a semana com clareza. Encaixes, bloqueios e horários no mesmo olhar.",
  },
  {
    id: "online",
    title: "Agendamento online",
    text: "Seu link público. A cliente escolhe, confirma e você só acompanha.",
  },
  {
    id: "clientes",
    title: "Clientes",
    text: "Nome, contato e histórico de atendimentos juntos, sem procurar no WhatsApp.",
  },
  {
    id: "servicos",
    title: "Serviços",
    text: "Catálogo com duração e valor. O que você oferece fica claro na hora de marcar.",
  },
  {
    id: "equipe",
    title: "Equipe",
    text: "Várias profissionais, uma agenda. Cada uma com os próprios horários.",
  },
  {
    id: "financeiro",
    title: "Financeiro",
    text: "Acompanhe o que o estúdio gera, sem planilha paralela no fim do mês.",
  },
  {
    id: "estoque",
    title: "Estoque",
    text: "Produtos, quantidades e o essencial para não parar um atendimento.",
  },
  {
    id: "historico",
    title: "Histórico de atendimentos",
    text: "O que foi feito, com quem e quando — para retocar, indicar e fidelizar.",
  },
] as const;

export const BOOKING_STEPS = [
  { title: "Abre o link", text: "Você compartilha um endereço público do seu negócio." },
  { title: "Escolhe o serviço", text: "Alongamento, corte, lash, sobrancelha — o que você oferece." },
  { title: "Escolhe a profissional", text: "Quando houver equipe, a cliente escolhe com quem quer ir." },
  { title: "Vê os horários", text: "Só aparece o que está livre. Sem vai-e-volta." },
  { title: "Agenda", text: "Um toque para confirmar. Simples para ela. Organizado para você." },
] as const;

export const HOW_IT_WORKS = [
  { step: "1", title: "Crie sua conta", text: "Cadastro rápido, sem cartão para começar o trial." },
  { step: "2", title: "Configure seus serviços", text: "Nome, duração e valor. O essencial para agendar." },
  { step: "3", title: "Compartilhe seu link", text: "Bio do Instagram, WhatsApp ou cartão. Um endereço só." },
  { step: "4", title: "Clientes escolhem um horário", text: "Elas veem a disponibilidade e marcam sozinhas." },
  { step: "5", title: "Você acompanha no Agendê", text: "Agenda, clientes e o dia inteiro em um só lugar." },
] as const;

export const FOOTER_LINKS = [
  { href: "/#funcionalidades", label: "Produto" },
  { href: "/termos", label: "Termos" },
  { href: "/privacidade", label: "Privacidade" },
  { href: "/login", label: "Entrar" },
  { href: "/cadastro", label: "Cadastro" },
] as const;
