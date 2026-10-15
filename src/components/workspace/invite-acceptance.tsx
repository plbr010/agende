"use client";

import Link from "next/link";
import { useActionState } from "react";
import { BrandLogo } from "@/components/brand/logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FloralSprig } from "@/components/brand/floral";
import { JourneySteps, TEAM_JOURNEY } from "@/components/onboarding/progress-steps";
import { INVITE_STATUS_COPY } from "@/lib/auth/signup-journey";
import { acceptInviteAction } from "@/lib/workspace/actions";
import { MEMBER_ROLE_LABEL, type MemberRole } from "@/lib/workspace/labels";
import type { InvitePeek } from "@/lib/workspace/public";
import { formatDate } from "@/lib/workspace/timezone";
import { cn } from "@/lib/utils";

export function InviteAcceptance({
  token,
  peek,
  signedIn,
  email,
  emailConfirmed,
}: {
  token: string;
  peek: InvitePeek;
  signedIn: boolean;
  email: string | null;
  emailConfirmed: boolean;
}) {
  const [state, action, pending] = useActionState(acceptInviteAction, {});
  const copy = peek.status === "valid"
    ? { title: "Você recebeu um convite", body: "Confirme quem você é e aceite para entrar na equipe. Nada é liberado antes disso. Sem mensalidade." }
    : INVITE_STATUS_COPY[peek.status];
  const step = peek.status !== "valid" ? 1 : !signedIn ? 2 : !emailConfirmed ? 3 : 4;
  const roleLabel =
    peek.role && peek.role in MEMBER_ROLE_LABEL
      ? MEMBER_ROLE_LABEL[peek.role as MemberRole]
      : peek.role;
  const next = `/convite/${encodeURIComponent(token)}`;

  return (
    <div className="agende-bloom relative flex min-h-full flex-col overflow-hidden px-4 py-8">
      <FloralSprig className="pointer-events-none absolute -top-8 -left-6 h-40 w-24 opacity-70" />
      <div className="relative mx-auto grid w-full max-w-lg gap-6">
        <BrandLogo />
        <JourneySteps steps={TEAM_JOURNEY} current={step} label="Entrada na equipe" />
        <Card className="border-none ring-1 ring-border">
          <CardHeader>
            <CardTitle className="font-serif text-3xl">{copy.title}</CardTitle>
            <CardDescription>{copy.body}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {peek.workspaceName ? (
              <p className="text-sm">
                Salão: <span className="font-medium">{peek.workspaceName}</span>
              </p>
            ) : null}
            {roleLabel ? (
              <p className="text-sm">
                Função na equipe: <span className="font-medium">{roleLabel}</span>
              </p>
            ) : null}
            {peek.status !== "not_found" && peek.emailBound ? (
              <p className="text-sm text-muted-foreground">
                Este convite é só para um e-mail. Entre com a conta desse e-mail.
              </p>
            ) : null}
            {peek.status !== "not_found" && !peek.emailBound ? (
              <p className="text-sm text-muted-foreground">
                Este é um link pessoal. Copie, envie e entre com a conta confirmada para aceitar.
              </p>
            ) : null}
            {peek.expiresAt && peek.status === "valid" ? (
              <p className="text-sm text-muted-foreground">Válido até {formatDate(peek.expiresAt)}</p>
            ) : null}

            {peek.status === "valid" && !signedIn ? (
              <div className="grid gap-2">
                <Link
                  href={`/login?next=${encodeURIComponent(next)}`}
                  className={cn(buttonVariants({ variant: "default" }), "h-12")}
                >
                  Entrar para aceitar
                </Link>
                <Link
                  href={`/cadastro?intent=equipe&next=${encodeURIComponent(next)}`}
                  className={cn(buttonVariants({ variant: "outline" }), "h-12")}
                >
                  Criar conta
                </Link>
              </div>
            ) : null}

            {peek.status === "valid" && signedIn && !emailConfirmed ? (
              <Link href="/verificar-email" className={cn(buttonVariants({ variant: "default" }), "h-12")}>
                Confirmar e-mail para continuar
              </Link>
            ) : null}

            {peek.status === "valid" && signedIn && emailConfirmed ? (
              <form action={action} className="grid gap-3">
                <input type="hidden" name="token" value={token} />
                {email ? <p className="text-sm text-muted-foreground">Você está como {email}.</p> : null}
                {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
                <Button type="submit" className="h-12" disabled={pending}>
                  {pending ? "Entrando na equipe..." : "Aceitar convite"}
                </Button>
              </form>
            ) : null}

            {peek.status === "accepted" ? (
              <Link href="/app" className={cn(buttonVariants({ variant: "default" }), "h-12")}>
                Ir para o salão
              </Link>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
