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
      {plan ? <input type="hidden" name="plan" value={plan} /> : null}
      <input type="hidden" name="intendedUse" value={intent} />
      <input type="hidden" name="termsAccepted" value={terms ? "true" : "false"} />

      <div className="space-y-3">
        <h1 className="font-serif text-3xl leading-tight">Como você quer usar o Agendê?</h1>
        <p className="text-muted-foreground">Escolha um caminho agora. Depois você pode viver os dois lados.</p>
        <div role="radiogroup" aria-label="Como você quer usar o Agendê?" className="grid gap-3">
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
            <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">Sou cliente</p>
            <p className="mt-1 font-medium">Quero encontrar profissionais e agendar meus horários.</p>
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
            <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">Sou profissional</p>
            <p className="mt-1 font-medium">Quero organizar minha agenda e gerenciar meu negócio.</p>
          </button>
        </div>
        {state.fieldErrors?.intendedUse ? (
          <p className="text-sm text-destructive">{state.fieldErrors.intendedUse}</p>
        ) : null}
      </div>

      <Card className="border-none ring-1 ring-border">
        <CardHeader>
          <CardTitle>Seus dados</CardTitle>
          <CardDescription>Usamos isso para criar sua conta. O e-mail precisará ser confirmado.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="fullName">Nome completo</Label>
            <Input id="fullName" name="fullName" autoComplete="name" required className="h-11" />
            {state.fieldErrors?.fullName ? <p className="text-sm text-destructive">{state.fieldErrors.fullName}</p> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">E-mail</Label>
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
            {state.fieldErrors?.phone ? <p className="text-sm text-destructive">{state.fieldErrors.phone}</p> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" required className="h-11" />
            {state.fieldErrors?.password ? <p className="text-sm text-destructive">{state.fieldErrors.password}</p> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">Confirmar senha</Label>
            <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required className="h-11" />
            {state.fieldErrors?.confirmPassword ? (
              <p className="text-sm text-destructive">{state.fieldErrors.confirmPassword}</p>
            ) : null}
          </div>
          <label htmlFor="termsAccepted" className="flex items-start gap-3 text-sm leading-relaxed">
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
          <Button type="submit" className="h-12" disabled={!canSubmit}>
            {pending ? "Criando conta..." : "Criar conta"}
          </Button>
          {!canSubmit && !pending ? (
            <p className="text-center text-xs text-muted-foreground">
              Escolha se você é cliente ou profissional e aceite os termos para continuar.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </form>
  );
}
