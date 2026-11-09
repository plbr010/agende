"use client";

import { useRef, useState, useTransition } from "react";
import { PLANS } from "@/lib/marketing/content";
import { formatDate } from "@/lib/workspace/timezone";
import type { AnnualPreview, ManageActionInput, ManageActionResult, SubscriptionState } from "@/lib/billing/manage";

const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

type Step = "idle" | "confirm-annual" | "confirm-cancel";

export function SubscriptionManager({ state: initial, timezone, canManage, action }: {
  state: SubscriptionState;
  timezone: string;
  canManage: boolean;
  action: (input: ManageActionInput) => Promise<ManageActionResult>;
}) {
  const [state, setState] = useState(initial);
  const [step, setStep] = useState<Step>("idle");
  const [preview, setPreview] = useState<AnnualPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const switchKey = useRef<string | null>(null);

  const plan = PLANS.find((item) => item.id === state.plan);
  const endsAt = state.cancelAt ?? state.trialEnd ?? state.currentPeriodEnd;
  const periodEnd = state.trialEnd ?? state.currentPeriodEnd;

  function run(input: ManageActionInput, done: (result: Extract<ManageActionResult, { ok: true }>) => void) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await action(input);
        if (!result.ok) { setError(result.error); return; }
        done(result);
      } catch {
        setError("Não foi possível falar com o Stripe. Verifique sua conexão e tente novamente.");
      }
    });
  }

  function openAnnual() {
    run({ action: "preview_annual" }, (result) => {
      setPreview(result.preview ?? null);
      switchKey.current = crypto.randomUUID();
      setStep("confirm-annual");
    });
  }

  function confirmAnnual() {
    const idempotencyKey = switchKey.current ?? crypto.randomUUID();
    run({ action: "switch_annual", idempotencyKey }, (result) => {
      if (result.subscription) setState(result.subscription);
      setStep("idle");
      setPreview(null);
      switchKey.current = null;
      setNotice(state.status === "trialing"
        ? "Pronto: sua assinatura agora é anual. Nada foi cobrado; o ano será cobrado quando o teste acabar."
        : "Pronto: sua assinatura agora é anual. O recibo da cobrança chega no seu e-mail.");
    });
  }

  function cancel() {
    run({ action: "cancel" }, (result) => {
      if (result.subscription) setState(result.subscription);
      setStep("idle");
      setNotice("Cancelamento agendado. Nada mais será cobrado.");
    });
  }

  function resume() {
    run({ action: "resume" }, (result) => {
      if (result.subscription) setState(result.subscription);
      setNotice("Cancelamento desfeito. Sua assinatura continua normalmente.");
    });
  }

  if (!canManage) return null;

  return (
    <section className="agende-panel grid gap-4 rounded-[1.5rem] p-5 ring-1 ring-[#f0e4de]" aria-label="Gerenciar assinatura" aria-busy={pending}>
      <div>
        <h3 className="font-serif text-2xl text-wine-deep">Sua assinatura</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {plan ? plan.name : "Plano"} · {state.interval === "annual" ? "anual" : "mensal"}
          {state.status === "trialing" && state.trialEnd ? ` · teste grátis até ${formatDate(state.trialEnd, timezone)}` : ""}
          {state.status !== "trialing" && state.currentPeriodEnd && !state.cancelScheduled
            ? ` · próxima cobrança em ${formatDate(state.currentPeriodEnd, timezone)}` : ""}
        </p>
      </div>

      {notice ? <p role="status" className="rounded-2xl bg-metric-blush p-4 text-sm">{notice}</p> : null}
      {error ? <p role="alert" className="rounded-xl border border-destructive p-4 text-sm text-destructive">{error}</p> : null}

      {state.cancelScheduled ? (
        <div className="grid gap-3 rounded-2xl bg-[#fff6f4] p-4 ring-1 ring-[#eadfd8]">
          <p className="font-medium text-wine-deep">Cancelamento agendado</p>
          <p className="text-sm text-muted-foreground">
            Sua assinatura termina em {formatDate(endsAt, timezone)}. Até lá tudo continua funcionando e nada mais será cobrado.
          </p>
          {state.canResume ? (
            <button type="button" disabled={pending} onClick={resume}
              className="h-11 w-fit rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50">
              Manter minha assinatura
            </button>
          ) : null}
        </div>
      ) : null}

      {state.canSwitchToAnnual && plan && step !== "confirm-cancel" ? (
        <div className="grid gap-3 rounded-2xl bg-[#fff6f4] p-4 ring-1 ring-[#eadfd8]">
          <p className="font-medium text-wine-deep">Mudar para o plano anual · 2 meses grátis</p>
          <p className="text-sm text-muted-foreground">
            {plan.name} anual por {plan.annualPrice} (equivale a {plan.annualMonthlyEquivalent}), pago à vista uma vez por ano. Sem cancelar e sem perder nada.
          </p>
          {step === "confirm-annual" && preview ? (
            <div className="grid gap-3">
              <p className="text-sm">
                {preview.chargesAt
                  ? <>Nada é cobrado agora. Quando o teste acabar, em {formatDate(preview.chargesAt, timezone)}, você paga {money(preview.annualAmountCents)} pelo ano.</>
                  : <>Você paga hoje <strong>{money(preview.amountDueCents)}</strong>
                    {preview.creditCents > 0
                      ? <>: {money(preview.yearChargeCents)} pelo plano anual até {formatDate(preview.renewsAt, timezone)}, menos {money(preview.creditCents)} de crédito pelos dias que sobram do mês já pago</>
                      : null}.
                    {preview.renewsAt ? <> Depois renova em {formatDate(preview.renewsAt, timezone)} por {money(preview.annualAmountCents)} por ano.</> : null}</>}
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={pending} onClick={confirmAnnual}
                  className="h-11 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50">
                  {preview.chargesAt ? "Confirmar troca para o anual" : `Pagar ${money(preview.amountDueCents)} e mudar para o anual`}
                </button>
                <button type="button" disabled={pending} onClick={() => { setStep("idle"); setPreview(null); }}
                  className="h-11 rounded-full border px-5 text-sm disabled:opacity-50">
                  Voltar
                </button>
              </div>
            </div>
          ) : (
            <button type="button" disabled={pending} onClick={openAnnual}
              className="h-11 w-fit rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {pending ? "Calculando…" : "Ver valor e mudar para o anual"}
            </button>
          )}
        </div>
      ) : null}

      {state.canCancel && step !== "confirm-annual" ? (
        step === "confirm-cancel" ? (
          <div className="grid gap-3 rounded-2xl border border-destructive/40 p-4">
            <p className="font-medium text-wine-deep">Cancelar a assinatura?</p>
            <p className="text-sm text-muted-foreground">
              {state.status === "trialing"
                ? <>O acesso continua até o fim do teste, em {formatDate(periodEnd, timezone)}, e nada será cobrado.</>
                : <>O acesso continua até {formatDate(periodEnd, timezone)}, o fim do período já pago. Não há reembolso desse período e nada mais será cobrado.</>}
              {" "}Você pode desfazer o cancelamento até essa data.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={pending} onClick={cancel}
                className="h-11 rounded-full bg-destructive px-5 text-sm font-medium text-white disabled:opacity-50">
                Sim, cancelar assinatura
              </button>
              <button type="button" disabled={pending} onClick={() => setStep("idle")}
                className="h-11 rounded-full border px-5 text-sm disabled:opacity-50">
                Voltar
              </button>
            </div>
          </div>
        ) : (
          <button type="button" disabled={pending} onClick={() => { setStep("confirm-cancel"); setError(null); setNotice(null); }}
            className="h-11 w-fit rounded-full border border-destructive/50 px-5 text-sm text-destructive disabled:opacity-50">
            Cancelar assinatura
          </button>
        )
      ) : null}
    </section>
  );
}
