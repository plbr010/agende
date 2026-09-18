"use client";

import { useActionState, type ReactNode } from "react";
import { toast } from "sonner";
import type { ActionState } from "@/lib/auth/actions";
import type { BreakRow, TimeBlockRow, WorkingHourRow } from "@/lib/agenda/queries";
import {
  addBreakAction,
  addTimeBlockAction,
  addWorkingHourAction,
  deleteBreakAction,
  deleteTimeBlockAction,
  deleteWorkingHourAction,
} from "@/lib/agenda/actions";
import { WEEKDAYS } from "@/lib/validation/agenda";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function FormFields({ state, children }: { state: ActionState; children: ReactNode }) {
  return (
    <div className="grid gap-3">
      {children}
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </div>
  );
}

function useAgendaAction(serverAction: (prev: ActionState, formData: FormData) => Promise<ActionState>) {
  return useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await serverAction(prev, formData);
    if (result.success) {
      toast.success(result.success);
    } else if (result.error && !result.fieldErrors) {
      toast.error(result.error);
    }
    return result;
  }, {});
}

async function runFormAction(action: (formData: FormData) => Promise<ActionState>, formData: FormData) {
  const result = await action(formData);
  if (result.error) {
    toast.error(result.error);
  } else if (result.success) {
    toast.success(result.success);
  }
}

