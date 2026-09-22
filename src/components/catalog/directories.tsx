"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CalendarDays, Clock3, Mail, NotebookText, Phone, Scissors, UserRound } from "lucide-react";
import type { ActionState } from "@/lib/auth/actions";
import {
  archiveClientAction,
  archiveServiceAction,
  saveClientAction,
  saveProfessionalProfileAction,
  saveServiceAction,
  toggleOwnServiceAction,
} from "@/lib/catalog/actions";
import type { ClientRow, MemberRole, ServiceRow, TeamMember } from "@/lib/catalog/queries";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCentsInput, formatCentsToReais } from "@/lib/validation/money";
import { formatPhoneBr } from "@/lib/validation/phone";

const roleLabel: Record<MemberRole, string> = {
  owner: "Dono",
  admin: "Admin",
  professional: "Profissional",
  receptionist: "Recepção",
};

const statusLabel = {
  invited: "Convidado",
  active: "Ativo",
  inactive: "Inativo",
  removed: "Removido",
};

function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function FormFields({
  state,
  children,
}: {
  state: ActionState;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-3">
      {children}
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </div>
  );
}

function useCatalogAction(
  serverAction: (prev: ActionState, formData: FormData) => Promise<ActionState>,
  onSuccess: () => void,
) {
  return useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await serverAction(prev, formData);
    if (result.success) {
      toast.success(result.success);
      onSuccess();
    } else if (result.error && !result.fieldErrors) {
      toast.error(result.error);
    }
    return result;
  }, {});
}

async function runFormAction(
  action: (formData: FormData) => Promise<ActionState>,
  formData: FormData,
) {
  const result = await action(formData);
  if (result.error) {
    toast.error(result.error);
  } else if (result.success) {
    toast.success(result.success);
  }
}

