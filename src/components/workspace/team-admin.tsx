"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import type { TeamMember } from "@/lib/catalog/queries";
import type { ActionState } from "@/lib/auth/actions";
import { CLIPBOARD_COPY, copyTextToClipboard } from "@/lib/usability/clipboard";
import { PendingForm } from "@/components/usability/pending-form";
import {
  createTeamInviteAction,
  deactivateMemberAction,
  reactivateMemberAction,
  removeMemberAction,
  revokeTeamInviteAction,
  updateMemberRoleAction,
  type InviteActionState,
} from "@/lib/workspace/actions";
import type { PendingInvite } from "@/lib/workspace/queries";
import type { SeatUsage } from "@/lib/workspace/public";
import {
  INVITE_ROLES,
  MEMBER_ROLE_LABEL,
  MEMBER_STATUS_LABEL,
  selectClassName,
  type InviteRole,
} from "@/lib/workspace/labels";
import { formatDate } from "@/lib/workspace/timezone";
import { PersonMark } from "@/components/people/person-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function runAction(action: (formData: FormData) => Promise<ActionState>, formData: FormData) {
  const result = await action(formData);
  if (result.error) toast.error(result.error);
  else if (result.success) toast.success(result.success);
}

export function SeatUsageCard({ seats }: { seats: SeatUsage }) {
  return (
    <Card className="border-none bg-secondary/40 ring-1 ring-border">
      <CardHeader>
        <CardTitle>Vagas de profissionais</CardTitle>
        <CardDescription>
          Quem só faz recepção não entra no limite de profissionais do seu plano.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="font-serif text-3xl">
          {seats.usedProfessionals} de {seats.maxProfessionals}
        </p>
        <p className="text-sm text-muted-foreground">profissionais utilizados neste plano</p>
      </CardContent>
    </Card>
  );
}

