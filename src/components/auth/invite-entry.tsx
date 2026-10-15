"use client";

import { useActionState } from "react";
import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { openInviteLinkAction } from "@/lib/auth/invite-link";
import { INVITE_STATUS_COPY } from "@/lib/auth/signup-journey";
import type { ActionState } from "@/lib/auth/actions";
import { MEMBER_ROLE_LABEL, type MemberRole } from "@/lib/workspace/labels";
import type { InvitePeek } from "@/lib/workspace/public";
import { formatDate } from "@/lib/workspace/timezone";
import { cn } from "@/lib/utils";

const initial: ActionState = {};

export function InviteEntry({
  peek,
  lookupError,
  next,
  presetLink,
}: {
  peek: InvitePeek | null;
  lookupError?: string | null;
  next?: string | null;
  presetLink?: string | null;
}) {
  const [state, action, pending] = useActionState(openInviteLinkAction, initial);
  const valid = peek?.status === "valid" && !lookupError;
  const copy = peek ? INVITE_STATUS_COPY[peek.status] : null;
  const roleLabel = peek?.role && peek.role in MEMBER_ROLE_LABEL
    ? MEMBER_ROLE_LABEL[peek.role as MemberRole]
    : peek?.role;

  return (
    <div className="space-y-5">
      {valid && peek && next ? (
        <div className="rounded-[1.6rem] bg-white p-5 ring-1 ring-[#f0e4de] sm:p-6">
          <p className="text-xs font-semibold tracking-[0.16em] text-[var(--rose-ink)] uppercase">{copy?.title}</p>
          <h2 className="mt-2 font-serif text-3xl text-wine-deep">{peek.workspaceName ?? "Salão parceiro"}</h2>
          <p className="mt-2 text-base leading-7 text-muted-foreground">{copy?.body}</p>
          {roleLabel ? <p className="mt-3 text-sm">Função na equipe: <strong>{roleLabel}</strong></p> : null}
          {peek.expiresAt ? <p className="mt-1 text-sm text-muted-foreground">Válido até {formatDate(peek.expiresAt)}</p> : null}
          {peek.emailBound ? (
            <p className="mt-3 rounded-2xl bg-metric-blush px-4 py-3 text-sm leading-6">
              Este convite é só para um e-mail. Use a conta desse e-mail.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-[1.6rem] bg-white p-5 ring-1 ring-[#f0e4de] sm:p-6">
          <h2 className="font-serif text-3xl text-wine-deep">{copy?.title ?? "Cole o convite do salão"}</h2>
          <p className="mt-2 text-base leading-7 text-muted-foreground">
            {lookupError ?? copy?.body ?? "Peça o link para quem administra o salão e cole aqui. Vamos conferir antes de criar a conta."}
          </p>
          <form action={action} className="mt-5 grid gap-3">
            <Label htmlFor="invite">Link ou código do convite</Label>
            <Input
              id="invite"
              name="invite"
              required
              defaultValue={presetLink ?? ""}
              autoComplete="off"
              className="h-12"
              placeholder="Cole o link que você recebeu"
              aria-invalid={Boolean(state.error)}
            />
            {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
            <Button type="submit" size="lg" className="w-full" disabled={pending} aria-busy={pending}>
              {pending ? "Conferindo convite..." : "Conferir convite"}
            </Button>
          </form>
        </div>
      )}

      {valid && next ? (
        <>
          <SignupForm journey="team" next={next} />
          <Link href={`/login?next=${encodeURIComponent(next)}`} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}>
            Já tenho conta — entrar
          </Link>
          <p className="text-center text-sm">
            <Link href="/cadastro?intent=equipe" className="inline-flex min-h-11 items-center underline underline-offset-4">
              Usar outro convite
            </Link>
          </p>
        </>
      ) : null}
    </div>
  );
}
