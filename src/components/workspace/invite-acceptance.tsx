"use client";

import Link from "next/link";
import { useActionState } from "react";
import { BrandLogo } from "@/components/brand/logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { acceptInviteAction } from "@/lib/workspace/actions";
import { MEMBER_ROLE_LABEL, type MemberRole } from "@/lib/workspace/labels";
import type { InvitePeek } from "@/lib/workspace/public";
import { formatDate } from "@/lib/workspace/timezone";
import { cn } from "@/lib/utils";

const statusCopy: Record<InvitePeek["status"], { title: string; body: string }> = {
  valid: {
    title: "Você foi convidada",
    body: "Entre com a conta certa e aceite para fazer parte da equipe.",
  },
  expired: {
    title: "Este convite expirou",
    body: "Peça um link novo para a pessoa que administra o estabelecimento.",
  },
  revoked: {
    title: "Este convite foi revogado",
    body: "Ele não pode mais ser usado.",
  },
  accepted: {
    title: "Este convite já foi utilizado",
    body: "Se você já entrou, acesse a área do estabelecimento.",
  },
  not_found: {
    title: "Convite não encontrado",
    body: "O link pode estar incompleto ou nunca ter existido.",
  },
};

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
  const copy = statusCopy[peek.status];
  const roleLabel =
    peek.role && peek.role in MEMBER_ROLE_LABEL
      ? MEMBER_ROLE_LABEL[peek.role as MemberRole]
      : peek.role;
  const next = `/convite/${encodeURIComponent(token)}`;

  return (
    <div className="agende-bloom flex min-h-full flex-col px-4 py-8">
      <div className="mx-auto grid w-full max-w-lg gap-6">
        <BrandLogo />
        <Card className="border-none ring-1 ring-border">
          <CardHeader>
            <CardTitle className="font-serif text-3xl">{copy.title}</CardTitle>
            <CardDescription>{copy.body}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {peek.workspaceName ? (
              <p className="text-sm">
                Estabelecimento: <span className="font-medium">{peek.workspaceName}</span>
              </p>
            ) : null}
            {roleLabel ? (
              <p className="text-sm">
                Papel: <span className="font-medium">{roleLabel}</span>
              </p>
            ) : null}
            {peek.emailBound ? (
              <p className="text-sm text-muted-foreground">
                Este convite está vinculado a um e-mail específico. A conta autenticada precisa ser a mesma.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Este é um link secreto. Quem tiver o endereço e uma conta confirmada pode aceitar.
              </p>
            )}
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
                  href={`/cadastro?next=${encodeURIComponent(next)}`}
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
                Ir para o estabelecimento
              </Link>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
