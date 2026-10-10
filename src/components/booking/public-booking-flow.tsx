"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { BrandLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createPublicAppointmentAction, fetchPublicSlotsAction } from "@/lib/booking/actions";
import {
  ANY_PROFESSIONAL,
  BOOKING_STEPS,
  CUSTOMER_NOTE_MAX,
  type BookingStep,
} from "@/lib/booking/config";
import {
  bookingWhatsAppText,
  buildIcs,
  buildWhatsAppLink,
  formatSlotLabel,
  googleCalendarUrl,
  icsDataUrl,
} from "@/lib/booking/calendar";
import type {
  PublicBookingCatalog,
  PublicBookingConfirmation,
  PublicBookingProfessional,
  PublicBookingService,
} from "@/lib/booking/queries";
import { parsePublicBookingDetails, previousBookingStep } from "@/lib/booking/validation";
import { bookingStepCaption, shouldSkipProfessionalStep } from "@/lib/usability/copy";
import { addDaysIso, formatDateTimeInTimeZone, weekdayInTimeZone, zonedWallTimeToUtc } from "@/lib/time/timezone";
import { formatPhoneBr } from "@/lib/validation/phone";
import { formatCentsToReais } from "@/lib/validation/money";

const STEP_LABEL: Record<BookingStep, string> = {
  service: "Serviço",
  professional: "Profissional",
  date: "Data",
  slot: "Horário",
  details: "Seus dados",
  confirm: "Confirmar",
};

const PICKER_BUTTON =
  "rounded-3xl bg-card p-5 text-left ring-1 ring-border transition hover:ring-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

const SLOT_BUTTON =
  "min-h-12 rounded-2xl bg-card text-sm font-medium ring-1 ring-border transition hover:ring-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60";

function formatIsoDateLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

type Prefill = {
  fullName: string;
  phone: string;
  email: string;
};

