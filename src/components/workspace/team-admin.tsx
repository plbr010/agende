"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import type { TeamMember } from "@/lib/catalog/queries";
import type { ActionState } from "@/lib/auth/actions";
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
          Recepção não ocupa vaga. O limite vem do plano; o banco continua sendo a regra final.
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

  async function copyLink() {
    if (!state.inviteLink) return;
    await navigator.clipboard.writeText(state.inviteLink);
    setCopied(true);
    toast.success("Link copiado.");
  }

  if (!canManage) {
    return null;
  }

  return (
    <Card className="border-none ring-1 ring-border">
      <CardHeader>
        <CardTitle>Convidar para a equipe</CardTitle>
        <CardDescription>
          Com e-mail, o convite fica preso àquele endereço. Sem e-mail, nasce um link secreto
          compartilhável. O token só aparece agora.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form action={action} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
            <div className="grid gap-2">
              <Label htmlFor="email">E-mail (opcional)</Label>
              <Input id="email" name="email" type="email" className="h-11" placeholder="pessoa@email.com" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Papel</Label>
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
            <Button type="button" variant="outline" className="h-11" onClick={copyLink}>
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
        <CardDescription>O token bruto nunca é guardado. Aqui só aparece o destino e o papel.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {invites.map((invite) => (
          <div key={invite.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-secondary/40 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {invite.email ?? "Link secreto"} · {MEMBER_ROLE_LABEL[invite.role]}
              </p>
              <p className="text-xs text-muted-foreground">Expira em {formatDate(invite.expiresAt, timezone)}</p>
            </div>
            <form action={(formData) => runAction(revokeTeamInviteAction, formData)}>
              <input type="hidden" name="inviteId" value={invite.id} />
              <Button type="submit" variant="ghost" size="sm" className="h-10">
                Revogar
              </Button>
            </form>
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
      {members.map((member) => {
        const isOwner = member.role === "owner";
        const isSelf = member.userId === currentUserId;
        return (
          <Card key={`manage-${member.memberId}`} className="border-none ring-1 ring-border">
            <CardHeader>
              <CardTitle className="truncate">{member.displayName ?? member.fullName}</CardTitle>
              <CardDescription className="truncate">
                Entrou em {formatDate(member.joinedAt, timezone)}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{MEMBER_ROLE_LABEL[member.role]}</Badge>
                <Badge variant="outline">{MEMBER_STATUS_LABEL[member.status]}</Badge>
                {member.hasProfessionalProfile ? (
                  <Badge variant={member.bookingEnabled ? "default" : "outline"}>
                    {member.bookingEnabled ? "Agenda ligada" : "Agenda desligada"}
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
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {member.status !== "removed" ? (
                    <form
                      action={(formData) => runAction(updateMemberRoleAction, formData)}
                      className="flex min-w-0 flex-1 gap-2"
                    >
                      <input type="hidden" name="memberId" value={member.memberId} />
                      <select
                        name="role"
                        defaultValue={member.role}
                        className={selectClassName}
                        aria-label="Papel"
                      >
                        {INVITE_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {MEMBER_ROLE_LABEL[role]}
                          </option>
                        ))}
                      </select>
                      <Button type="submit" variant="outline" className="h-11 shrink-0">
                        Papel
                      </Button>
                    </form>
                  ) : null}
                  {member.status === "active" ? (
                    <form action={(formData) => runAction(deactivateMemberAction, formData)}>
                      <input type="hidden" name="memberId" value={member.memberId} />
                      <Button type="submit" variant="outline" className="h-11">
                        Desativar{isSelf ? " (você)" : ""}
                      </Button>
                    </form>
                  ) : null}
                  {member.status === "inactive" ? (
                    <form action={(formData) => runAction(reactivateMemberAction, formData)}>
                      <input type="hidden" name="memberId" value={member.memberId} />
                      <Button type="submit" variant="outline" className="h-11">
                        Reativar
                      </Button>
                    </form>
                  ) : null}
                  {member.status !== "removed" ? (
                    <form action={(formData) => runAction(removeMemberAction, formData)}>
                      <input type="hidden" name="memberId" value={member.memberId} />
                      <Button type="submit" variant="ghost" className="h-11">
                        Remover
                      </Button>
                    </form>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