export function TeamDirectory({
  members,
  currentUserId,
  canManage,
}: {
  members: TeamMember[];
  currentUserId: string;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [state, action, pending] = useCatalogAction(saveProfessionalProfileAction, () => {
    setEditing(null);
  });

  return (
    <div className="grid gap-4">
      {members.length === 0 ? (
        <Card className="border-none ring-1 ring-border">
          <CardContent className="py-8 text-sm text-muted-foreground">
            Nenhuma pessoa neste workspace ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {members.map((member) => {
            const canEdit =
              member.hasProfessionalProfile && (canManage || member.userId === currentUserId);
            return (
              <Card key={member.memberId} className="rounded-3xl border-border/70 bg-card/85 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                <CardHeader className="grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3">
                  <Avatar size="lg" className="row-span-2">
                    <AvatarFallback className="bg-secondary text-primary">
                      {initials(member.displayName ?? member.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <CardTitle className="col-start-2 truncate">
                    {member.displayName ?? member.fullName}
                  </CardTitle>
                  <CardDescription className="col-start-2 flex items-center gap-1 truncate">
                    <Mail className="size-3" /> {member.email}
                  </CardDescription>
                  {canEdit ? (
                    <CardAction className="col-start-3">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(member)}>
                        Editar
                      </Button>
                    </CardAction>
                  ) : null}
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
                  <Badge variant="secondary">{roleLabel[member.role]}</Badge>
                  <Badge variant="outline">{statusLabel[member.status]}</Badge>
                  {member.hasProfessionalProfile ? (
                    <Badge variant={member.bookingEnabled ? "default" : "outline"}>
                      {member.bookingEnabled ? "Atende clientes" : "Não atende"}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Sem perfil de atendimento</Badge>
                  )}
                  <Badge variant="ghost">{member.serviceCount} serviços</Badge>
                  {member.hasProfessionalProfile ? (
                    <Link
                      href={`/app/equipe/${member.memberId}/disponibilidade`}
                      className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                      <CalendarDays className="size-3.5" /> Jornada
                    </Link>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Perfil profissional</DialogTitle>
            <DialogDescription>Nome de apresentação e bio para o atendimento.</DialogDescription>
          </DialogHeader>
          {editing ? (
            <form key={editing.memberId} action={action} className="grid gap-4">
              <input type="hidden" name="memberId" value={editing.memberId} />
              <FormFields state={state}>
                <div className="grid gap-2">
                  <Label htmlFor="displayName">Nome de apresentação</Label>
                  <Input
                    id="displayName"
                    name="displayName"
                    defaultValue={editing.displayName ?? editing.fullName}
                    className="h-11"
                    required
                  />
                  {state.fieldErrors?.displayName ? (
                    <p className="text-sm text-destructive">{state.fieldErrors.displayName}</p>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea id="bio" name="bio" defaultValue={editing.bio ?? ""} />
                </div>
                {canManage ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="hidden" name="manageBooking" value="1" />
                    <input
                      type="checkbox"
                      name="bookingEnabled"
                      value="true"
                      defaultChecked={Boolean(editing.bookingEnabled)}
                      className="size-4 rounded border-input"
                    />
                    Atende clientes
                  </label>
                ) : null}
              </FormFields>
              <DialogFooter>
                <Button type="submit" disabled={pending} className="h-11">
                  {pending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ServiceCatalog({
  services,
  professionals,
  canManage,
  currentMemberId,
}: {
  services: ServiceRow[];
  professionals: TeamMember[];
  canManage: boolean;
  currentMemberId: string | null;
}) {
  const [editing, setEditing] = useState<ServiceRow | "new" | null>(null);
  const [state, action, pending] = useCatalogAction(saveServiceAction, () => {
    setEditing(null);
  });
  const bookable = professionals.filter((member) => member.hasProfessionalProfile);
  const canToggleOwn = Boolean(currentMemberId) && !canManage &&
    professionals.some((member) => member.memberId === currentMemberId && member.hasProfessionalProfile);

  const current = editing && editing !== "new" ? editing : null;

  return (
    <div className="grid gap-4">
      {canManage ? (
        <div className="flex justify-end">
          <Button className="h-11" onClick={() => setEditing("new")}>
            Novo serviço
          </Button>
        </div>
      ) : null}
      {services.length === 0 ? (
        <Card className="border-none ring-1 ring-border">
          <CardContent className="py-8 text-sm text-muted-foreground">
            Nenhum serviço cadastrado ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
        {services.map((service) => {
          const performs = currentMemberId
            ? service.professionalMemberIds.includes(currentMemberId)
            : false;
          return (
            <Card key={service.id} className="rounded-3xl border-border/70 bg-card/85 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
              <CardHeader>
                <div className="mb-3 flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
                  <Scissors className="size-4" />
                </div>
                <CardTitle className="pr-16 text-lg">{service.name}</CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-1"><Clock3 className="size-3" /> {service.durationMinutes} min</span>
                  <span className="font-medium text-foreground">{formatCentsToReais(service.priceCents)}</span>
                </CardDescription>
                {canManage ? (
                  <CardAction>
                    <Button variant="outline" size="sm" onClick={() => setEditing(service)}>
                      Editar
                    </Button>
                  </CardAction>
                ) : null}
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
                <Badge variant={service.active ? "default" : "outline"}>
                  {service.active ? "Ativo" : "Pausado"}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {service.professionalMemberIds.length} profissionais
                </span>
                {canManage ? (
                  <form action={(formData) => runFormAction(archiveServiceAction, formData)}>
                    <input type="hidden" name="id" value={service.id} />
                    <Button variant="ghost" size="sm" type="submit">
                      Arquivar
                    </Button>
                  </form>
                ) : null}
                {canToggleOwn && currentMemberId ? (
                  <form action={(formData) => runFormAction(toggleOwnServiceAction, formData)}>
                    <input type="hidden" name="serviceId" value={service.id} />
                    <input type="hidden" name="enabled" value={performs ? "false" : "true"} />
                    <Button variant="outline" size="sm" type="submit">
                      {performs ? "Deixar de realizar" : "Eu realizo este serviço"}
                    </Button>
                  </form>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
        </div>
      )}
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{current ? "Editar serviço" : "Novo serviço"}</DialogTitle>
            <DialogDescription>Preço em reais; o banco guarda centavos.</DialogDescription>
          </DialogHeader>
          <form key={current?.id ?? "new"} action={action} className="grid gap-4">
            {current ? <input type="hidden" name="id" value={current.id} /> : null}
            <FormFields state={state}>
              <div className="grid gap-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" name="name" required defaultValue={current?.name} className="h-11" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea id="description" name="description" defaultValue={current?.description ?? ""} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="durationMinutes">Duração (min)</Label>
                  <Input
                    id="durationMinutes"
                    name="durationMinutes"
                    type="number"
                    min={5}
                    max={480}
                    required
                    defaultValue={current?.durationMinutes ?? 45}
                    className="h-11"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="priceReais">Preço (R$)</Label>
                  <Input
                    id="priceReais"
                    name="priceReais"
                    inputMode="decimal"
                    required
                    defaultValue={current ? formatCentsInput(current.priceCents) : ""}
                    className="h-11"
                    placeholder="80,00"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="active"
                  value="true"
                  defaultChecked={current?.active ?? true}
                  className="size-4 rounded border-input"
                />
                Serviço ativo
              </label>
              <fieldset className="grid gap-2">
                <legend className="text-sm font-medium">Quem realiza</legend>
                {bookable.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum profissional com perfil de atendimento neste workspace.
                  </p>
                ) : (
                  bookable.map((member) => (
                    <label key={member.memberId} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="professionalMemberIds"
                        value={member.memberId}
                        defaultChecked={current?.professionalMemberIds.includes(member.memberId)}
                        className="size-4 rounded border-input"
                      />
                      {member.displayName ?? member.fullName}
                    </label>
                  ))
                )}
              </fieldset>
            </FormFields>
            <DialogFooter>
              <Button type="submit" disabled={pending} className="h-11">
                {pending ? "Salvando..." : "Salvar serviço"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ClientDirectory({
  clients,
  canEdit,
}: {
  clients: ClientRow[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<ClientRow | "new" | null>(null);
  const [state, action, pending] = useCatalogAction(saveClientAction, () => {
    setEditing(null);
  });

  const current = editing && editing !== "new" ? editing : null;

  return (
    <div className="grid gap-4">
      {canEdit ? (
        <div className="flex justify-end">
          <Button className="h-11" onClick={() => setEditing("new")}>
            Novo cliente
          </Button>
        </div>
      ) : null}
      {clients.length === 0 ? (
        <Card className="border-none ring-1 ring-border">
          <CardContent className="py-8 text-sm text-muted-foreground">
            Nenhum cliente cadastrado neste negócio.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
        {clients.map((client) => (
          <Card key={client.id} className="rounded-3xl border-border/70 bg-card/85 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
            <CardHeader className="grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3">
              <Avatar size="lg" className="row-span-2">
                <AvatarFallback className="bg-secondary text-primary">
                  {initials(client.fullName)}
                </AvatarFallback>
              </Avatar>
              <CardTitle className="col-start-2 truncate">{client.fullName}</CardTitle>
              <CardDescription className="col-start-2 flex flex-wrap gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1"><Phone className="size-3" /> {client.phone ? formatPhoneBr(client.phone) : "Sem telefone"}</span>
                {client.email ? <span className="inline-flex items-center gap-1 truncate"><Mail className="size-3" /> {client.email}</span> : null}
              </CardDescription>
              {canEdit ? (
                <CardAction className="col-start-3">
                  <div className="flex flex-wrap justify-end gap-1">
                    <Button variant="outline" size="sm" onClick={() => setEditing(client)}>
                      Editar
                    </Button>
                    <form action={(formData) => runFormAction(archiveClientAction, formData)}>
                      <input type="hidden" name="id" value={client.id} />
                      <Button variant="ghost" size="sm" type="submit">
                        Arquivar
                      </Button>
                    </form>
                  </div>
                </CardAction>
              ) : null}
            </CardHeader>
            {client.notes ? (
              <CardContent className="border-t border-border/60 pt-4">
                <p className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
                  <NotebookText className="mt-1 size-3.5 shrink-0" /> {client.notes}
                </p>
              </CardContent>
            ) : (
              <CardContent className="border-t border-border/60 pt-4">
                <p className="flex items-center gap-2 text-xs text-muted-foreground"><UserRound className="size-3.5" /> Cadastro pronto para agendamentos</p>
              </CardContent>
            )}
          </Card>
        ))}
        </div>
      )}
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{current ? "Editar cliente" : "Novo cliente"}</DialogTitle>
            <DialogDescription>
              Cadastro interno do salão. Não é a conta /cliente do Agendê.
            </DialogDescription>
          </DialogHeader>
          <form key={current?.id ?? "new"} action={action} className="grid gap-4">
            {current ? <input type="hidden" name="id" value={current.id} /> : null}
            <FormFields state={state}>
              <div className="grid gap-2">
                <Label htmlFor="fullName">Nome</Label>
                <Input
                  id="fullName"
                  name="fullName"
                  required
                  defaultValue={current?.fullName}
                  className="h-11"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  name="phone"
                  defaultValue={current?.phone ?? ""}
                  className="h-11"
                  placeholder="(32) 99999-9999"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={current?.email ?? ""}
                  className="h-11"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="birthDate">Nascimento</Label>
                <Input
                  id="birthDate"
                  name="birthDate"
                  type="date"
                  defaultValue={current?.birthDate ?? ""}
                  className="h-11"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea id="notes" name="notes" defaultValue={current?.notes ?? ""} />
              </div>
            </FormFields>
            <DialogFooter>
              <Button type="submit" disabled={pending} className="h-11">
                {pending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
