"use client";

import { useActionState, useState, useTransition, type ReactNode } from "react";
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
import { timezoneDisplayName } from "@/lib/workspace/timezone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ContextualHint } from "@/components/usability/contextual-hint";
import { ConfirmAction } from "@/components/usability/confirm-action";

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
  timezone,
}: {
  memberId: string;
  memberName: string;
  hours: WorkingHourRow[];
  breaks: BreakRow[];
  blocks: TimeBlockRow[];
  canEditJornada: boolean;
  canEditBlocks: boolean;
  timezone: string;
}) {
  const [hourState, hourAction, hourPending] = useAgendaAction(addWorkingHourAction);
  const [breakState, breakAction, breakPending] = useAgendaAction(addBreakAction);
  const [blockState, blockAction, blockPending] = useAgendaAction(addTimeBlockAction);
  const [copying, startCopy] = useTransition();
  const [copyFrom, setCopyFrom] = useState<number | null>(null);

  function copyHoursToOtherDays(sourceWeekday: number) {
    const sourceHours = hours.filter((row) => row.weekday === sourceWeekday);
    if (sourceHours.length === 0) {
      toast.error("Este dia ainda não tem horário para copiar.");
      return;
    }
    startCopy(async () => {
      let copied = 0;
      for (const day of WEEKDAYS) {
        if (day.value === sourceWeekday) continue;
        if (hours.some((row) => row.weekday === day.value)) continue;
        for (const period of sourceHours) {
          const data = new FormData();
          data.set("memberId", memberId);
          data.set("weekday", String(day.value));
          data.set("startTime", period.startTime.slice(0, 5));
          data.set("endTime", period.endTime.slice(0, 5));
          const result = await addWorkingHourAction({}, data);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          copied += 1;
        }
      }
      toast.success(
        copied > 0
          ? "Horários copiados para os outros dias vazios."
          : "Os outros dias já tinham horário. Nada foi alterado.",
      );
    });
  }

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm text-muted-foreground">Horários de trabalho</p>
        <h1 className="font-serif text-3xl">{memberName}</h1>
        <ContextualHint className="mt-2 max-w-2xl">
          Defina quando você atende. Pode colocar manhã e tarde separados. O horário de almoço não aparece para
          clientes marcarem. Horário de {timezoneDisplayName(timezone)}.
        </ContextualHint>
      </div>

      <div className="grid gap-4">
        {WEEKDAYS.map((day) => {
          const dayHours = hours.filter((row) => row.weekday === day.value);
          const dayBreaks = breaks.filter((row) => row.weekday === day.value);
          const hasHours = dayHours.length > 0;
          return (
            <Card key={day.value} className="border-none ring-1 ring-border">
              <details open={hasHours}>
                <summary className="cursor-pointer list-none">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-3">
                      <span>{day.label}</span>
                      <span className="text-sm font-normal text-muted-foreground">
                        {hasHours ? `${dayHours.length} horário(s)` : "Folga — toque para definir"}
                      </span>
                    </CardTitle>
                  </CardHeader>
                </summary>
                <CardContent className="grid gap-4">
                  <PeriodList
                    rows={dayHours}
                    empty="Nenhum horário neste dia."
                    canEdit={canEditJornada}
                    memberId={memberId}
                    deleteAction={deleteWorkingHourAction}
                    confirmMessage="Remover este horário de atendimento?"
                  />
                  {dayBreaks.length > 0 ? (
                    <div className="grid gap-2">
                      <p className="text-sm font-medium">Pausas (almoço)</p>
                      <PeriodList
                        rows={dayBreaks.map((row) => ({
                          ...row,
                          extra: row.label,
                        }))}
                        empty=""
                        canEdit={canEditJornada}
                        memberId={memberId}
                        deleteAction={deleteBreakAction}
                        confirmMessage="Remover esta pausa?"
                      />
                    </div>
                  ) : null}
                  {canEditJornada ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <form action={hourAction} className="grid gap-2 rounded-xl bg-secondary/40 p-3">
                        <input type="hidden" name="memberId" value={memberId} />
                        <input type="hidden" name="weekday" value={day.value} />
                        <p className="text-sm font-medium">Adicionar horário</p>
                        <FormFields state={hourState}>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="grid gap-1">
                              <Label>De</Label>
                              <Input name="startTime" type="time" required className="h-11" />
                            </div>
                            <div className="grid gap-1">
                              <Label>Até</Label>
                              <Input name="endTime" type="time" required className="h-11" />
                            </div>
                          </div>
                        </FormFields>
                        <Button type="submit" disabled={hourPending} className="h-11">
                          {hourPending ? "Salvando..." : "Adicionar horário"}
                        </Button>
                      </form>
                      <form action={breakAction} className="grid gap-2 rounded-xl bg-secondary/40 p-3">
                        <input type="hidden" name="memberId" value={memberId} />
                        <input type="hidden" name="weekday" value={day.value} />
                        <p className="text-sm font-medium">Adicionar pausa</p>
                        <FormFields state={breakState}>
                          <Input name="label" placeholder="Almoço" className="h-11" />
                          <div className="grid grid-cols-2 gap-2">
                            <div className="grid gap-1">
                              <Label>De</Label>
                              <Input name="startTime" type="time" required className="h-11" />
                            </div>
                            <div className="grid gap-1">
                              <Label>Até</Label>
                              <Input name="endTime" type="time" required className="h-11" />
                            </div>
                          </div>
                        </FormFields>
                        <Button type="submit" variant="outline" disabled={breakPending} className="h-11">
                          {breakPending ? "Salvando..." : "Adicionar pausa"}
                        </Button>
                      </form>
                    </div>
                  ) : null}
                  {canEditJornada && hasHours ? (
                    copyFrom === day.value ? (
                      <div className="grid gap-2 rounded-xl bg-secondary/50 p-3">
                        <p className="text-sm">Usar estes horários nos outros dias que ainda estão vazios?</p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            className="h-11"
                            disabled={copying}
                            onClick={() => {
                              copyHoursToOtherDays(day.value);
                              setCopyFrom(null);
                            }}
                          >
                            {copying ? "Copiando..." : "Sim, copiar"}
                          </Button>
                          <Button type="button" variant="outline" className="h-11" onClick={() => setCopyFrom(null)}>
                            Voltar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button type="button" variant="outline" className="h-11" onClick={() => setCopyFrom(day.value)}>
                        Usar estes horários nos outros dias
                      </Button>
                    )
                  ) : null}
                </CardContent>
              </details>
            </Card>
          );
        })}
      </div>

      <Card className="border-none ring-1 ring-border">
        <CardHeader>
          <CardTitle>Folgas e ausências</CardTitle>
          <CardDescription>Use para médico, férias ou um dia sem atendimento.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {blocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma folga marcada.</p>
          ) : (
            <div className="grid gap-2">
              {blocks.map((block) => (
                <div key={block.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary/40 p-3">
                  <div>
                    <p className="font-medium">
                      {block.localDate} · {block.localStart}–{block.localEnd}
                    </p>
                    <p className="text-sm text-muted-foreground">{block.reason ?? "Folga"}</p>
                  </div>
                  {canEditBlocks ? (
                    <ConfirmAction
                      title="Remover esta folga?"
                      description="O horário volta a aparecer para clientes marcarem."
                      confirmLabel="Sim, remover"
                      trigger={
                        <Button type="button" variant="outline" className="h-11">
                          Remover
                        </Button>
                      }
                      onConfirm={() => {
                        const formData = new FormData();
                        formData.set("id", block.id);
                        formData.set("memberId", memberId);
                        return runFormAction(deleteTimeBlockAction, formData);
                      }}
                    />
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
                  <div className="grid gap-1">
                    <Label>De</Label>
                    <Input name="startTime" type="time" required className="h-11" />
                  </div>
                  <div className="grid gap-1">
                    <Label>Até</Label>
                    <Input name="endTime" type="time" required className="h-11" />
                  </div>
                </div>
                <Input name="reason" placeholder="Motivo (opcional)" className="h-11" />
              </FormFields>
              <Button type="submit" disabled={blockPending} className="h-11">
                {blockPending ? "Salvando..." : "Marcar folga neste horário"}
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
  confirmMessage,
}: {
  rows: Array<{ id: string; startTime: string; endTime: string; extra?: string | null }>;
  empty: string;
  canEdit: boolean;
  memberId: string;
  deleteAction: (formData: FormData) => Promise<ActionState>;
  confirmMessage: string;
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
            <ConfirmAction
              title={confirmMessage}
              description="Você pode cadastrar de novo se mudar de ideia."
              confirmLabel="Sim, remover"
              trigger={
                <Button type="button" variant="outline" className="h-11">
                  Remover
                </Button>
              }
              onConfirm={() => {
                const formData = new FormData();
                formData.set("id", row.id);
                formData.set("memberId", memberId);
                return runFormAction(deleteAction, formData);
              }}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}