export function AvailabilityEditor({
  memberId,
  memberName,
  hours,
  breaks,
  blocks,
  canEditJornada,
  canEditBlocks,
}: {
  memberId: string;
  memberName: string;
  hours: WorkingHourRow[];
  breaks: BreakRow[];
  blocks: TimeBlockRow[];
  canEditJornada: boolean;
  canEditBlocks: boolean;
}) {
  const [hourState, hourAction, hourPending] = useAgendaAction(addWorkingHourAction);
  const [breakState, breakAction, breakPending] = useAgendaAction(addBreakAction);
  const [blockState, blockAction, blockPending] = useAgendaAction(addTimeBlockAction);

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm text-muted-foreground">Jornada</p>
        <h1 className="font-serif text-3xl">{memberName}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Horários no fuso America/Sao_Paulo. Vários períodos no mesmo dia são permitidos, por exemplo
          08:00–12:00 e 14:00–18:00. Pausas (almoço) não geram horários livres.
        </p>
      </div>

      <div className="grid gap-4">
        {WEEKDAYS.map((day) => {
          const dayHours = hours.filter((row) => row.weekday === day.value);
          const dayBreaks = breaks.filter((row) => row.weekday === day.value);
          return (
            <Card key={day.value} className="border-none ring-1 ring-border">
              <CardHeader>
                <CardTitle>{day.label}</CardTitle>
                <CardDescription>
                  {dayHours.length === 0 ? "Folga nesta jornada padrão." : `${dayHours.length} período(s) de atendimento.`}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <PeriodList
                  rows={dayHours}
                  empty="Nenhum período."
                  canEdit={canEditJornada}
                  memberId={memberId}
                  deleteAction={deleteWorkingHourAction}
                />
                {dayBreaks.length > 0 ? (
                  <div className="grid gap-2">
                    <p className="text-sm font-medium">Pausas</p>
                    <PeriodList
                      rows={dayBreaks.map((row) => ({
                        ...row,
                        extra: row.label,
                      }))}
                      empty=""
                      canEdit={canEditJornada}
                      memberId={memberId}
                      deleteAction={deleteBreakAction}
                    />
                  </div>
                ) : null}
                {canEditJornada ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <form action={hourAction} className="grid gap-2 rounded-xl bg-secondary/40 p-3">
                      <input type="hidden" name="memberId" value={memberId} />
                      <input type="hidden" name="weekday" value={day.value} />
                      <p className="text-sm font-medium">Adicionar período</p>
                      <FormFields state={hourState}>
                        <div className="grid grid-cols-2 gap-2">
                          <Input name="startTime" type="time" required className="h-11" />
                          <Input name="endTime" type="time" required className="h-11" />
                        </div>
                      </FormFields>
                      <Button type="submit" disabled={hourPending} className="h-11">
                        {hourPending ? "Salvando..." : "Salvar período"}
                      </Button>
                    </form>
                    <form action={breakAction} className="grid gap-2 rounded-xl bg-secondary/40 p-3">
                      <input type="hidden" name="memberId" value={memberId} />
                      <input type="hidden" name="weekday" value={day.value} />
                      <p className="text-sm font-medium">Adicionar pausa</p>
                      <FormFields state={breakState}>
                        <Input name="label" placeholder="Almoço" className="h-11" />
                        <div className="grid grid-cols-2 gap-2">
                          <Input name="startTime" type="time" required className="h-11" />
                          <Input name="endTime" type="time" required className="h-11" />
                        </div>
                      </FormFields>
                      <Button type="submit" variant="outline" disabled={breakPending} className="h-11">
                        {breakPending ? "Salvando..." : "Salvar pausa"}
                      </Button>
                    </form>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-none ring-1 ring-border">
        <CardHeader>
          <CardTitle>Bloqueios pontuais</CardTitle>
          <CardDescription>
            Folga, médico, férias ou fechamento do salão. Datas e horas são interpretadas em São Paulo.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {blocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum bloqueio futuro.</p>
          ) : (
            <div className="grid gap-2">
              {blocks.map((block) => (
                <div key={block.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary/40 p-3">
                  <div>
                    <p className="font-medium">
                      {block.localDate} · {block.localStart}–{block.localEnd}
                    </p>
                    <p className="text-sm text-muted-foreground">{block.reason ?? "Bloqueio"}</p>
                  </div>
                  {canEditBlocks ? (
                    <form action={(formData) => runFormAction(deleteTimeBlockAction, formData)}>
                      <input type="hidden" name="id" value={block.id} />
                      <input type="hidden" name="memberId" value={memberId} />
                      <Button type="submit" variant="outline" size="sm">
                        Remover
                      </Button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
          )}
          {canEditBlocks ? (
            <form action={blockAction} className="grid gap-3 rounded-xl bg-secondary/40 p-3">
              <input type="hidden" name="memberId" value={memberId} />
              <FormFields state={blockState}>
                <div className="grid gap-2">
                  <Label htmlFor="blockDate">Dia</Label>
                  <Input id="blockDate" name="localDate" type="date" required className="h-11" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input name="startTime" type="time" required className="h-11" />
                  <Input name="endTime" type="time" required className="h-11" />
                </div>
                <Input name="reason" placeholder="Motivo (opcional)" className="h-11" />
              </FormFields>
              <Button type="submit" disabled={blockPending} className="h-11">
                {blockPending ? "Salvando..." : "Bloquear horário"}
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function PeriodList({
  rows,
  empty,
  canEdit,
  memberId,
  deleteAction,
}: {
  rows: Array<{ id: string; startTime: string; endTime: string; extra?: string | null }>;
  empty: string;
  canEdit: boolean;
  memberId: string;
  deleteAction: (formData: FormData) => Promise<ActionState>;
}) {
  if (rows.length === 0) {
    return empty ? <p className="text-sm text-muted-foreground">{empty}</p> : null;
  }
  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary/30 px-3 py-2">
          <p className="text-sm">
            {row.startTime}–{row.endTime}
            {row.extra ? ` · ${row.extra}` : ""}
          </p>
          {canEdit ? (
            <form action={(formData) => runFormAction(deleteAction, formData)}>
              <input type="hidden" name="id" value={row.id} />
              <input type="hidden" name="memberId" value={memberId} />
              <Button type="submit" variant="ghost" size="sm">
                Remover
              </Button>
            </form>
          ) : null}
        </div>
      ))}
    </div>
  );
}