export function TeamInviteCard({ canManage }: { canManage: boolean }) {
  const [state, action, pending] = useActionState(createTeamInviteAction, {} as InviteActionState);
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);

  async function copyLink() {
    if (!state.inviteLink || copying) return;
    setCopying(true);
    try {
      const ok = await copyTextToClipboard(state.inviteLink);
      if (!ok) {
        toast.error(CLIPBOARD_COPY.failure);
        return;
      }
      setCopied(true);
      toast.success(CLIPBOARD_COPY.inviteSuccess);
      window.setTimeout(() => setCopied(false), 2500);
    } finally {
      setCopying(false);
    }
  }

  if (!canManage) {
    return null;
  }

  return (
    <Card className="border-none ring-1 ring-border">
      <CardHeader>
        <CardTitle>Convidar para a equipe</CardTitle>
        <CardDescription>
          Com e-mail, só aquela pessoa consegue entrar. Sem e-mail, nasce um link para você copiar e
          enviar agora. Depois de sair da tela, o link não aparece de novo.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form action={action} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
            <div className="grid gap-2">
              <Label htmlFor="email">E-mail (opcional)</Label>
              <Input id="email" name="email" type="email" className="h-11" placeholder="pessoa@email.com" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Função na equipe</Label>
              <select id="role" name="role" defaultValue="professional" className={selectClassName}>
                {INVITE_ROLES.map((role: InviteRole) => (
                  <option key={role} value={role}>
                    {MEMBER_ROLE_LABEL[role]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {state.fieldErrors?.email ? <p className="text-sm text-destructive">{state.fieldErrors.email}</p> : null}
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <Button type="submit" className="h-12 min-w-[11rem]" disabled={pending}>
            {pending ? "Gerando..." : "Gerar convite"}
          </Button>
        </form>
        {state.inviteLink ? (
          <div className="grid gap-2 rounded-2xl bg-secondary/50 p-4">
            <p className="text-sm font-medium">
              {state.emailBound ? "Link vinculado ao e-mail informado" : "Link secreto. Copie agora."}
            </p>
            <p className="break-all text-sm text-muted-foreground">{state.inviteLink}</p>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => void copyLink()}
              disabled={copying}
              aria-busy={copying}
            >
              {copied ? "Copiado" : "Copiar link de convite"}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function PendingInvitesList({
  invites,
  canManage,
  timezone,
}: {
  invites: PendingInvite[];
  canManage: boolean;
  timezone: string;
}) {
  if (!canManage || invites.length === 0) {
    return null;
  }

  return (
    <Card className="border-none ring-1 ring-border">
      <CardHeader>
        <CardTitle>Convites em aberto</CardTitle>
        <CardDescription>Aqui aparece para quem o convite foi enviado, a função e até quando vale.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {invites.map((invite) => (
          <div key={invite.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-secondary/40 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium break-all">
                {invite.email ?? "Link secreto"} · {MEMBER_ROLE_LABEL[invite.role]}
              </p>
              <p className="text-xs text-muted-foreground">Expira em {formatDate(invite.expiresAt, timezone)}</p>
            </div>
            <PendingForm action={(formData) => runAction(revokeTeamInviteAction, formData)}>
              {(busy) => (
                <>
                  <input type="hidden" name="inviteId" value={invite.id} />
                  <Button type="submit" variant="ghost" className="h-11" disabled={busy} aria-busy={busy}>
                    {busy ? "Cancelando..." : "Cancelar convite"}
                  </Button>
                </>
              )}
            </PendingForm>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function MemberManagementList({
  members,
  canManage,
  currentUserId,
  timezone,
}: {
  members: TeamMember[];
  canManage: boolean;
  currentUserId: string;
  timezone: string;
}) {
  if (!canManage) {
    return null;
  }

  return (
    <div className="grid gap-3">
      {members.map((member) => (
        <MemberManageCard
          key={`manage-${member.memberId}`}
          member={member}
          currentUserId={currentUserId}
          timezone={timezone}
        />
      ))}
    </div>
  );
}

function MemberManageCard({
  member,
  currentUserId,
  timezone,
}: {
  member: TeamMember;
  currentUserId: string;
  timezone: string;
}) {
  const [pending, startTransition] = useTransition();
  const isOwner = member.role === "owner";
  const isSelf = member.userId === currentUserId;

  function submit(action: (formData: FormData) => Promise<ActionState>, formData: FormData) {
    if (pending) return;
    startTransition(() => {
      void runAction(action, formData);
    });
  }

  return (
    <Card className="border-none ring-1 ring-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <PersonMark name={member.displayName ?? member.fullName} size="sm" />
          <span className="min-w-0 break-words">{member.displayName ?? member.fullName}</span>
        </CardTitle>
        <CardDescription className="break-words whitespace-normal">
          Entrou em {formatDate(member.joinedAt, timezone)}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{MEMBER_ROLE_LABEL[member.role]}</Badge>
          <Badge variant="outline">{MEMBER_STATUS_LABEL[member.status]}</Badge>
          {member.hasProfessionalProfile ? (
            <Badge variant={member.bookingEnabled ? "default" : "outline"}>
              {member.bookingEnabled ? "Recebe reservas" : "Pausado para reservas"}
            </Badge>
          ) : (
            <Badge variant="outline">Recepção</Badge>
          )}
          <Badge variant="ghost">{member.serviceCount} serviços</Badge>
        </div>
        {isOwner ? (
          <p className="text-sm text-muted-foreground">
            O dono não pode ser removido nem rebaixado nesta etapa.
          </p>
        ) : (
          <fieldset disabled={pending} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {member.status !== "removed" ? (
              <form
                action={(formData) => submit(updateMemberRoleAction, formData)}
                className="flex min-w-0 flex-1 gap-2"
              >
                <input type="hidden" name="memberId" value={member.memberId} />
                <select
                  name="role"
                  defaultValue={member.role}
                  className={selectClassName}
                  aria-label="Função na equipe"
                >
                  {INVITE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {MEMBER_ROLE_LABEL[role]}
                    </option>
                  ))}
                </select>
                <Button type="submit" variant="outline" className="h-11 shrink-0" aria-busy={pending}>
                  {pending ? "Salvando..." : "Salvar função"}
                </Button>
              </form>
            ) : null}
            {member.status === "active" ? (
              <form action={(formData) => submit(deactivateMemberAction, formData)}>
                <input type="hidden" name="memberId" value={member.memberId} />
                <Button type="submit" variant="outline" className="h-11">
                  {pending ? "Salvando..." : `Desativar${isSelf ? " (você)" : ""}`}
                </Button>
              </form>
            ) : null}
            {member.status === "inactive" ? (
              <form action={(formData) => submit(reactivateMemberAction, formData)}>
                <input type="hidden" name="memberId" value={member.memberId} />
                <Button type="submit" variant="outline" className="h-11">
                  {pending ? "Salvando..." : "Reativar"}
                </Button>
              </form>
            ) : null}
            {member.status !== "removed" ? (
              <form action={(formData) => submit(removeMemberAction, formData)}>
                <input type="hidden" name="memberId" value={member.memberId} />
                <Button type="submit" variant="ghost" className="h-11">
                  {pending ? "Salvando..." : "Remover"}
                </Button>
              </form>
            ) : null}
          </fieldset>
        )}
      </CardContent>
    </Card>
  );
}
