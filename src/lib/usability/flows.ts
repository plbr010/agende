export type UsabilityFlow = {
  id: string;
  title: string;
  audience: "cliente" | "profissional";
  goal: string;
  steps: string[];
  difficultyNotes: string[];
};

export const USABILITY_FLOWS: readonly UsabilityFlow[] = [
  {
    id: "client-book",
    title: "Agendar um horário",
    audience: "cliente",
    goal: "Reservar um serviço sem ajuda",
    steps: [
      "Abrir o link do salão",
      "Toque no serviço",
      "Escolher quem atende (pula se só houver uma pessoa)",
      "Toque no dia",
      "Toque no horário",
      "Preencher nome, celular e e-mail (pula se a conta já tiver os dados)",
      "Toque em Reservar este horário",
    ],
    difficultyNotes: [
      "Quem já tem conta confirma em menos cliques.",
      "Voltar e Mudar horário ficam visíveis na confirmação.",
    ],
  },
  {
    id: "pro-service",
    title: "Cadastrar um serviço",
    audience: "profissional",
    goal: "Criar um serviço e quem faz, sem ajuda",
    steps: [
      "Abrir Serviços",
      "Toque em Novo serviço",
      "Informar nome, tempo e preço",
      "Marcar quem faz o serviço",
      "Toque em Salvar serviço",
    ],
    difficultyNotes: ["Se só houver uma profissional, ela já vem marcada."],
  },
  {
    id: "pro-hours",
    title: "Configurar horários",
    audience: "profissional",
    goal: "Informar os dias e horas de atendimento",
    steps: [
      "Abrir Equipe",
      "Toque em Horários de trabalho",
      "Escolher o dia",
      "Informar início e fim",
      "Toque em Adicionar horário",
      "Opcional: copiar para os outros dias",
    ],
    difficultyNotes: ["Dias sem atendimento ficam fechados para não sobrecarregar a tela."],
  },
  {
    id: "pro-book",
    title: "Marcar cliente na agenda",
    audience: "profissional",
    goal: "Encaixar um horário no dia",
    steps: [
      "Abrir Agenda ou toque em Novo horário",
      "Escolher cliente, profissional, serviço e dia",
      "Os horários livres aparecem sozinhos",
      "Toque no horário",
      "Toque em Agendar",
    ],
    difficultyNotes: ["A busca de horários não precisa de um clique extra."],
  },
  {
    id: "pro-next",
    title: "Encontrar o próximo atendimento",
    audience: "profissional",
    goal: "Ver o próximo horário em poucos segundos",
    steps: ["Abrir a Visão geral", "Olhar o card Próximos atendimentos no topo da rotina"],
    difficultyNotes: ["O horário aparece em número grande, com nome da cliente."],
  },
  {
    id: "finance-entry",
    title: "Registrar receita ou despesa",
    audience: "profissional",
    goal: "Anotar dinheiro que entrou ou saiu",
    steps: [
      "Abrir Financeiro",
      "Toque em Adicionar dinheiro que entrou (ou saiu)",
      "Informar o que foi, o valor e a data",
      "Toque em Salvar",
    ],
    difficultyNotes: ["Marcar como pago fica no próprio registro, com texto grande."],
  },
] as const;

export function usabilityFlowById(id: string): UsabilityFlow | undefined {
  return USABILITY_FLOWS.find((flow) => flow.id === id);
}

export function usabilityStepCount(id: string): number {
  return usabilityFlowById(id)?.steps.length ?? 0;
}
