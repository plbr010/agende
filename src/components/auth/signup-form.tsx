"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signUpAction, type ActionState } from "@/lib/auth/actions";
import type { PlanId } from "@/lib/billing/plans";
import { PLANS } from "@/lib/marketing/content";
import { formatPhoneBr } from "@/lib/validation/phone";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/usability/password-field";
import { PortugueseForm } from "@/components/usability/portuguese-form";
import { nextEnabledRadioIndex } from "@/lib/usability/roving-radio";
import { cn } from "@/lib/utils";

const SIGNUP_INTENTS = ["client", "professional"] as const;

const initial: ActionState = {};

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}

export function SignupForm({
  next,
  plan,
  initialIntent = "",
  lockIntent = false,
}: {
  next?: string | null;
  plan?: PlanId | null;
  initialIntent?: "client" | "professional" | "";
  lockIntent?: boolean;
}) {
  const [state, action, pending] = useActionState(signUpAction, initial);
  const dedicated = !lockIntent && (initialIntent === "client" || initialIntent === "professional");
  const [intent, setIntent] = useState<"client" | "professional" | "">(
    initialIntent === "client" || initialIntent === "professional" ? initialIntent : plan ? "professional" : "",
  );
  const [phone, setPhone] = useState("");
  const [terms, setTerms] = useState(false);
  const selectedPlan = plan ? PLANS.find((item) => item.id === plan) : null;

  const canSubmit = !pending && (intent === "client" || intent === "professional") && terms;

  function onIntentKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, current: (typeof SIGNUP_INTENTS)[number]) {
    const disabled = SIGNUP_INTENTS.map((value) => value === "client" && lockIntent);
    const nextIndex = nextEnabledRadioIndex(SIGNUP_INTENTS.indexOf(current), disabled, event.key);
    if (nextIndex === null) return;
    event.preventDefault();
    const value = SIGNUP_INTENTS[nextIndex];
    if (!value) return;
    setIntent(value);
    window.requestAnimationFrame(() => {
      document.getElementById(`signup-intent-${value}`)?.focus();
    });
  }

  return (
    <PortugueseForm action={action} className="space-y-5">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {plan && intent === "professional" ? <input type="hidden" name="plan" value={plan} /> : null}
      <input type="hidden" name="intendedUse" value={intent} />
      <input type="hidden" name="termsAccepted" value={terms ? "true" : "false"} />

      {dedicated && intent === "client" ? (
        <div className="rounded-[1.4rem] bg-metric-blush px-4 py-4">
          <p className="text-[0.7rem] font-medium tracking-[0.16em] text-[var(--rose-ink)] uppercase">Conta de cliente</p>
          <p className="mt-1 font-medium text-wine-deep">Para marcar horários. Sem salão, sem plano e sem mensalidade.</p>
        </div>
      ) : null}

      {dedicated && intent === "professional" ? (
        <div className="rounded-[1.4rem] bg-white px-4 py-4 ring-1 ring-[#f0e4de]">
          <p className="text-[0.7rem] font-medium tracking-[0.16em] text-[var(--rose-ink)] uppercase">Conta profissional</p>
          {selectedPlan ? (
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Plano <strong className="text-wine-deep">{selectedPlan.name}</strong> · {selectedPlan.seats} · {selectedPlan.price}{selectedPlan.period}. Depois do e-mail, você cadastra o estabelecimento e começa 7 dias grátis, sem cartão.
            </p>
          ) : (
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Depois de confirmar o e-mail, você escolhe o plano e cadastra o estabelecimento. São 7 dias grátis, sem cartão.
            </p>
          )}
          <Link href="/profissionais#planos" className="mt-2 inline-flex min-h-11 items-center text-sm text-wine-deep underline underline-offset-4">
            {selectedPlan ? "Trocar plano" : "Ver planos antes"}
          </Link>
        </div>
      ) : null}

      {dedicated ? null : (
        <div className="space-y-3">
          <h2 className="font-serif text-3xl leading-tight text-wine-deep">O que você quer fazer no Agendê?</h2>
          <p className="text-muted-foreground">
            Toque em uma opção. Depois você pode usar as duas áreas na mesma conta.
          </p>
          {plan && intent === "client" ? (
            <p className="rounded-2xl bg-secondary/70 px-4 py-3 text-sm">
              O plano selecionado vale só para a conta profissional. Como cliente, a área continua gratuita.
            </p>
          ) : null}
          <div role="radiogroup" aria-label="O que você quer fazer no Agendê?" className="grid gap-3">
            <button
              id="signup-intent-client"
              type="button"
              role="radio"
              aria-checked={intent === "client"}
              tabIndex={intent === "client" || intent === "" ? 0 : -1}
              onClick={() => {
                if (!lockIntent) setIntent("client");
              }}
              onKeyDown={(event) => onIntentKeyDown(event, "client")}
              disabled={lockIntent}
              className={cn(
                "min-h-16 rounded-[1.25rem] bg-white p-4 text-left ring-1 ring-[#f0e4de] transition",
                intent === "client" && "bg-metric-blush ring-2 ring-primary",
                lockIntent && "cursor-not-allowed opacity-50",
              )}
            >
              <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">Quero marcar horários</p>
              <p className="mt-1 font-medium">Agendar manicure, cabelo e outros serviços.</p>
            </button>
            <button
              id="signup-intent-professional"
              type="button"
              role="radio"
              aria-checked={intent === "professional"}
              tabIndex={intent === "professional" || (intent === "" && lockIntent) ? 0 : -1}
              onClick={() => setIntent("professional")}
              onKeyDown={(event) => onIntentKeyDown(event, "professional")}
              className={cn(
                "min-h-16 rounded-[1.25rem] bg-white p-4 text-left ring-1 ring-[#f0e4de] transition",
                intent === "professional" && "bg-metric-blush ring-2 ring-primary",
              )}
            >
              <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">Tenho salão ou atendo clientes</p>
              <p className="mt-1 font-medium">Organizar agenda, clientes e horários do meu trabalho.</p>
            </button>
          </div>
          {lockIntent ? (
            <p className="rounded-2xl bg-metric-blush px-4 py-3 text-sm">
              Este convite é para entrar na equipe do salão. Sua conta será profissional.
            </p>
          ) : null}
          <FieldError id="intendedUse-error" message={state.fieldErrors?.intendedUse} />
        </div>
      )}

      <div className="grid gap-4 rounded-[1.6rem] bg-white p-5 ring-1 ring-[#f0e4de] sm:p-6">
        <div>
          <h2 className="font-serif text-2xl text-wine-deep">Seus dados</h2>
          <p className="mt-1 text-sm text-muted-foreground">Nome, e-mail, celular e senha. Vamos confirmar o e-mail em seguida.</p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="fullName">Nome</Label>
          <Input
            id="fullName"
            name="fullName"
            autoComplete="name"
            required
            aria-invalid={Boolean(state.fieldErrors?.fullName)}
            aria-describedby={state.fieldErrors?.fullName ? "fullName-error" : undefined}
          />
          <FieldError id="fullName-error" message={state.fieldErrors?.fullName} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-invalid={Boolean(state.fieldErrors?.email)}
            aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
          />
          <FieldError id="email-error" message={state.fieldErrors?.email} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="phone">Celular</Label>
          <Input
            id="phone"
            name="phone"
            inputMode="tel"
            autoComplete="tel"
            required
            value={phone}
            onChange={(event) => setPhone(formatPhoneBr(event.target.value))}
            placeholder="(32) 99999-9999"
            aria-invalid={Boolean(state.fieldErrors?.phone)}
            aria-describedby="phone-hint"
          />
          <p id="phone-hint" className="text-sm text-muted-foreground">Coloque o DDD e o número, como (32) 99999-9999.</p>
          <FieldError id="phone-error" message={state.fieldErrors?.phone} />
        </div>
        <PasswordField
          id="password"
          name="password"
          label="Senha"
          autoComplete="new-password"
          error={state.fieldErrors?.password}
        />
        <PasswordField
          id="confirmPassword"
          name="confirmPassword"
          label="Digite a senha de novo"
          autoComplete="new-password"
          hint={null}
          error={state.fieldErrors?.confirmPassword}
        />
        <label htmlFor="termsAccepted" className="flex min-h-11 items-start gap-3 text-sm leading-relaxed">
          <Checkbox
            id="termsAccepted"
            checked={terms}
            onCheckedChange={(value) => setTerms(value === true)}
            className="mt-0.5 size-5"
          />
          <span>
            Li e concordo com os{" "}
            <Link href="/termos" className="underline underline-offset-4">
              Termos de Uso
            </Link>{" "}
            e a{" "}
            <Link href="/privacidade" className="underline underline-offset-4">
              Política de Privacidade
            </Link>
            .
          </span>
        </label>
        <FieldError id="terms-error" message={state.fieldErrors?.termsAccepted} />
        {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
        {!canSubmit && !pending ? (
          <p className="text-sm text-muted-foreground">
            {dedicated ? "Marque que aceita os termos para continuar." : "Toque em uma das opções acima e marque que aceita os termos."}
          </p>
        ) : null}
        <Button type="submit" className="h-12 rounded-full" disabled={!canSubmit} aria-busy={pending}>
          {pending ? "Criando conta..." : intent === "professional" && dedicated ? "Criar conta profissional" : intent === "client" && dedicated ? "Criar conta de cliente" : "Criar minha conta"}
        </Button>
      </div>
    </PortugueseForm>
  );
}
