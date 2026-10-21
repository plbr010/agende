"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { BrandLogo } from "@/components/brand/logo";
import { PersonMark } from "@/components/people/person-mark";
import { FloralBranch, FloralCorner, FloralSprig } from "@/components/brand/floral";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createPublicAppointmentAction, fetchPublicSlotsAction } from "@/lib/booking/actions";
import { continueBookingAfterLogin } from "@/lib/booking/draft-actions";
import type { BookingDraft } from "@/lib/booking/draft";
import {
  ANY_PROFESSIONAL,
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
import { bookingReceiptCopy } from "@/lib/booking/receipt";
import { bookingBackStep, bookingJourneySteps, parsePublicBookingDetails } from "@/lib/booking/validation";
import { bookingStepCaption, shouldSkipProfessionalStep } from "@/lib/usability/copy";
import { addDaysIso, formatDateTimeInTimeZone, weekdayInTimeZone, zonedWallTimeToUtc } from "@/lib/time/timezone";
import { formatPhoneBr } from "@/lib/validation/phone";
import { formatCentsToReais } from "@/lib/validation/money";
import { cn } from "@/lib/utils";

const STEP_LABEL: Record<BookingStep, string> = {
  service: "Serviço",
  professional: "Profissional",
  date: "Data",
  slot: "Horário",
  details: "Seus dados",
  confirm: "Confirmar",
};

const PICKER_BUTTON =
  "agende-panel rounded-[1.25rem] p-5 text-left ring-1 ring-[#f0e4de] transition hover:ring-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

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
  authenticated = false,
  initialDraft = null,
  initialDraftSlotUnavailable = false,
  initialProfessionalUnavailable = false,
  initialAvailabilityError = null,
}: {
  catalog: PublicBookingCatalog;
  prefill: Prefill;
  today: string;
  initialServiceId?: string | null;
  hasClientProfile?: boolean;
  authenticated?: boolean;
  initialDraft?: BookingDraft | null;
  initialDraftSlotUnavailable?: boolean;
  initialProfessionalUnavailable?: boolean;
  initialAvailabilityError?: string | null;
}) {
  const initialService =
    initialServiceId && catalog.services.some((item) => item.id === initialServiceId)
      ? initialServiceId
      : null;
  const [step, setStep] = useState<BookingStep>(
    initialProfessionalUnavailable
      ? "professional"
      : initialDraft
        ? initialDraftSlotUnavailable || initialAvailabilityError
          ? "slot"
          : parsePublicBookingDetails({ ...prefill, customerNote: "" }).success
            ? "confirm"
            : "details"
        : initialService
          ? "professional"
          : "service",
  );
  const [serviceId, setServiceId] = useState<string | null>(initialDraft?.serviceId ?? initialService);
  const [professionalId, setProfessionalId] = useState<string | null | typeof ANY_PROFESSIONAL>(
    initialProfessionalUnavailable ? null : initialDraft ? initialDraft.professionalMemberId ?? ANY_PROFESSIONAL : null,
  );
  const [localDate, setLocalDate] = useState<string | null>(initialProfessionalUnavailable ? null : initialDraft?.localDate ?? null);
  const [startsAt, setStartsAt] = useState<string | null>(
    initialProfessionalUnavailable || initialDraftSlotUnavailable || initialAvailabilityError ? null : initialDraft?.startsAt ?? null,
  );
  const [fullName, setFullName] = useState(prefill.fullName);
  const [phone, setPhone] = useState(prefill.phone);
  const [email, setEmail] = useState(prefill.email);
  const [customerNote, setCustomerNote] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsAttempt, setSlotsAttempt] = useState(0);
  const [confirmationUnknown, setConfirmationUnknown] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(initialDraftSlotUnavailable || Boolean(initialAvailabilityError));
  const [formError, setFormError] = useState<string | null>(
    initialProfessionalUnavailable
      ? "Essa profissional não atende mais este serviço. Escolha outra pessoa."
      : initialAvailabilityError
        ? initialAvailabilityError
        : initialDraftSlotUnavailable
          ? "Esse horário foi ocupado enquanto você entrava. Escolha outro."
          : null,
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [confirmation, setConfirmation] = useState<PublicBookingConfirmation | null>(null);
  const [pending, startTransition] = useTransition();
  const reserving = useRef(false);
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
      }).catch(() => ({ slots: [], error: "Não foi possível carregar os horários. Tente novamente." }));
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
  }, [step, serviceId, professionalId, localDate, catalog.slug, slotsAttempt]);

  function go(next: BookingStep) {
    if (pending || reserving.current || confirmationUnknown) return;
    setFormError(null);
    if (next === "slot") {
      setStartsAt(null);
      setSlots([]);
      setSlotsError(null);
      setSlotsLoading(true);
    }
    setStep(next);
  }

  function selectService(next: PublicBookingService) {
    if (pending || reserving.current) return;
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
    if (reserving.current) return;
    setProfessionalId(id);
    setLocalDate(null);
    setStartsAt(null);
    setSlots([]);
    setSlotsError(null);
    setSlotsLoading(false);
    setFormError(null);
    setStep("date");
  }

  function selectDate(date: string) {
    if (pending || reserving.current) return;
    setLocalDate(date);
    setStartsAt(null);
    setSlots([]);
    setSlotsError(null);
    setSlotsLoading(true);
    go("slot");
  }

  function submitDetails() {
    if (pending || reserving.current) return;
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
    if (pending || reserving.current || confirmationUnknown) return;
    if (!serviceId || professionalId === null || !startsAt || !localDate) {
      setFormError("Escolha serviço, profissional e horário.");
      return;
    }
    const professionalMemberId = professionalId === ANY_PROFESSIONAL ? null : professionalId;
    reserving.current = true;
    startTransition(async () => {
      try {
        if (!authenticated) {
          const result = await continueBookingAfterLogin({
            slug: catalog.slug,
            serviceId,
            professionalMemberId,
            localDate,
            startsAt,
          }).catch(() => ({ error: "Não foi possível continuar para entrar. Tente novamente." }));
          if (result?.error) setFormError(result.error);
          return;
        }
        const result = await createPublicAppointmentAction({
          slug: catalog.slug,
          serviceId,
          professionalMemberId,
          startsAt,
          fullName,
          phone,
          email,
          customerNote: customerNote || null,
        }).catch(() => {
          setConfirmationUnknown(true);
          return { error: "Não foi possível confirmar a resposta. Confira Meus agendamentos antes de tentar novamente.", confirmation: undefined };
        });
        if (result.error) {
          setFormError(result.error);
          return;
        }
        if (result.confirmation) {
          setConfirmation(result.confirmation);
        }
      } finally {
        reserving.current = false;
      }
    });
  }

  function proceedAfterSlot(slot: string) {
    if (pending || reserving.current) return;
    setStartsAt(slot);
    if (!authenticated) {
      go("confirm");
      return;
    }
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

  const skipProfessional = shouldSkipProfessionalStep(professionalsForService.length);
  const visibleSteps: BookingStep[] = bookingJourneySteps({
    authenticated,
    skipProfessional,
    current: step,
  });
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
    <div className="agende-bloom relative min-h-full overflow-x-clip">
      <FloralBranch className="pointer-events-none absolute -left-12 bottom-24 h-44 w-32 opacity-70" />
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-lg items-center justify-between px-4">
          <BrandLogo size="sm" />
          <Link
            href={`/p/${catalog.slug}`}
            aria-disabled={pending}
            tabIndex={pending ? -1 : undefined}
            className={cn(
              "inline-flex min-h-11 items-center text-sm underline-offset-4 hover:underline",
              pending && "pointer-events-none opacity-60",
            )}
          >
            Voltar ao salão
          </Link>
        </div>
      </header>
      <main className="relative z-10 mx-auto grid w-full max-w-lg gap-6 px-4 py-6 pb-28">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs tracking-[0.18em] text-primary uppercase">{catalog.name}</p>
            <h1 className="font-serif text-3xl text-wine-deep">Agendar horário</h1>
          </div>
          <FloralSprig className="h-16 w-12 shrink-0" />
        </div>

        <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Etapas do agendamento">
          {visibleSteps.map((item, index) => (
            <li key={item} className="min-w-0">
              <div
                className={`h-1.5 rounded-full ${index <= stepIndex ? "bg-primary" : "bg-border"}`}
                aria-current={item === step ? "step" : undefined}
              />
              <span className={`mt-1 block text-center text-[0.7rem] leading-tight font-medium ${item === step ? "text-wine-deep" : "text-muted-foreground"}`}>
                {STEP_LABEL[item]}
                <span className="sr-only">{item === step ? " (atual)" : ""}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="text-base font-medium">
          {bookingStepCaption(step, Math.max(stepIndex, 0), visibleSteps.length)}
        </p>

        {service && step !== "service" ? (
          <section className="rounded-[1.25rem] bg-white p-4 ring-1 ring-[#f0e4de]" aria-label="Escolhas feitas">
            <p className="text-xs font-semibold tracking-[0.16em] text-[var(--rose-ink)] uppercase">Você escolheu</p>
            <ul className="mt-2 grid gap-1 text-sm leading-6">
              <li>
                <span className="text-muted-foreground">Serviço: </span>
                <span className="font-medium text-wine-deep">{service.name}</span>
                {" · "}
                {offering?.durationMinutes ?? service.durationMinutes} min
                {" · "}
                {professionalId === ANY_PROFESSIONAL && service.minPriceCents !== service.maxPriceCents
                  ? `a partir de ${formatCentsToReais(service.minPriceCents)}`
                  : formatCentsToReais(offering?.priceCents ?? service.priceCents)}
              </li>
              {professionalId !== null ? (
                <li className="flex items-center gap-2">
                  {professional && professionalId !== ANY_PROFESSIONAL ? (
                    <PersonMark
                      name={professional.displayName}
                      photoUrl={`/api/professionals/photo?memberId=${professional.id}&slug=${encodeURIComponent(catalog.slug)}`}
                      size="sm"
                    />
                  ) : null}
                  <span>
                    <span className="text-muted-foreground">Profissional: </span>
                    <span className="font-medium">
                      {professionalId === ANY_PROFESSIONAL ? "Qualquer profissional disponível" : (professional?.displayName ?? "—")}
                    </span>
                  </span>
                </li>
              ) : null}
              {localDate && step !== "professional" && step !== "date" ? (
                <li>
                  <span className="text-muted-foreground">Dia: </span>
                  <span className="font-medium">{formatIsoDateLabel(localDate)}</span>
                </li>
              ) : null}
            </ul>
          </section>
        ) : null}

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
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h2 className="font-serif text-xl break-words text-wine-deep">{item.name}</h2>
                      {item.description ? (
                        <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                      ) : null}
                    </div>
                    <p className="shrink-0 text-sm font-medium text-wine-deep">
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
            slug={catalog.slug}
            people={professionalsForService}
            service={service}
            selectedId={professionalId}
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
            {authenticated ? null : (
              <p className="text-sm leading-6 text-muted-foreground">
                Você pode ver os horários sem entrar. A confirmação pede uma conta de cliente, grátis e sem mensalidade.
              </p>
            )}
            {slotsLoading ? (
              <div className="grid gap-3" role="status">
                <p className="text-sm text-muted-foreground">Buscando horários…</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-hidden="true">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <span key={index} className="h-12 animate-pulse rounded-2xl bg-secondary motion-reduce:animate-none" />
                  ))}
                </div>
              </div>
            ) : null}
            {slotsError ? (
              <div className="grid gap-3 rounded-3xl bg-secondary/50 p-4">
                <p className="text-sm text-destructive" role="alert">
                  {slotsError}
                </p>
                <Button type="button" variant="outline" className="h-auto min-h-12 w-full whitespace-normal rounded-full px-4 text-center" disabled={pending} onClick={() => {
                  setSlotsError(null); setSlotsLoading(true); setSlotsAttempt((attempt) => attempt + 1);
                }}>Tentar carregar horários novamente</Button>
              </div>
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
                    disabled={pending || slotsLoading}
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
            <Button type="button" className="h-12 w-full rounded-full" onClick={submitDetails} disabled={pending}>
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
              {authenticated ? (
                <>
                  <SummaryRow label="Nome" value={fullName} />
                  <SummaryRow label="Celular" value={phone} />
                  <SummaryRow label="E-mail" value={email} />
                </>
              ) : (
                <p className="pt-3 text-sm leading-6 text-muted-foreground">
                  Para concluir, entre ou crie uma conta de cliente. Ela é grátis e não tem mensalidade. Serviço, profissional, dia e horário continuam selecionados, e a disponibilidade é conferida de novo antes de reservar.
                </p>
              )}
            </article>
            <Button
              type="button"
              className="h-12 w-full rounded-full"
              disabled={pending || confirmationUnknown}
              onClick={confirm}
            >
              {pending
                ? authenticated
                  ? "Reservando…"
                  : "Abrindo a conta…"
                : authenticated
                  ? "Reservar este horário"
                  : "Entrar para confirmar"}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" className="h-auto min-h-11 whitespace-normal px-3 text-center" disabled={pending || confirmationUnknown} onClick={() => go("service")}>
                Mudar serviço
              </Button>
              <Button type="button" variant="outline" className="h-auto min-h-11 whitespace-normal px-3 text-center" disabled={pending || confirmationUnknown} onClick={() => go("date")}>
                Mudar dia
              </Button>
              <Button type="button" variant="outline" className="h-auto min-h-11 whitespace-normal px-3 text-center" disabled={pending || confirmationUnknown} onClick={() => go("slot")}>
                Mudar horário
              </Button>
              {authenticated ? (
                <Button type="button" variant="outline" className="h-auto min-h-11 whitespace-normal px-3 text-center" disabled={pending || confirmationUnknown} onClick={() => go("details")}>
                  Alterar meus dados
                </Button>
              ) : null}
            </div>
          </section>
        ) : null}

        {confirmationUnknown ? (
          <Link href="/cliente/agendamentos" className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-4 text-center text-sm font-medium whitespace-normal text-primary-foreground">
            Conferir meus agendamentos
          </Link>
        ) : null}
        {formError ? (
          <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
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
              disabled={pending || confirmationUnknown}
              aria-busy={pending}
              onClick={() => go(bookingBackStep(step, { authenticated, skipProfessional }))}
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
  slug,
  people,
  service,
  selectedId,
  onSelect,
}: {
  slug: string;
  people: PublicBookingProfessional[];
  service: PublicBookingService | null;
  selectedId: string | null | typeof ANY_PROFESSIONAL;
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
        aria-pressed={selectedId === ANY_PROFESSIONAL}
        aria-label="Escolher qualquer profissional disponível"
        className={`min-h-16 rounded-3xl bg-secondary/60 p-5 text-left ring-1 transition hover:ring-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
          selectedId === ANY_PROFESSIONAL ? "ring-2 ring-primary" : "ring-border"
        }`}
      >
        <h2 className="font-serif text-2xl">Qualquer profissional disponível</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Mostramos um horário livre, com quem puder atender.
        </p>
        <p className="mt-2 text-sm font-medium text-wine-deep">
          {selectedId === ANY_PROFESSIONAL ? "Escolha atual" : "Toque para escolher"}
        </p>
      </button>
      {people.map((person) => {
        const offering = service
          ? person.offerings.find((item) => item.serviceId === service.id)
          : undefined;
        const selected = selectedId === person.id;
        return (
          <button
            key={person.id}
            type="button"
            onClick={() => onSelect(person.id)}
            aria-pressed={selected}
            aria-label={`Escolher ${person.displayName}`}
            className={`${PICKER_BUTTON} focus-visible:ring-primary ${selected ? "ring-2 ring-primary" : ""}`}
          >
            <span className="flex items-center gap-4">
              <PersonMark name={person.displayName} photoUrl={`/api/professionals/photo?memberId=${person.id}&slug=${encodeURIComponent(slug)}`} />
              <span className="min-w-0 text-left">
                <h2 className="font-serif text-2xl break-words text-wine-deep">{person.displayName}</h2>
                {person.bio ? <p className="mt-1 text-sm leading-6 break-words text-muted-foreground">{person.bio}</p> : null}
                {service ? (
                  <p className="mt-2 text-sm">
                    {formatCentsToReais(offering?.priceCents ?? service.priceCents)}
                    {" · "}
                    {offering?.durationMinutes ?? service.durationMinutes} min
                  </p>
                ) : null}
                <p className="mt-2 text-sm font-medium text-wine-deep">{selected ? "Escolha atual" : "Toque para escolher"}</p>
              </span>
            </span>
          </button>
        );
      })}
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
            <h2 className="font-serif text-2xl">{monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</h2>
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
    <div className="grid gap-1 border-b border-border/60 py-3 last:border-b-0 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:items-start">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="min-w-0 text-sm font-medium break-words sm:text-right">{value}</p>
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
  const receipt = bookingReceiptCopy(confirmation.status);
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
    <div className="agende-bloom relative min-h-full overflow-hidden">
      <FloralCorner className="pointer-events-none absolute right-0 top-4 h-32 w-40 opacity-80" />
      <FloralBranch className="pointer-events-none absolute -left-8 bottom-10 h-48 w-36 opacity-70" />
      <header className="border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-lg items-center px-4">
          <BrandLogo size="sm" />
        </div>
      </header>
      <main className="relative mx-auto grid w-full max-w-lg gap-6 px-4 py-10">
        <section className="rounded-[2rem] bg-card p-6 text-center ring-1 ring-border">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-metric-blush font-serif text-2xl text-[var(--rose-ink)]" aria-hidden="true">
            {confirmation.status === "confirmed" ? "✓" : "•"}
          </span>
          <h1 className="mt-4 font-serif text-4xl text-wine-deep">{receipt.title}</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{receipt.lead}</p>
          <p className="mt-4 inline-flex rounded-full bg-metric-blush px-3 py-1 text-sm font-medium text-wine-deep">
            {receipt.statusLabel}
          </p>
        </section>
        <article className="rounded-[2rem] bg-card p-5 ring-1 ring-border">
          <SummaryRow label="Status" value={receipt.statusLabel} />
          <SummaryRow label="Salão" value={confirmation.workspaceName} />
          <SummaryRow label="Serviço" value={confirmation.serviceName} />
          <SummaryRow label="Profissional" value={confirmation.professionalName} />
          <SummaryRow
            label="Quando"
            value={formatDateTimeInTimeZone(confirmation.startsAt, confirmation.timezone)}
          />
          <SummaryRow label="Duração" value={`${confirmation.durationMinutes} minutos`} />
          <SummaryRow label="Valor" value={formatCentsToReais(confirmation.priceCents)} />
        </article>
        <div className="grid gap-3">
          {hasClientProfile ? (
            <Button variant="rose" className="h-12 rounded-full" render={<Link href="/cliente/agendamentos" />}>
              Ver meus agendamentos
            </Button>
          ) : guestHint ? (
            <Button variant="rose" className="h-12 rounded-full" render={<Link href="/cadastro?intent=client&next=/cliente/agendamentos" />}>
              Ver meus agendamentos
            </Button>
          ) : null}
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
          <Button variant="ghost" className="h-12 rounded-full" render={<Link href="/" />}>
            Voltar para o início
          </Button>
        </div>
        {guestHint ? (
          <p className="text-center text-sm text-muted-foreground">
            Quer guardar todos os horários na sua conta?{" "}
            <Link
              href="/cadastro?intent=client&next=/cliente/agendamentos"
              className="underline underline-offset-4"
            >
              Criar conta
            </Link>
          </p>
        ) : hasClientProfile ? null : (
          <p className="text-center text-sm text-muted-foreground">
            Seus horários ficam neste e-mail. Guarde a confirmação.
          </p>
        )}
      </main>
    </div>
  );
}
