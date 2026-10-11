"use client";

import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
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
  updateBreakAction,
  updateWorkingHourAction,
} from "@/lib/agenda/actions";
import {
  PERIOD_MESSAGES,
  describeBlockProblem,
  describePeriodProblem,
  hourCountLabel,
  planHourCopy,
  type PeriodRange,
} from "@/lib/agenda/period-rules";
import { WEEKDAYS } from "@/lib/validation/agenda";
import { timezoneDisplayName } from "@/lib/workspace/timezone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ContextualHint } from "@/components/usability/contextual-hint";
import { ConfirmAction } from "@/components/usability/confirm-action";

function actionMessage(result: ActionState): string {
  return (
    result.fieldErrors?.endTime ??
    result.fieldErrors?.startTime ??
    result.fieldErrors?.localDate ??
    result.error ??
    "Não deu certo salvar. Tente de novo."
  );
}

function PeriodForm({
  formKey,
  legend,
  submitLabel,
  pendingLabel,
  variant = "default",
  accessibleSubmitLabel,
  hidden,
  defaults,
  labelDefault,
  showLabel,
  dateField,
  reasonField,
  validate,
  save,
  blocked,
  onSaved,
  onCancel,
}: {
  formKey: string;
  legend: string;
  submitLabel: string;
  pendingLabel: string;
  variant?: "default" | "outline";
  accessibleSubmitLabel?: string;
  hidden: Record<string, string>;
  defaults?: { startTime?: string; endTime?: string };
  labelDefault?: string;
  showLabel?: boolean;
  dateField?: boolean;
  reasonField?: boolean;
  validate: (formData: FormData) => string | null;
  save: (formData: FormData) => Promise<ActionState>;
  blocked: boolean;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const [pending, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const baseId = useId();
  const startId = `${baseId}-start`;
  const endId = `${baseId}-end`;
  const labelId = `${baseId}-label`;
  const dateId = `${baseId}-date`;
  const reasonId = `${baseId}-reason`;

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || blocked || pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const problem = validate(data);
    if (problem) {
      setError(problem);
      return;
    }
    lock.current = true;
    setError(null);
    startSave(async () => {
      try {
        const result = await save(data);
        if (result.error || result.fieldErrors) {
          const message = actionMessage(result);
          setError(message);
          toast.error(message);
          return;
        }
        if (result.success) toast.success(result.success);
        if (onSaved) onSaved();
        else form.reset();
      } catch {
        const message = "Não deu certo salvar. Tente de novo.";
        setError(message);
        toast.error(message);
      } finally {
        lock.current = false;
      }
    });
  }

  const busy = pending || blocked;

  return (
    <form key={formKey} onSubmit={onSubmit} className="grid gap-3 rounded-xl bg-secondary/40 p-3">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <p className="text-sm font-medium">{legend}</p>
      {dateField ? (
        <div className="grid gap-1">
          <Label htmlFor={dateId}>Dia</Label>
          <Input id={dateId} name="localDate" type="date" required className="h-11" aria-invalid={Boolean(error)} />
        </div>
      ) : null}
      {showLabel ? (
        <div className="grid gap-1">
          <Label htmlFor={labelId}>Nome da pausa</Label>
          <Input
            id={labelId}
            name="label"
            defaultValue={labelDefault}
            placeholder="Almoço"
            className="h-11"
          />
          <p className="text-sm text-muted-foreground">Exemplo: almoço. Os clientes não marcam neste intervalo.</p>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1">
          <Label htmlFor={startId}>De</Label>
          <Input
            id={startId}
            name="startTime"
            type="time"
            required
            step={60}
            defaultValue={defaults?.startTime}
            className="h-11"
            aria-invalid={Boolean(error)}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={endId}>Até</Label>
          <Input
            id={endId}
            name="endTime"
            type="time"
            required
            step={60}
            defaultValue={defaults?.endTime}
            className="h-11"
            aria-invalid={Boolean(error)}
          />
        </div>
      </div>
      {reasonField ? (
        <div className="grid gap-1">
          <Label htmlFor={reasonId}>Motivo (opcional)</Label>
          <Input id={reasonId} name="reason" placeholder="Médico, férias..." className="h-11" />
        </div>
      ) : null}
      {error ? (
        <p ref={errorRef} role="alert" tabIndex={-1} className="text-sm text-destructive outline-none">
          {error}
        </p>
      ) : null}
      {pending ? (
        <p role="status" className="text-sm text-muted-foreground">
          {pendingLabel}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="submit"
          variant={variant}
          disabled={busy}
          className="h-11 w-full sm:w-auto"
          aria-busy={pending}
          aria-label={pending ? pendingLabel : (accessibleSubmitLabel ?? submitLabel)}
        >
          {pending ? pendingLabel : submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" className="h-11 w-full sm:w-auto" disabled={busy} onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function RemoveButton({
  title,
  description,
  memberId,
  id,
  remove,
  label = "Remover",
}: {
  title: string;
  description: string;
  memberId: string;
  id: string;
  remove: (formData: FormData) => Promise<ActionState>;
  label?: string;
}) {
  return (
    <ConfirmAction
      title={title}
      description={description}
      confirmLabel="Sim, remover"
      pendingLabel="Removendo..."
      trigger={
        <Button type="button" variant="outline" className="h-11 w-full sm:w-auto" aria-label={label}>
          Remover
        </Button>
      }
      onConfirm={async () => {
        const formData = new FormData();
        formData.set("id", id);
        formData.set("memberId", memberId);
        const result = await remove(formData);
        if (result.error) {
          throw new Error(result.error);
        }
        if (result.success) toast.success(result.success);
      }}
    />
  );
}

function PeriodRow({
  row,
  extra,
  editing,
  canEdit,
  memberId,
  weekday,
  kind,
  existing,
  busy,
  onEdit,
  onCancelEdit,
  onRemove,
  confirmTitle,
  guardSave,
}: {
  row: { id: string; startTime: string; endTime: string; extra?: string | null };
  extra?: string | null;
  editing: boolean;
  canEdit: boolean;
  memberId: string;
  weekday: number;
  kind: "hour" | "break";
  existing: PeriodRange[];
  busy: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onRemove: (formData: FormData) => Promise<ActionState>;
  confirmTitle: string;
  guardSave: (task: (formData: FormData) => Promise<ActionState>) => (formData: FormData) => Promise<ActionState>;
}) {
  if (editing && canEdit) {
    const save = kind === "hour" ? updateWorkingHourAction : updateBreakAction;
    return (
      <PeriodForm
        formKey={`${kind}-${row.id}`}
        legend={kind === "hour" ? "Alterar horário" : "Alterar pausa"}
        submitLabel="Salvar alteração"
        accessibleSubmitLabel={`Salvar alteração de ${row.startTime.slice(0, 5)}–${row.endTime.slice(0, 5)}`}
        pendingLabel="Salvando..."
        hidden={{ id: row.id, memberId, weekday: String(weekday) }}
        defaults={{ startTime: row.startTime.slice(0, 5), endTime: row.endTime.slice(0, 5) }}
        labelDefault={extra ?? ""}
        showLabel={kind === "break"}
        blocked={busy}
        validate={(data) =>
          describePeriodProblem(
            String(data.get("startTime") ?? ""),
            String(data.get("endTime") ?? ""),
            existing,
            row.id,
          )
        }
        save={guardSave((data) => save({}, data))}
        onSaved={onCancelEdit}
        onCancel={onCancelEdit}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-secondary/30 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm">
        {row.startTime.slice(0, 5)}–{row.endTime.slice(0, 5)}
        {extra ? ` · ${extra}` : ""}
      </p>
      {canEdit ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full sm:w-auto"
            aria-label={`Alterar ${row.startTime.slice(0, 5)}–${row.endTime.slice(0, 5)}`}
            onClick={onEdit}
          >
            Alterar
          </Button>
          <RemoveButton
            title={confirmTitle}
            description="Você pode cadastrar de novo se mudar de ideia."
            memberId={memberId}
            id={row.id}
            label={`Remover ${row.startTime.slice(0, 5)}–${row.endTime.slice(0, 5)}`}
            remove={onRemove}
          />
        </div>
      ) : null}
    </div>
  );
}

function DaySchedule({
  day,
  memberId,
  hours,
  breaks,
  canEdit,
}: {
  day: (typeof WEEKDAYS)[number];
  memberId: string;
  hours: WorkingHourRow[];
  breaks: BreakRow[];
  canEdit: boolean;
}) {
  const panelId = useId();
  const dayHours = hours.filter((row) => row.weekday === day.value);
  const dayBreaks = breaks.filter((row) => row.weekday === day.value);
  const hasHours = dayHours.length > 0;
  const [open, setOpen] = useState(hasHours);
  const [editing, setEditing] = useState<{ kind: "hour" | "break"; id: string } | null>(null);
  const [copyArmed, setCopyArmed] = useState(false);
  const [copying, startCopy] = useTransition();
  const [saving, setSaving] = useState(false);
  const copyLock = useRef(false);
  const saveLock = useRef(false);

  function runSave(task: (formData: FormData) => Promise<ActionState>) {
    return async (formData: FormData) => {
      if (saveLock.current) {
        return { error: "Espere o salvamento terminar." };
      }
      saveLock.current = true;
      setSaving(true);
      try {
        return await task(formData);
      } finally {
        saveLock.current = false;
        setSaving(false);
      }
    };
  }

  function copyHours() {
    const plan = planHourCopy(
      hours.map((row) => ({ weekday: row.weekday, startTime: row.startTime, endTime: row.endTime })),
      day.value,
      WEEKDAYS.map((item) => item.value),
    );
    if (plan.emptySource) {
      toast.error(PERIOD_MESSAGES.copyEmpty);
      return;
    }
    if (copyLock.current || saveLock.current) return;
    copyLock.current = true;
    saveLock.current = true;
    startCopy(async () => {
      try {
        if (plan.targets.length === 0) {
          toast.success(PERIOD_MESSAGES.copyNone);
          setCopyArmed(false);
          return;
        }
        let copied = 0;
        for (const target of plan.targets) {
          const data = new FormData();
          data.set("memberId", memberId);
          data.set("weekday", String(target.weekday));
          data.set("startTime", target.startTime);
          data.set("endTime", target.endTime);
          const result = await addWorkingHourAction({}, data);
          if (result.error) {
            toast.error(copied > 0 ? `${result.error} ${PERIOD_MESSAGES.copyPartial}` : result.error);
            return;
          }
          copied += 1;
        }
        toast.success(PERIOD_MESSAGES.copyDone);
        setCopyArmed(false);
      } finally {
        copyLock.current = false;
        saveLock.current = false;
      }
    });
  }

  return (
    <Card className="border-none ring-1 ring-border">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-heading text-base leading-snug font-medium">{day.label}</h2>
            <CardDescription>
              {hasHours ? hourCountLabel(dayHours.length) : "Sem atendimento neste dia"}
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full sm:w-auto"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={
              open
                ? `Fechar ${day.label}`
                : hasHours
                  ? `Ver e editar ${day.label}`
                  : `Definir horário de ${day.label}`
            }
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Fechar" : hasHours ? "Ver e editar" : "Definir horário"}
          </Button>
        </div>
      </CardHeader>
      {open ? (
        <CardContent id={panelId} className="grid gap-4">
          {dayHours.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum horário neste dia. Informe de que horas até que horas você atende.</p>
          ) : (
            dayHours.map((row) => (
              <PeriodRow
                key={row.id}
                row={row}
                editing={editing?.kind === "hour" && editing.id === row.id}
                canEdit={canEdit}
                memberId={memberId}
                weekday={day.value}
                kind="hour"
                existing={dayHours}
                busy={saving || copying}
                onEdit={() => setEditing({ kind: "hour", id: row.id })}
                onCancelEdit={() => setEditing(null)}
                onRemove={deleteWorkingHourAction}
                confirmTitle="Remover este horário de atendimento?"
                guardSave={runSave}
              />
            ))
          )}
          {dayBreaks.length > 0 ? (
            <div className="grid gap-2">
              <p className="text-sm font-medium">Pausas, como o almoço</p>
              {dayBreaks.map((row) => (
                <PeriodRow
                  key={row.id}
                  row={row}
                  extra={row.label}
                  editing={editing?.kind === "break" && editing.id === row.id}
                  canEdit={canEdit}
                  memberId={memberId}
                  weekday={day.value}
                  kind="break"
                  existing={dayBreaks}
                  busy={saving || copying}
                  onEdit={() => setEditing({ kind: "break", id: row.id })}
                  onCancelEdit={() => setEditing(null)}
                  onRemove={deleteBreakAction}
                  confirmTitle="Remover esta pausa?"
                  guardSave={runSave}
                />
              ))}
            </div>
          ) : null}
          {canEdit ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <PeriodForm
                formKey={`add-hour-${day.value}`}
                legend="Adicionar horário"
                submitLabel="Adicionar horário"
                accessibleSubmitLabel={`Adicionar horário em ${day.label}`}
                pendingLabel="Salvando..."
                hidden={{ memberId, weekday: String(day.value) }}
                blocked={saving || copying}
                validate={(data) =>
                  describePeriodProblem(String(data.get("startTime") ?? ""), String(data.get("endTime") ?? ""), dayHours)
                }
                save={runSave((data) => addWorkingHourAction({}, data))}
              />
              <PeriodForm
                formKey={`add-break-${day.value}`}
                legend="Adicionar pausa"
                submitLabel="Adicionar pausa"
                accessibleSubmitLabel={`Adicionar pausa em ${day.label}`}
                pendingLabel="Salvando..."
                variant="outline"
                hidden={{ memberId, weekday: String(day.value) }}
                showLabel
                blocked={saving || copying}
                validate={(data) =>
                  describePeriodProblem(String(data.get("startTime") ?? ""), String(data.get("endTime") ?? ""), dayBreaks)
                }
                save={runSave((data) => addBreakAction({}, data))}
              />
            </div>
          ) : null}
          {canEdit && hasHours ? (
            copyArmed ? (
              <div className="grid gap-2 rounded-xl bg-secondary/50 p-3">
                <p className="text-sm">
                  Usar estes horários nos outros dias que ainda estão vazios? Dias que já têm horário ficam como estão. As pausas não são copiadas.
                </p>
                {copying ? (
                  <p role="status" className="text-sm text-muted-foreground">
                    Copiando horários. Espere um instante.
                  </p>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="button" className="h-11 w-full sm:w-auto" disabled={copying || saving} onClick={copyHours}>
                    {copying ? "Copiando..." : "Sim, copiar"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full sm:w-auto"
                    disabled={copying}
                    onClick={() => setCopyArmed(false)}
                  >
                    Voltar
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full sm:w-auto"
                disabled={saving}
                aria-label={`Usar estes horários nos outros dias, a partir de ${day.label}`}
                onClick={() => setCopyArmed(true)}
              >
                Usar estes horários nos outros dias
              </Button>
            )
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
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
  const [savingBlock, setSavingBlock] = useState(false);

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm text-muted-foreground">Horários de trabalho</p>
        <h1 className="font-serif text-3xl">{memberName}</h1>
        <ContextualHint className="mt-2 max-w-2xl">
          Toque em Definir horário no dia, informe de que horas até que horas você atende e toque em Adicionar horário.
          A pausa, como o almoço, não aparece para clientes marcarem. Horário de {timezoneDisplayName(timezone)}.
        </ContextualHint>
      </div>

      <div className="grid gap-4">
        {WEEKDAYS.map((day) => (
          <DaySchedule
            key={day.value}
            day={day}
            memberId={memberId}
            hours={hours}
            breaks={breaks}
            canEdit={canEditJornada}
          />
        ))}
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
                <div key={block.id} className="flex flex-col gap-3 rounded-xl bg-secondary/40 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">
                      {block.localDate.split("-").reverse().join("/")} · {block.localStart.slice(0, 5)}–{block.localEnd.slice(0, 5)}
                    </p>
                    <p className="text-sm text-muted-foreground">{block.reason ?? "Folga"}</p>
                  </div>
                  {canEditBlocks ? (
                    <RemoveButton
                      title="Remover esta folga?"
                      description="O horário volta a aparecer para clientes marcarem."
                      memberId={memberId}
                      id={block.id}
                      label={`Remover folga ${block.localDate.split("-").reverse().join("/")}`}
                      remove={deleteTimeBlockAction}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          )}
          {canEditBlocks ? (
            <PeriodForm
              formKey="add-block"
              legend="Marcar uma folga"
              submitLabel="Marcar folga neste horário"
              pendingLabel="Salvando..."
              hidden={{ memberId }}
              dateField
              reasonField
              blocked={savingBlock}
              validate={(data) =>
                describeBlockProblem(
                  String(data.get("localDate") ?? ""),
                  String(data.get("startTime") ?? ""),
                  String(data.get("endTime") ?? ""),
                  blocks,
                )
              }
              save={async (data) => {
                setSavingBlock(true);
                try {
                  return await addTimeBlockAction({}, data);
                } finally {
                  setSavingBlock(false);
                }
              }}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
