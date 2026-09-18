"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
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
import { addDaysIso, formatDateTimeInTimeZone, todayInTimeZone, weekdayInTimeZone, zonedWallTimeToUtc } from "@/lib/time/timezone";
import { formatCentsToReais } from "@/lib/validation/money";

const STEP_LABEL: Record<BookingStep, string> = {
  service: "Serviço",
  professional: "Profissional",
  date: "Data",
  slot: "Horário",
  details: "Seus dados",
  confirm: "Confirmar",
};

type Prefill = {
  fullName: string;
  phone: string;
  email: string;
};

export function PublicBookingFlow({
  catalog,
  prefill,
}: {
  catalog: PublicBookingCatalog;
  prefill: Prefill;
}) {
  const [step, setStep] = useState<BookingStep>("service");
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [professionalId, setProfessionalId] = useState<string | null | typeof ANY_PROFESSIONAL>(null);
  const [localDate, setLocalDate] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [fullName, setFullName] = useState(prefill.fullName);
  const [phone, setPhone] = useState(prefill.phone);
  const [email, setEmail] = useState(prefill.email);
  const [customerNote, setCustomerNote] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [confirmation, setConfirmation] = useState<PublicBookingConfirmation | null>(null);
  const [pending, startTransition] = useTransition();

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
    if (step !== "slot" || !serviceId || !localDate || professionalId === null) {
      return;
    }
    const memberId = professionalId === ANY_PROFESSIONAL ? null : professionalId;
    startTransition(async () => {
      const result = await fetchPublicSlotsAction({
        slug: catalog.slug,
        serviceId,
        professionalMemberId: memberId,
        localDate,
      });
      setSlots(result.slots);
      setSlotsError(result.error ?? null);
    });
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
    go("professional");
  }

  function selectProfessional(id: string | typeof ANY_PROFESSIONAL) {
    setProfessionalId(id);
    setLocalDate(null);
    setStartsAt(null);
    go("date");
  }

  function selectDate(date: string) {
    setLocalDate(date);
    setStartsAt(null);
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
      setFormError("Revise os campos destacados.");
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

  const stepIndex = BOOKING_STEPS.indexOf(step);

  if (confirmation) {
    return <BookingSuccess confirmation={confirmation} guestHint={confirmation.guest} />;
  }

  return (
    <div className="agende-bloom min-h-full">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-lg items-center justify-between px-4">
          <BrandLogo size="sm" />
          <Link href={`/p/${catalog.slug}`} className="text-sm underline-offset-4 hover:underline">
            Ver perfil
          </Link>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-lg gap-6 px-4 py-6 pb-28">
        <div>
          <p className="text-xs tracking-[0.18em] text-primary uppercase">{catalog.name}</p>
          <h1 className="font-serif text-3xl">Agendar horário</h1>
        </div>

        <ol className="flex gap-1" aria-label="Etapas do agendamento">
          {BOOKING_STEPS.map((item, index) => (
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
        <p className="text-sm text-muted-foreground">
          {stepIndex + 1} de {BOOKING_STEPS.length} · {STEP_LABEL[step]}
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
                  className="rounded-3xl bg-card p-5 text-left ring-1 ring-border transition hover:ring-primary"
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
            selected={localDate}
            onSelect={selectDate}
          />
        ) : null}

        {step === "slot" ? (
          <section className="grid gap-3" aria-label="Escolher horário">
            {pending && slots.length === 0 ? (
              <p className="text-sm text-muted-foreground" role="status">
                Buscando horários…
              </p>
            ) : null}
            {slotsError ? <p className="text-sm text-destructive">{slotsError}</p> : null}
            {!pending && slots.length === 0 && !slotsError ? (
              <p className="text-sm text-muted-foreground">Nenhum horário neste dia. Escolha outra data.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => {
                      setStartsAt(slot);
                      go("details");
                    }}
                    className="min-h-12 rounded-2xl bg-card text-sm font-medium ring-1 ring-border hover:ring-primary"
                  >
                    {formatSlotLabel(slot, catalog.timezone)}
                  </button>
                ))}
              </div>
            )}
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
                aria-invalid={Boolean(fieldErrors.fullName)}
              />
              {fieldErrors.fullName ? <p className="text-sm text-destructive">{fieldErrors.fullName}</p> : null}
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
                onChange={(event) => setPhone(event.target.value)}
                className="h-12 rounded-2xl"
                aria-invalid={Boolean(fieldErrors.phone)}
              />
              {fieldErrors.phone ? <p className="text-sm text-destructive">{fieldErrors.phone}</p> : null}
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
                aria-invalid={Boolean(fieldErrors.email)}
              />
              {fieldErrors.email ? <p className="text-sm text-destructive">{fieldErrors.email}</p> : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="customerNote">Observação para o profissional (opcional)</Label>
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
              Revisar agendamento
            </Button>
          </section>
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
              {pending ? "Reservando…" : "Confirmar agendamento"}
            </Button>
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
  return (
    <section className="grid gap-3" aria-label="Escolher profissional">
      <button
        type="button"
        onClick={() => onSelect(ANY_PROFESSIONAL)}
        className="rounded-3xl bg-secondary/60 p-5 text-left ring-1 ring-border hover:ring-primary"
      >
        <h2 className="font-serif text-2xl">Qualquer profissional disponível</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          O Agendê escolhe a primeira profissional livre neste horário.
        </p>
      </button>
      {people.map((person) => (
        <button
          key={person.id}
          type="button"
          onClick={() => onSelect(person.id)}
          className="rounded-3xl bg-card p-5 text-left ring-1 ring-border hover:ring-primary"
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

const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];

function DateStep({
  timezone,
  horizonDays,
  selected,
  onSelect,
}: {
  timezone: string;
  horizonDays: number;
  selected: string | null;
  onSelect: (date: string) => void;
}) {
  const today = todayInTimeZone(timezone);
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
        Datas nos próximos {horizonDays} dias, no fuso do estabelecimento.
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
                    className={`min-h-11 rounded-2xl text-sm ring-1 ${
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
}: {
  confirmation: PublicBookingConfirmation;
  guestHint: boolean;
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
          <h1 className="mt-2 font-serif text-4xl">Seu horário está reservado ✨</h1>
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
            Google Agenda
          </Button>
          {whatsapp ? (
            <Button variant="outline" className="h-12 rounded-full" render={<a href={whatsapp} target="_blank" rel="noreferrer" />}>
              Falar com o estabelecimento
            </Button>
          ) : null}
        </div>
        {guestHint ? (
          <p className="text-center text-sm text-muted-foreground">
            Crie sua conta para acompanhar seus agendamentos.{" "}
            <Link href={`/cadastro?next=/cliente/agendamentos`} className="underline underline-offset-4">
              Criar conta
            </Link>
          </p>
        ) : (
          <p className="text-center text-sm">
            <Link href="/cliente/agendamentos" className="underline underline-offset-4">
              Ver meus agendamentos
            </Link>
          </p>
        )}
      </main>
    </div>
  );
}
