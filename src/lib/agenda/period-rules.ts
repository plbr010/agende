import { parseTimeInput } from "@/lib/time/timezone";

export type PeriodRange = {
  id?: string;
  startTime: string;
  endTime: string;
};

export const PERIOD_MESSAGES = {
  missing: "Informe o começo e o fim do horário.",
  order: "O começo precisa ser antes do fim.",
  overlap: "Este horário cruza outro que já está neste dia. Escolha um intervalo livre.",
  blockDate: "Escolha o dia da folga.",
  copyEmpty: "Este dia ainda não tem horário para copiar.",
  copyNone: "Os outros dias já tinham horário. Nada foi alterado.",
  copyDone: "Horários copiados para os outros dias vazios.",
  copyPartial: "Não deu certo copiar o resto. O que já foi salvo continua na agenda.",
} as const;

export function minutesOf(value: string): number | null {
  const parsed = parseTimeInput(value);
  if (!parsed) return null;
  const [hour, minute] = parsed.split(":").map(Number);
  return hour * 60 + minute;
}

/** Intervalo meio aberto [início, fim), igual à regra gravada na agenda. */
export function rangesOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA;
}

export function describePeriodProblem(
  start: string,
  end: string,
  existing: PeriodRange[],
  ignoreId?: string,
): string | null {
  const startMin = minutesOf(start);
  const endMin = minutesOf(end);
  if (startMin === null || endMin === null) return PERIOD_MESSAGES.missing;
  if (startMin >= endMin) return PERIOD_MESSAGES.order;
  const clash = existing.some((row) => {
    if (ignoreId && row.id === ignoreId) return false;
    const otherStart = minutesOf(row.startTime);
    const otherEnd = minutesOf(row.endTime);
    if (otherStart === null || otherEnd === null) return false;
    return rangesOverlap(startMin, endMin, otherStart, otherEnd);
  });
  return clash ? PERIOD_MESSAGES.overlap : null;
}

export function describeBlockProblem(
  date: string,
  start: string,
  end: string,
  existing: Array<{ id?: string; localDate: string; localStart: string; localEnd: string }>,
  ignoreId?: string,
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return PERIOD_MESSAGES.blockDate;
  return describePeriodProblem(
    start,
    end,
    existing
      .filter((row) => row.localDate === date)
      .map((row) => ({ id: row.id, startTime: row.localStart, endTime: row.localEnd })),
    ignoreId,
  );
}

export function hourCountLabel(count: number): string {
  if (count === 0) return "Sem atendimento";
  if (count === 1) return "1 horário";
  return `${count} horários`;
}

export type CopyTarget = {
  weekday: number;
  startTime: string;
  endTime: string;
};

export function planHourCopy(
  hours: Array<{ weekday: number; startTime: string; endTime: string }>,
  sourceWeekday: number,
  weekdays: readonly number[],
): { targets: CopyTarget[]; emptySource: boolean } {
  const source = hours.filter((row) => row.weekday === sourceWeekday);
  if (source.length === 0) {
    return { targets: [], emptySource: true };
  }
  const targets: CopyTarget[] = [];
  for (const weekday of weekdays) {
    if (weekday === sourceWeekday) continue;
    if (hours.some((row) => row.weekday === weekday)) continue;
    for (const period of source) {
      targets.push({
        weekday,
        startTime: period.startTime.slice(0, 5),
        endTime: period.endTime.slice(0, 5),
      });
    }
  }
  return { targets, emptySource: false };
}