export function PublicBookingFlow({
  catalog,
  prefill,
  today,
  initialServiceId = null,
  hasClientProfile = false,
}: {
  catalog: PublicBookingCatalog;
  prefill: Prefill;
  today: string;
  initialServiceId?: string | null;
  hasClientProfile?: boolean;
}) {
  const initialService =
    initialServiceId && catalog.services.some((item) => item.id === initialServiceId)
      ? initialServiceId
      : null;
  const [step, setStep] = useState<BookingStep>(initialService ? "professional" : "service");
  const [serviceId, setServiceId] = useState<string | null>(initialService);
  const [professionalId, setProfessionalId] = useState<string | null | typeof ANY_PROFESSIONAL>(null);
  const [localDate, setLocalDate] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [fullName, setFullName] = useState(prefill.fullName);
  const [phone, setPhone] = useState(prefill.phone);
  const [email, setEmail] = useState(prefill.email);
  const [customerNote, setCustomerNote] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [confirmation, setConfirmation] = useState<PublicBookingConfirmation | null>(null);
  const [pending, startTransition] = useTransition();
  const slotsRequestId = useRef(0);

  const service = catalog.services.find((item) => item.id === serviceId) ?? null;
  const professionalsForService = useMemo(
    () => catalog.professionals.filter((person) => (serviceId ? person.serviceIds.includes(serviceId) : false)),
    [catalog.professionals, serviceId],
  );
  const professional =
    professionalId && professionalId !== ANY_PROFESSIONAL
      ? (professionalsForService.find((person) => person.id === professionalId) ?? null)
      : null;
  const offering = professional?.offerings.find((item) => item.serviceId === serviceId) ?? null;

  useEffect(() => {
    if (step !== "professional") {
      return;
    }
    if (shouldSkipProfessionalStep(professionalsForService.length) && professionalsForService[0] && professionalId === null) {
      selectProfessional(professionalsForService[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- local helper would retrigger every render
  }, [step, professionalsForService, professionalId]);

  useEffect(() => {
    if (step !== "slot" || !serviceId || !localDate || professionalId === null) {
      return;
    }
    const requestId = ++slotsRequestId.current;
    const memberId = professionalId === ANY_PROFESSIONAL ? null : professionalId;
    let cancelled = false;
    startTransition(async () => {
      const result = await fetchPublicSlotsAction({
        slug: catalog.slug,
        serviceId,
        professionalMemberId: memberId,
        localDate,
      });
      if (cancelled || requestId !== slotsRequestId.current) {
        return;
      }
      setSlots(result.slots);
      setSlotsError(result.error ?? null);
      setSlotsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [step, serviceId, professionalId, localDate, catalog.slug]);

  function go(next: BookingStep) {
    setFormError(null);
    setStep(next);
  }

  function selectService(next: PublicBookingService) {
    setServiceId(next.id);
    setProfessionalId(null);
    setLocalDate(null);
    setStartsAt(null);
    setSlots([]);
    setSlotsError(null);
    setSlotsLoading(false);
    const people = catalog.professionals.filter((person) => person.serviceIds.includes(next.id));
    if (shouldSkipProfessionalStep(people.length) && people[0]) {
      selectProfessional(people[0].id);
      return;
    }
    go("professional");
  }

  function selectProfessional(id: string | typeof ANY_PROFESSIONAL) {
    setProfessionalId(id);
    setLocalDate(null);
    setStartsAt(null);
    setSlots([]);
    setSlotsError(null);
    setSlotsLoading(false);
    go("date");
  }

  function selectDate(date: string) {
    setLocalDate(date);
    setStartsAt(null);
    setSlots([]);
    setSlotsError(null);
    setSlotsLoading(true);
    go("slot");
  }

  function submitDetails() {
    const parsed = parsePublicBookingDetails({ fullName, phone, email, customerNote });
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!nextErrors[key]) nextErrors[key] = issue.message;
      }
      setFieldErrors(nextErrors);
      setFormError("Confira nome, celular e e-mail.");
      return;
    }
    setFieldErrors({});
    setFullName(parsed.data.fullName);
    setPhone(parsed.data.phone);
    setEmail(parsed.data.email);
    setCustomerNote(parsed.data.customerNote ?? "");
    go("confirm");
  }

  function confirm() {
    if (!serviceId || professionalId === null || !startsAt) {
      setFormError("Escolha serviço, profissional e horário.");
      return;
    }
    startTransition(async () => {
      const result = await createPublicAppointmentAction({
        slug: catalog.slug,
        serviceId,
        professionalMemberId: professionalId === ANY_PROFESSIONAL ? null : professionalId,
        startsAt,
        fullName,
        phone,
        email,
        customerNote: customerNote || null,
      });
      if (result.error) {
        setFormError(result.error);
        return;
      }
      if (result.confirmation) {
        setConfirmation(result.confirmation);
      }
    });
  }

  function proceedAfterSlot(slot: string) {
    setStartsAt(slot);
    const parsed = parsePublicBookingDetails({ fullName, phone, email, customerNote });
    if (parsed.success) {
      setFieldErrors({});
      setFullName(parsed.data.fullName);
      setPhone(parsed.data.phone);
      setEmail(parsed.data.email);
      setCustomerNote(parsed.data.customerNote ?? "");
      go("confirm");
      return;
    }
    go("details");
  }

  const visibleSteps: BookingStep[] =
    shouldSkipProfessionalStep(professionalsForService.length) && step !== "professional"
      ? BOOKING_STEPS.filter((item) => item !== "professional")
      : [...BOOKING_STEPS];
  const stepIndex = visibleSteps.indexOf(step);

  if (confirmation) {
    return (
      <BookingSuccess
        confirmation={confirmation}
        guestHint={confirmation.guest}
        hasClientProfile={hasClientProfile}
      />
    );
  }

  return (
    <div className="agende-bloom min-h-full">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-lg items-center justify-between px-4">
          <BrandLogo size="sm" />
          <Link href={`/p/${catalog.slug}`} className="inline-flex min-h-11 items-center text-sm underline-offset-4 hover:underline">
            Voltar ao salão
          </Link>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-lg gap-6 px-4 py-6 pb-28">
        <div>
          <p className="text-xs tracking-[0.18em] text-primary uppercase">{catalog.name}</p>
          <h1 className="font-serif text-3xl">Agendar horário</h1>
        </div>

        <ol className="flex gap-1" aria-label="Etapas do agendamento">
          {visibleSteps.map((item, index) => (
            <li key={item} className="min-w-0 flex-1">
              <div
                className={`h-1.5 rounded-full ${index <= stepIndex ? "bg-primary" : "bg-border"}`}
                aria-current={item === step ? "step" : undefined}
              />
              <span className="sr-only">
                {STEP_LABEL[item]}
                {item === step ? " (atual)" : ""}
              </span>
            </li>
          ))}
        </ol>
        <p className="text-base font-medium">
          {bookingStepCaption(step, Math.max(stepIndex, 0), visibleSteps.length)}
        </p>

        {step === "service" ? (
          <section className="grid gap-3" aria-label="Escolher serviço">
            {catalog.services.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum serviço disponível no momento.</p>
            ) : (
              catalog.services.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectService(item)}
                  className={PICKER_BUTTON}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-medium">{item.name}</h2>
                      {item.description ? (
                        <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                      ) : null}
                    </div>
                    <p className="text-sm whitespace-nowrap">
                      {item.minPriceCents !== item.maxPriceCents
                        ? `a partir de ${formatCentsToReais(item.minPriceCents)}`
                        : formatCentsToReais(item.minPriceCents)}
                    </p>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{item.durationMinutes} minutos</p>
                </button>
              ))
            )}
          </section>
        ) : null}

        {step === "professional" ? (
          <ProfessionalStep
            people={professionalsForService}
            service={service}
            onSelect={selectProfessional}
          />
        ) : null}

        {step === "date" ? (
          <DateStep
            timezone={catalog.timezone}
            horizonDays={catalog.horizonDays}
            today={today}
            selected={localDate}
            onSelect={selectDate}
          />
        ) : null}

        {step === "slot" ? (
          <section className="grid gap-3" aria-label="Escolher horário">
            {localDate ? (
              <p className="text-sm font-medium">Horários para {formatIsoDateLabel(localDate)}</p>
            ) : null}
            {slotsLoading ? (
              <p className="text-sm text-muted-foreground" role="status">
                Buscando horários…
              </p>
            ) : null}
            {slotsError ? (
              <p className="text-sm text-destructive" role="alert">
                {slotsError}
              </p>
            ) : null}
            {!slotsLoading && slots.length === 0 && !slotsError ? (
              <div className="grid gap-3 rounded-3xl bg-secondary/50 p-4">
                <p className="text-sm text-muted-foreground">Não há horários livres neste dia. Toque em Voltar e escolha outro dia.</p>
                <Button type="button" variant="outline" className="h-11 rounded-full" onClick={() => go("date")}>
                  Escolher outro dia
                </Button>
              </div>
            ) : null}
            {!slotsLoading && slots.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    disabled={pending}
                    onClick={() => proceedAfterSlot(slot)}
                    className={SLOT_BUTTON}
                  >
                    {formatSlotLabel(slot, catalog.timezone)}
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {step === "details" ? (
          <section className="grid gap-4" aria-label="Seus dados">
            <div className="grid gap-2">
              <Label htmlFor="fullName">Nome completo</Label>
              <Input
                id="fullName"
                name="fullName"
                autoComplete="name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="h-12 rounded-2xl"
                required
                aria-invalid={Boolean(fieldErrors.fullName)}
                aria-describedby={fieldErrors.fullName ? "fullName-error" : undefined}
              />
              {fieldErrors.fullName ? (
                <p id="fullName-error" className="text-sm text-destructive">
                  {fieldErrors.fullName}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Celular</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(formatPhoneBr(event.target.value))}
                className="h-12 rounded-2xl"
                required
                aria-invalid={Boolean(fieldErrors.phone)}
                aria-describedby={fieldErrors.phone ? "phone-error" : undefined}
              />
              {fieldErrors.phone ? (
                <p id="phone-error" className="text-sm text-destructive">
                  {fieldErrors.phone}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-12 rounded-2xl"
                required
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? "email-error" : undefined}
              />
              {fieldErrors.email ? (
                <p id="email-error" className="text-sm text-destructive">
                  {fieldErrors.email}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="customerNote">Alguma preferência? (opcional)</Label>
              <Textarea
                id="customerNote"
                name="customerNote"
                value={customerNote}
                maxLength={CUSTOMER_NOTE_MAX}
                onChange={(event) => setCustomerNote(event.target.value)}
                className="min-h-24 rounded-2xl"
              />
            </div>
            <Button type="button" className="h-12 w-full rounded-full" onClick={submitDetails}>
              Continuar
            </Button>
          </section>
        ) : null}

        {step === "confirm" && (!service || !startsAt) ? (
          <p className="text-sm text-destructive" role="alert">
            Faltam dados para confirmar. Volte e escolha o horário novamente.
          </p>
        ) : null}

        {step === "confirm" && service && startsAt ? (
          <section className="grid gap-4" aria-label="Confirmar agendamento">
            <article className="rounded-[2rem] bg-card p-5 ring-1 ring-border">
              <SummaryRow label="Serviço" value={service.name} />
              <SummaryRow
                label="Profissional"
                value={professionalId === ANY_PROFESSIONAL ? "Qualquer profissional disponível" : (professional?.displayName ?? "—")}
              />
              <SummaryRow label="Quando" value={formatDateTimeInTimeZone(startsAt, catalog.timezone)} />
              <SummaryRow
                label="Duração"
                value={`${offering?.durationMinutes ?? service.durationMinutes} minutos`}
              />
              <SummaryRow
                label="Valor"
                value={
                  professionalId === ANY_PROFESSIONAL && service.minPriceCents !== service.maxPriceCents
                    ? `a partir de ${formatCentsToReais(service.minPriceCents)}`
                    : formatCentsToReais(offering?.priceCents ?? service.priceCents)
                }
              />
              <SummaryRow label="Nome" value={fullName} />
              <SummaryRow label="Celular" value={phone} />
              <SummaryRow label="E-mail" value={email} />
            </article>
            <Button
              type="button"
              className="h-12 w-full rounded-full"
              disabled={pending}
              onClick={confirm}
            >
              {pending ? "Reservando…" : "Reservar este horário"}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" className="h-11" onClick={() => go("service")}>
                Mudar serviço
              </Button>
              <Button type="button" variant="outline" className="h-11" onClick={() => go("date")}>
                Mudar dia
              </Button>
              <Button type="button" variant="outline" className="h-11" onClick={() => go("slot")}>
                Mudar horário
              </Button>
              <Button type="button" variant="outline" className="h-11" onClick={() => go("details")}>
                Alterar meus dados
              </Button>
            </div>
          </section>
        ) : null}

        {formError ? (
          <p className="text-sm text-destructive" role="alert">
            {formError}
          </p>
        ) : null}
      </main>

      {step !== "service" ? (
        <div className="fixed right-0 bottom-0 left-0 border-t border-border/70 bg-background/90 p-4 backdrop-blur-md">
          <div className="mx-auto max-w-lg">
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full rounded-full"
              onClick={() => go(previousBookingStep(step))}
            >
              Voltar
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProfessionalStep({
  people,
  service,
  onSelect,
}: {
  people: PublicBookingProfessional[];
  service: PublicBookingService | null;
  onSelect: (id: string | typeof ANY_PROFESSIONAL) => void;
}) {
  if (people.length === 0) {
    return (
      <section className="grid gap-3" aria-label="Escolher profissional">
        <p className="rounded-3xl bg-secondary/50 p-5 text-sm" role="status">
          Nenhuma profissional atende este serviço no momento. Volte e escolha outro serviço, ou fale com o
          salão.
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-3" aria-label="Escolher profissional">
      <button
        type="button"
        onClick={() => onSelect(ANY_PROFESSIONAL)}
        className="min-h-16 rounded-3xl bg-secondary/60 p-5 text-left ring-1 ring-border transition hover:ring-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <h2 className="font-serif text-2xl">Tanto faz (quem estiver livre)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolhemos quem estiver livre naquele horário.
        </p>
      </button>
      {people.map((person) => (
        <button
          key={person.id}
          type="button"
          onClick={() => onSelect(person.id)}
          className={PICKER_BUTTON}
        >
          <h2 className="font-serif text-2xl">{person.displayName}</h2>
          {person.bio ? <p className="mt-1 text-sm text-muted-foreground">{person.bio}</p> : null}
          {service ? (
            <p className="mt-3 text-sm">
              {formatCentsToReais(
                person.offerings.find((item) => item.serviceId === service.id)?.priceCents ?? service.priceCents,
              )}
              {" · "}
              {person.offerings.find((item) => item.serviceId === service.id)?.durationMinutes ??
                service.durationMinutes}{" "}
              min
            </p>
          ) : null}
        </button>
      ))}
    </section>
  );
}

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function DateStep({
  timezone,
  horizonDays,
  today,
  selected,
  onSelect,
}: {
  timezone: string;
  horizonDays: number;
  today: string;
  selected: string | null;
  onSelect: (date: string) => void;
}) {
  const last = addDaysIso(today, horizonDays);
  const months = useMemo(() => {
    const days: string[] = [];
    for (let cursor = today; cursor <= last; cursor = addDaysIso(cursor, 1)) {
      days.push(cursor);
    }
    const grouped = new Map<string, string[]>();
    for (const day of days) {
      const key = day.slice(0, 7);
      const list = grouped.get(key) ?? [];
      list.push(day);
      grouped.set(key, list);
    }
    return [...grouped.entries()];
  }, [today, last]);

  return (
    <section className="grid gap-4" aria-label="Escolher data">
      <p className="text-sm text-muted-foreground">
        Toque no dia que você quer. Mostramos os próximos {horizonDays} dias no horário do salão.
      </p>
      {months.map(([monthKey, days]) => {
        const monthLabel = new Intl.DateTimeFormat("pt-BR", {
          timeZone: timezone,
          month: "long",
          year: "numeric",
        }).format(zonedWallTimeToUtc(days[0] ?? today, "12:00", timezone));
        const pad = weekdayInTimeZone(zonedWallTimeToUtc(days[0] ?? today, "12:00", timezone), timezone);
        return (
          <div key={monthKey} className="grid gap-2">
            <h2 className="font-serif text-2xl capitalize">{monthLabel}</h2>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
              {WEEKDAY_LABELS.map((label, index) => (
                <span key={`${monthKey}-${label}-${index}`} className="py-1">
                  {label}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: pad }).map((_, index) => (
                <span key={`${monthKey}-pad-${index}`} className="min-h-11" />
              ))}
              {days.map((date) => {
                const isSelected = selected === date;
                const dayNumber = date.slice(8, 10);
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => onSelect(date)}
                    aria-pressed={isSelected}
                    aria-label={new Intl.DateTimeFormat("pt-BR", {
                      timeZone: timezone,
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    }).format(zonedWallTimeToUtc(date, "12:00", timezone))}
                    className={`min-h-11 rounded-2xl text-sm ring-1 transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                      isSelected
                        ? "bg-primary text-primary-foreground ring-primary"
                        : "bg-card ring-border hover:ring-primary"
                    }`}
                  >
                    {Number(dayNumber)}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-3 last:border-b-0">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-right text-sm font-medium">{value}</p>
    </div>
  );
}

function BookingSuccess({
  confirmation,
  guestHint,
  hasClientProfile,
}: {
  confirmation: PublicBookingConfirmation;
  guestHint: boolean;
  hasClientProfile: boolean;
}) {
  const ics = buildIcs({
    title: `${confirmation.serviceName} · ${confirmation.workspaceName}`,
    description: `Agendamento com ${confirmation.professionalName} no ${confirmation.workspaceName}.`,
    startsAt: confirmation.startsAt,
    endsAt: confirmation.endsAt,
    location: confirmation.workspaceName,
  });
  const whatsapp = buildWhatsAppLink(
    confirmation.businessPhone,
    bookingWhatsAppText({
      serviceName: confirmation.serviceName,
      startsAt: confirmation.startsAt,
      timezone: confirmation.timezone,
    }),
  );

  return (
    <div className="agende-bloom min-h-full">
      <header className="border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-lg items-center px-4">
          <BrandLogo size="sm" />
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-lg gap-6 px-4 py-10">
        <section className="rounded-[2rem] bg-card p-6 text-center ring-1 ring-border">
          <p className="text-xs tracking-[0.18em] text-primary uppercase">Pronto</p>
          <h1 className="mt-2 font-serif text-4xl">Seu horário está reservado</h1>
          <p className="mt-3 text-muted-foreground">{confirmation.workspaceName}</p>
        </section>
        <article className="rounded-[2rem] bg-card p-5 ring-1 ring-border">
          <SummaryRow label="Serviço" value={confirmation.serviceName} />
          <SummaryRow label="Profissional" value={confirmation.professionalName} />
          <SummaryRow
            label="Quando"
            value={formatDateTimeInTimeZone(confirmation.startsAt, confirmation.timezone)}
          />
          <SummaryRow label="Valor" value={formatCentsToReais(confirmation.priceCents)} />
        </article>
        <div className="grid gap-3">
          <Button className="h-12 rounded-full" render={<a href={icsDataUrl(ics)} download="agende.ics" />}>
            Adicionar ao calendário
          </Button>
          <Button
            variant="outline"
            className="h-12 rounded-full"
            render={
              <a
                href={googleCalendarUrl({
                  title: `${confirmation.serviceName} · ${confirmation.workspaceName}`,
                  details: `Com ${confirmation.professionalName}`,
                  startsAt: confirmation.startsAt,
                  endsAt: confirmation.endsAt,
                })}
                target="_blank"
                rel="noreferrer"
              />
            }
          >
            Abrir no Google Agenda
          </Button>
          {whatsapp ? (
            <Button variant="outline" className="h-12 rounded-full" render={<a href={whatsapp} target="_blank" rel="noreferrer" />}>
              Falar com o salão
            </Button>
          ) : null}
        </div>
        {guestHint ? (
          <p className="text-center text-sm text-muted-foreground">
            Quer ver todos os seus horários aqui? Crie uma conta grátis.{" "}
            <Link
              href="/cadastro?intent=client&next=/cliente/agendamentos"
              className="underline underline-offset-4"
            >
              Criar conta
            </Link>
          </p>
        ) : hasClientProfile ? (
          <p className="text-center text-sm">
            <Link href="/cliente/agendamentos" className="underline underline-offset-4">
              Ver meus agendamentos
            </Link>
          </p>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            Seus horários ficam neste e-mail. Guarde a confirmação.
          </p>
        )}
      </main>
    </div>
  );
}
