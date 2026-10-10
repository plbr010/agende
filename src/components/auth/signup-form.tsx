"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signUpAction, type ActionState } from "@/lib/auth/actions";
import type { PlanId } from "@/lib/billing/plans";
import { formatPhoneBr } from "@/lib/validation/phone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/usability/password-field";
import { cn } from "@/lib/utils";

const initial: ActionState = {};

export function SignupForm({
  next,
  plan,
  initialIntent = "",
}: {
  next?: string | null;
  plan?: PlanId | null;
  initialIntent?: "client" | "professional" | "";
}) {
  const [state, action, pending] = useActionState(signUpAction, initial);
  const [intent, setIntent] = useState<"client" | "professional" | "">(
    initialIntent === "client" || initialIntent === "professional" ? initialIntent : plan ? "professional" : "",
  );
  const [phone, setPhone] = useState("");
  const [terms, setTerms] = useState(false);

  const canSubmit = !pending && (intent === "client" || intent === "professional") && terms;

  return (
    <form action={action} className="space-y-6">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {plan && intent === "professional" ? <input type="hidden" name="plan" value={plan} /> : null}
      <input type="hidden" name="intendedUse" value={intent} />
      <input type="hidden" name="termsAccepted" value={terms ? "true" : "false"} />

      <div className="space-y-3">
        <h1 className="font-serif text-3xl leading-tight">O que você quer fazer no Agendê?</h1>
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
            type="button"
            role="radio"
            aria-checked={intent === "client"}
            onClick={() => setIntent("client")}
            className={cn(
              "min-h-16 rounded-2xl border bg-card p-4 text-left ring-1 ring-border transition",
              intent === "client" && "ring-2 ring-primary",
            )}
          >
            <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">Quero marcar horários</p>
            <p className="mt-1 font-medium">Agendar manicure, cabelo e outros serviços.</p>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={intent === "professional"}
            onClick={() => setIntent("professional")}
            className={cn(
              "min-h-16 rounded-2xl border bg-card p-4 text-left ring-1 ring-border transition",
              intent === "professional" && "ring-2 ring-primary",
            )}
          >
            <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">Tenho salão ou atendo clientes</p>
            <p className="mt-1 font-medium">Organizar agenda, clientes e horários do meu trabalho.</p>
          </button>
        </div>
        {state.fieldErrors?.intendedUse ? (
          <p className="text-sm text-destructive">{state.fieldErrors.intendedUse}</p>
        ) : null}
      </div>

      <Card className="border-none ring-1 ring-border">
        <CardHeader>
          <CardTitle>Seus dados</CardTitle>
          <CardDescription>Preencha abaixo. Vamos mandar um e-mail para você confirmar.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="fullName">Nome completo</Label>
            <Input id="fullName" name="fullName" autoComplete="name" required className="h-11" />
            {state.fieldErrors?.fullName ? <p className="text-sm text-destructive">{state.fieldErrors.fullName}</p> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Seu e-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required className="h-11" />
            {state.fieldErrors?.email ? <p className="text-sm text-destructive">{state.fieldErrors.email}</p> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">Celular</Label>
            <Input
              id="phone"
              name="phone"
              inputMode="tel"
              autoComplete="tel"
              required
              className="h-11"
              value={phone}
              onChange={(event) => setPhone(formatPhoneBr(event.target.value))}
              placeholder="(32) 99999-9999"
            />
            <p className="text-sm text-muted-foreground">Coloque o DDD e o número, como (32) 99999-9999.</p>
            {state.fieldErrors?.phone ? <p className="text-sm text-destructive">{state.fieldErrors.phone}</p> : null}
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
          {state.fieldErrors?.termsAccepted ? (
            <p className="text-sm text-destructive">{state.fieldErrors.termsAccepted}</p>
          ) : null}
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          {!canSubmit && !pending ? (
            <p className="text-sm text-muted-foreground">
              Toque em uma das opções acima e marque que aceita os termos.
            </p>
          ) : null}
          <Button type="submit" className="h-12" disabled={!canSubmit}>
            {pending ? "Criando conta..." : "Criar minha conta"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
