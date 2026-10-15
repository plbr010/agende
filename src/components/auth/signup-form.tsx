"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signUpAction, type ActionState } from "@/lib/auth/actions";
import type { PlanId } from "@/lib/billing/plans";
import { PLANS } from "@/lib/marketing/content";
import type { SignupJourney } from "@/lib/auth/signup-journey";
import { formatPhoneBr } from "@/lib/validation/phone";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/usability/password-field";
import { PortugueseForm } from "@/components/usability/portuguese-form";

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
  journey,
}: {
  next?: string | null;
  plan?: PlanId | null;
  journey: SignupJourney;
}) {
  const [state, action, pending] = useActionState(signUpAction, initial);
  const intent = journey === "owner" ? "professional" : "client";
  const [phone, setPhone] = useState("");
  const [terms, setTerms] = useState(false);
  const selectedPlan = journey === "owner" && plan ? PLANS.find((item) => item.id === plan) : null;
  const canSubmit = !pending && terms;

  return (
    <PortugueseForm action={action} className="space-y-5">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {plan && intent === "professional" ? <input type="hidden" name="plan" value={plan} /> : null}
      <input type="hidden" name="intendedUse" value={intent} />
      <input type="hidden" name="journey" value={journey} />
      <input type="hidden" name="termsAccepted" value={terms ? "true" : "false"} />

      {journey === "client" ? (
        <div className="rounded-[1.4rem] bg-metric-blush px-4 py-4">
          <p className="text-[0.7rem] font-medium tracking-[0.16em] text-[var(--rose-ink)] uppercase">Conta de cliente</p>
          <p className="mt-1 font-medium text-wine-deep">Para marcar horários. Sem salão, sem plano e sem mensalidade.</p>
        </div>
      ) : null}

      {journey === "owner" ? (
        <div className="rounded-[1.4rem] bg-white px-4 py-4 ring-1 ring-[#f0e4de]">
          <p className="text-[0.7rem] font-medium tracking-[0.16em] text-[var(--rose-ink)] uppercase">Conta profissional</p>
          {selectedPlan ? (
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              O plano selecionado vale só para a conta profissional. Plano <strong className="text-wine-deep">{selectedPlan.name}</strong> · {selectedPlan.seats} · {selectedPlan.price}{selectedPlan.period}. Depois do e-mail, você confirma o plano e cadastra o estabelecimento. São 7 dias grátis, sem cartão.
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

      {journey === "team" ? (
        <div className="rounded-[1.4rem] bg-metric-ivory px-4 py-4">
          <p className="text-[0.7rem] font-medium tracking-[0.16em] text-[var(--rose-ink)] uppercase">Conta da equipe</p>
          <p className="mt-1 font-medium text-wine-deep">Sem plano e sem mensalidade. O salão só abre depois que você aceitar o convite.</p>
        </div>
      ) : null}

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
            className="h-12"
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
            className="h-12"
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
            className="h-12"
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
          <p className="text-sm text-muted-foreground">Marque que aceita os termos para continuar.</p>
        ) : null}
        <Button type="submit" size="lg" className="w-full" disabled={!canSubmit} aria-busy={pending}>
          {pending
            ? "Criando conta..."
            : journey === "owner"
              ? "Criar conta profissional"
              : journey === "client"
                ? "Criar conta de cliente"
                : "Criar conta da equipe"}
        </Button>
      </div>
    </PortugueseForm>
  );
}
