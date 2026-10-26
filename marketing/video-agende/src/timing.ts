export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const TRANSITION_FRAMES = 12;

export type SceneMeta = {
  id: string;
  durationInFrames: number;
  kicker: string;
  title: string;
  callout: string;
  caption: string;
};

/**
 * 10 cenas. A soma das durações menos as 9 transições de 12 frames
 * fecha em 45 segundos (1350 frames a 30 fps).
 */
export const SCENES: readonly SceneMeta[] = [
  {
    id: "Cena01Acesso",
    durationInFrames: 126,
    kicker: "01  ·  Cliente",
    title: "A cliente marca\nno celular.",
    callout: "Página pública do salão",
    caption: "A cliente abre a página do salão no celular.",
  },
  {
    id: "Cena02Servico",
    durationInFrames: 156,
    kicker: "02  ·  Agendamento",
    title: "Serviço e quem\nvai atender.",
    callout: "Escolha real do fluxo público",
    caption: "Ela escolhe o serviço e a profissional.",
  },
  {
    id: "Cena03Horario",
    durationInFrames: 138,
    kicker: "03  ·  Horário",
    title: "O dia e a hora,\nsem ligar.",
    callout: "Horários livres da agenda",
    caption: "Escolhe o dia e um horário livre.",
  },
  {
    id: "Cena04Reserva",
    durationInFrames: 144,
    kicker: "04  ·  Reserva",
    title: "O horário entra\nna hora.",
    callout: "Solicitação registrada",
    caption: "A reserva entra como solicitação.",
  },
  {
    id: "Cena05Painel",
    durationInFrames: 162,
    kicker: "05  ·  Painel",
    title: "A profissional\nconfirma.",
    callout: "Início do painel",
    caption: "No painel, ela confirma o horário.",
  },
  {
    id: "Cena06Agenda",
    durationInFrames: 126,
    kicker: "06  ·  Agenda",
    title: "O dia inteiro,\nnum relance.",
    callout: "Dia e semana",
    caption: "A agenda mostra o dia e a semana.",
  },
  {
    id: "Cena07Equipe",
    durationInFrames: 126,
    kicker: "07  ·  Equipe",
    title: "Quem atende,\nno mesmo lugar.",
    callout: "Funções e vagas do plano",
    caption: "A equipe, as funções e quem recebe reservas.",
  },
  {
    id: "Cena08Estoque",
    durationInFrames: 126,
    kicker: "08  ·  Estoque",
    title: "Antes de faltar\nna prateleira.",
    callout: "Baixo e sem estoque",
    caption: "O estoque avisa o que está baixo ou zerado.",
  },
  {
    id: "Cena09Financeiro",
    durationInFrames: 126,
    kicker: "09  ·  Financeiro",
    title: "O que entrou\ne o que saiu.",
    callout: "Resumo do período",
    caption: "Entradas, saídas e o que ainda está em aberto.",
  },
  {
    id: "Cena10Marca",
    durationInFrames: 228,
    kicker: "10  ·  Agendê",
    title: "Sete dias grátis.\nSem cartão.",
    callout: "agendeapp.online",
    caption: "",
  },
];

export const COMMERCIAL_ID = "AgendeComercial";

export function compositionDuration(
  scenes: readonly { durationInFrames: number }[] = SCENES,
  transitionFrames = TRANSITION_FRAMES,
): number {
  const sum = scenes.reduce((total, scene) => total + scene.durationInFrames, 0);
  return sum - transitionFrames * Math.max(scenes.length - 1, 0);
}

export function sceneStartFrames(
  scenes: readonly { durationInFrames: number }[] = SCENES,
  transitionFrames = TRANSITION_FRAMES,
): number[] {
  const starts: number[] = [];
  let cursor = 0;
  scenes.forEach((scene, index) => {
    starts.push(cursor);
    const overlap = index < scenes.length - 1 ? transitionFrames : 0;
    cursor += scene.durationInFrames - overlap;
  });
  return starts;
}
