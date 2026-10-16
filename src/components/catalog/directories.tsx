"use client";

import Link from "next/link";
import { ProfessionalPhotoEditor } from "./professional-photo-editor";
import { AvatarImage } from "@/components/ui/avatar";
import { useActionState, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { CalendarDays, Clock3, Mail, NotebookText, Phone, Sparkles, UserRound, WandSparkles } from "lucide-react";
import { filterCatalogServices, type ServiceVisibilityFilter } from "@/components/catalog/service-filters";
import { EmptyState } from "@/components/app/empty-state";
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
import { ConfirmAction } from "@/components/usability/confirm-action";
import { OwnProfessionalProfile } from "@/components/catalog/own-professional-profile";

const roleLabel: Record<MemberRole, string> = {
  owner: "Dono",
  admin: "Administrador",
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
      {state.error ? (
        <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}

function useCatalogAction(
  serverAction: (prev: ActionState, formData: FormData) => Promise<ActionState>,
  onSuccess: (message: string) => void,
) {
  return useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await serverAction(prev, formData);
    if (result.success) {
      toast.success(result.success);
      onSuccess(result.success);
    } else if (result.error && !result.fieldErrors) {
      toast.error(result.error);
    }
    return result;
  }, {});
}

async function runFormAction(
  action: (formData: FormData) => Promise<ActionState>,
  formData: FormData,
): Promise<ActionState> {
  const result = await action(formData);
  if (result.error) {
    toast.error(result.error);
  } else if (result.success) {
    toast.success(result.success);
  }
  return result;
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

  const mine = members.find((member) => member.userId === currentUserId);

  return (
    <div className="grid gap-4">
      {mine ? <OwnProfessionalProfile member={mine} canManage={canManage} /> : null}
      {members.length === 0 ? (
        <Card className="border-none ring-1 ring-[#f0e4de]">
          <CardContent>
            <EmptyState
              icon={Sparkles}
              title="Ninguém na equipe ainda"
              description="Nenhuma pessoa nesta equipe ainda. Convide a primeira para dividir a agenda."
              action={canManage ? (
                <Button className="h-11 w-fit rounded-full" render={<Link href="/app/configuracoes/equipe" />}>
                  Convidar a primeira pessoa
                </Button>
              ) : undefined}
            />
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
                    <AvatarImage src={`/api/professionals/photo?memberId=${member.memberId}`} alt={`Foto de ${member.displayName ?? member.fullName}`} loading="lazy" />
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
                      <Button type="button" variant="ghost" className="h-11" onClick={() => setEditing(member)}>
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
                      {member.bookingEnabled ? "Recebe reservas" : "Pausado para reservas"}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Não atende clientes (só recepção)</Badge>
                  )}
                  <Badge variant="ghost">{member.serviceCount} serviços</Badge>
                  {member.hasProfessionalProfile ? (
                    <Button
                      variant="outline"
                      className="h-11 w-full sm:ml-auto sm:w-auto"
                      render={<Link href={`/app/equipe/${member.memberId}/disponibilidade`} />}
                    >
                      <CalendarDays className="size-4" /> Horários de trabalho
                    </Button>
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
            <DialogTitle>Perfil de atendimento</DialogTitle>
            <DialogDescription>Nome e frase que as clientes veem. O aviso de salvo só aparece depois da gravação.</DialogDescription>
          </DialogHeader>
          {editing ? <ProfessionalPhotoEditor key={editing.memberId} memberId={editing.memberId} name={editing.displayName ?? editing.fullName} /> : null}
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
                  <Label htmlFor="bio">Uma frase sobre o atendimento</Label>
                  <Textarea id="bio" name="bio" defaultValue={editing.bio ?? ""} placeholder="Ex.: Manicure há 10 anos, atendimento com hora marcada." />
                </div>
                {canManage ? (
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <input type="hidden" name="manageBooking" value="1" />
                    <input
                      type="checkbox"
                      name="bookingEnabled"
                      value="true"
                      defaultChecked={Boolean(editing.bookingEnabled)}
                      className="size-5 rounded border-input"
                    />
                    Recebe reservas online
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

function professionalLabel(member: TeamMember) {
  return member.displayName ?? member.fullName;
}

function linkedProfessionalNames(service: ServiceRow, professionals: TeamMember[]) {
  return service.professionalMemberIds.flatMap((memberId) => {
    const member = professionals.find((person) => person.memberId === memberId);
    return member ? [professionalLabel(member)] : [];
  });
}

function formatLinkedNames(names: string[]) {
  if (names.length === 0) return "Nenhuma profissional vinculada";
  if (names.length <= 2) return names.join(" · ");
  return `${names.slice(0, 2).join(" · ")} · +${names.length - 2}`;
}

const visibilityFilters: { id: ServiceVisibilityFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "active", label: "Na agenda" },
  { id: "hidden", label: "Ocultos" },
];

export function ServiceCatalog({
  services,
  professionals,
  canManage,
  currentMemberId,
  startCreating = false,
  loadError = null,
  teamError = null,
  query = "",
}: {
  services: ServiceRow[];
  professionals: TeamMember[];
  canManage: boolean;
  currentMemberId: string | null;
  startCreating?: boolean;
  loadError?: string | null;
  teamError?: string | null;
  query?: string;
}) {
  const [editing, setEditing] = useState<ServiceRow | "new" | null>(startCreating && canManage ? "new" : null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<ServiceVisibilityFilter>("all");
  const [professionalId, setProfessionalId] = useState("all");
  const [state, action, pending] = useCatalogAction(saveServiceAction, (message) => {
    setSavedNotice(message);
    setEditing(null);
  });
  const [togglePending, startToggle] = useTransition();
  const bookable = professionals.filter((member) => member.hasProfessionalProfile);
  const canToggleOwn = Boolean(currentMemberId) && !canManage &&
    professionals.some((member) => member.memberId === currentMemberId && member.hasProfessionalProfile);
  const filtered = filterCatalogServices(services, visibility, professionalId);
  const filtersActive = visibility !== "all" || professionalId !== "all";
  const activeServices = filtered.filter((service) => service.active);
  const hiddenServices = filtered.filter((service) => !service.active);
  const current = editing && editing !== "new" ? editing : null;

  function remember(result: ActionState) {
    if (result.success) setSavedNotice(result.success);
    return result;
  }

  return (
    <div className="grid gap-4">
      {savedNotice ? (
        <p role="status" className="w-fit rounded-full bg-metric-blush px-4 py-2 text-sm text-wine-deep">
          {savedNotice}
        </p>
      ) : null}

      <div className="agende-panel grid gap-4 rounded-[1.5rem] p-4 ring-1 ring-[#f0e4de] sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por visibilidade">
            {visibilityFilters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                aria-pressed={visibility === filter.id}
                onClick={() => setVisibility(filter.id)}
                className={`inline-flex h-11 items-center rounded-full px-4 text-sm font-medium ring-1 transition ${
                  visibility === filter.id
                    ? "bg-wine-deep text-white ring-wine-deep"
                    : "bg-white text-wine-deep ring-[#f0e4de] hover:bg-metric-blush"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          {canManage ? (
            <Button type="button" className="h-11 rounded-full px-5" onClick={() => setEditing("new")}>
              Novo serviço
            </Button>
          ) : null}
        </div>
        <label className="grid gap-2 text-sm sm:max-w-xs">
          <span className="font-medium text-wine-deep">Profissional</span>
          <select
            value={professionalId}
            onChange={(event) => setProfessionalId(event.target.value)}
            className="h-11 rounded-xl border border-input bg-white px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
            aria-label="Filtrar por profissional"
          >
            <option value="all">Todas as profissionais</option>
            <option value="none">Sem profissional</option>
            {bookable.map((member) => (
              <option key={member.memberId} value={member.memberId}>
                {professionalLabel(member)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loadError ? (
        <div role="alert" className="rounded-[1.5rem] border border-destructive/30 bg-destructive/10 px-5 py-6">
          <p className="font-serif text-2xl text-destructive">Não foi possível carregar os serviços</p>
          <p className="mt-2 text-sm leading-6">{loadError}</p>
        </div>
      ) : null}
      {teamError ? (
        <div role="alert" className="rounded-[1.5rem] border border-destructive/30 bg-destructive/10 px-5 py-6">
          <p className="font-serif text-2xl text-destructive">Não foi possível carregar a equipe</p>
          <p className="mt-2 text-sm leading-6">{teamError}</p>
        </div>
      ) : null}
      {loadError ? null : services.length === 0 ? (
        <Card className="border-none ring-1 ring-[#f0e4de]">
          <CardContent>
            <EmptyState
              icon={WandSparkles}
              title={query ? "Nenhum serviço encontrado" : "Nenhum serviço ainda"}
              description={
                query
                  ? `Nenhum serviço encontrado para “${query}”.`
                  : "Nenhum serviço cadastrado ainda. Cadastre o primeiro para as clientes poderem marcar."
              }
              action={!query && canManage ? (
                <Button type="button" className="h-11 w-fit rounded-full" onClick={() => setEditing("new")}>
                  Cadastrar o primeiro serviço
                </Button>
              ) : undefined}
            />
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-none ring-1 ring-[#f0e4de]">
          <CardContent>
            <EmptyState
              icon={WandSparkles}
              title="Nenhum serviço com esses filtros"
              description="A lista continua salva. Limpe o filtro para ver os outros serviços."
              action={
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-fit rounded-full"
                  onClick={() => {
                    setVisibility("all");
                    setProfessionalId("all");
                  }}
                >
                  Limpar filtros
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {filtersActive ? (
            <p className="text-sm text-muted-foreground">
              {filtered.length === 1 ? "1 serviço neste filtro" : `${filtered.length} serviços neste filtro`}
            </p>
          ) : null}
          {[
            { title: "Na agenda", items: activeServices },
            { title: "Ocultos na agenda online", items: hiddenServices },
          ].filter((group) => group.items.length > 0).map((group) => (
            <section key={group.title} className="grid gap-3" aria-label={group.title}>
              <h2 className="font-serif text-2xl text-wine-deep">{group.title}</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {group.items.map((service) => {
                  const performs = currentMemberId
                    ? service.professionalMemberIds.includes(currentMemberId)
                    : false;
                  const names = linkedProfessionalNames(service, professionals);
                  return (
                    <article key={service.id} className="agende-panel flex flex-col rounded-[1.6rem] p-5 ring-1 ring-[#f0e4de]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold tracking-[0.16em] text-[var(--rose-ink)] uppercase">
                            {service.active ? "Aparece na agenda" : "Oculto na agenda online"}
                          </p>
                          <h3 className="mt-1 font-serif text-2xl text-wine-deep">{service.name}</h3>
                        </div>
                        <p className="font-serif text-2xl whitespace-nowrap text-wine-deep">{formatCentsToReais(service.priceCents)}</p>
                      </div>
                      {service.description ? (
                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">{service.description}</p>
                      ) : null}
                      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 className="size-3.5" aria-hidden="true" />
                          {service.durationMinutes} min
                        </span>
                        <span>{formatLinkedNames(names)}</span>
                      </p>
                      <div className="mt-4 flex flex-col gap-2 border-t border-[#f0e4de] pt-4 sm:flex-row sm:flex-wrap">
                        {canManage ? (
                          <Button type="button" variant="outline" className="h-11 rounded-full" onClick={() => setEditing(service)}>
                            Editar
                          </Button>
                        ) : null}
                        {canManage ? (
                          <ConfirmAction
                            title="Ocultar este serviço?"
                            description="Ele some da lista. Você pode cadastrar de novo depois."
                            confirmLabel="Sim, ocultar"
                            cancelLabel="Manter na lista"
                            trigger={
                              <Button variant="outline" className="h-11 rounded-full" type="button">
                                Ocultar da lista
                              </Button>
                            }
                            onConfirm={async () => {
                              const formData = new FormData();
                              formData.set("id", service.id);
                              const result = await remember(await runFormAction(archiveServiceAction, formData));
                              if (result.error) throw new Error(result.error);
                            }}
                          />
                        ) : null}
                        {canToggleOwn && currentMemberId ? (
                          <form
                            action={(formData) => {
                              if (togglePending) return;
                              startToggle(() => {
                                void runFormAction(toggleOwnServiceAction, formData).then(remember);
                              });
                            }}
                          >
                            <input type="hidden" name="serviceId" value={service.id} />
                            <input type="hidden" name="enabled" value={performs ? "false" : "true"} />
                            <Button variant="outline" className="h-11 rounded-full" type="submit" disabled={togglePending} aria-busy={togglePending}>
                              {togglePending ? "Salvando..." : performs ? "Não faço mais este serviço" : "Eu faço este serviço"}
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent
          overlayClassName="bg-[rgb(92_26_46/0.38)]"
          className="max-h-[min(92vh,44rem)] overflow-y-auto bg-[var(--cream)] sm:max-w-xl"
        >
          <DialogHeader>
            <DialogTitle className="font-serif text-3xl text-wine-deep">{current ? "Editar serviço" : "Novo serviço"}</DialogTitle>
            <DialogDescription>Nome, tempo, preço e quem atende. O aviso de salvo só aparece depois da gravação.</DialogDescription>
          </DialogHeader>
          <form key={current?.id ?? "new"} action={action} className="grid gap-4" aria-busy={pending}>
            {current ? <input type="hidden" name="id" value={current.id} /> : null}
            <FormFields state={state}>
              <section className="grid gap-3 rounded-[1.25rem] bg-white p-4 ring-1 ring-[#f0e4de]">
                <h3 className="font-serif text-xl text-wine-deep">O serviço</h3>
                <div className="grid gap-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input id="name" name="name" required defaultValue={current?.name} className="h-11 bg-white" />
                  {state.fieldErrors?.name ? <p className="text-sm text-destructive">{state.fieldErrors.name}</p> : null}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea id="description" name="description" defaultValue={current?.description ?? ""} className="bg-white" placeholder="O que a cliente pode esperar neste atendimento." />
                </div>
              </section>
              <section className="grid gap-3 rounded-[1.25rem] bg-white p-4 ring-1 ring-[#f0e4de]">
                <h3 className="font-serif text-xl text-wine-deep">Tempo e preço</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="durationMinutes">Tempo em minutos</Label>
                    <Input
                      id="durationMinutes"
                      name="durationMinutes"
                      type="number"
                      min={5}
                      max={480}
                      required
                      defaultValue={current?.durationMinutes ?? 45}
                      className="h-11 bg-white"
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
                      className="h-11 bg-white"
                      placeholder="80,00"
                    />
                    {state.fieldErrors?.priceReais ? <p className="text-sm text-destructive">{state.fieldErrors.priceReais}</p> : null}
                  </div>
                </div>
                <label className="flex min-h-11 items-center gap-3 rounded-2xl bg-metric-blush/70 px-3 text-sm text-wine-deep">
                  <input
                    type="checkbox"
                    name="active"
                    value="true"
                    defaultChecked={current?.active ?? true}
                    className="size-5 accent-[var(--wine)]"
                  />
                  Aparece na agenda online
                </label>
              </section>
              <fieldset className="grid gap-3 rounded-[1.25rem] bg-white p-4 ring-1 ring-[#f0e4de]">
                <legend className="px-1 font-serif text-xl text-wine-deep">Quem faz este serviço</legend>
                <p className="text-sm leading-6 text-muted-foreground">
                  Marque quem atende. Se ninguém estiver marcado, clientes não veem na internet.
                </p>
                {teamError ? (
                  <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {teamError}
                  </p>
                ) : bookable.length === 0 ? (
                  <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    Cadastre uma profissional na equipe antes de salvar o serviço.
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {bookable.map((member) => (
                      <label key={member.memberId} className="flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl bg-[var(--cream)] px-3 py-3 ring-1 ring-[#f0e4de] has-[:checked]:bg-metric-blush has-[:checked]:ring-[var(--rose-ink)]">
                        <input
                          type="checkbox"
                          name="professionalMemberIds"
                          value={member.memberId}
                          defaultChecked={
                            current
                              ? current.professionalMemberIds.includes(member.memberId)
                              : bookable.length === 1
                          }
                          className="size-5 accent-[var(--wine)]"
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-wine-deep">{professionalLabel(member)}</span>
                          <span className="block text-xs text-muted-foreground">{roleLabel[member.role]}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>
            </FormFields>
            <DialogFooter>
              <Button type="submit" disabled={pending} aria-busy={pending} className="h-12 w-full rounded-full sm:w-auto">
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
  startCreating = false,
}: {
  clients: ClientRow[];
  canEdit: boolean;
  startCreating?: boolean;
}) {
  const [editing, setEditing] = useState<ClientRow | "new" | null>(startCreating && canEdit ? "new" : null);
  const [state, action, pending] = useCatalogAction(saveClientAction, () => {
    setEditing(null);
  });

  const current = editing && editing !== "new" ? editing : null;

  return (
    <div className="grid gap-4">
      {canEdit ? (
        <div className="flex justify-end">
          <Button type="button" className="h-11" onClick={() => setEditing("new")}>
            Novo cliente
          </Button>
        </div>
      ) : null}
      {clients.length === 0 ? (
        <Card className="border-none ring-1 ring-[#f0e4de]">
          <CardContent>
            <EmptyState
              icon={UserRound}
              title="Nenhuma cliente ainda"
              description="Nenhum cliente cadastrado neste negócio. Cadastre a primeira ou espere ela marcar pelo link."
              action={canEdit ? (
                <Button type="button" className="h-11 w-fit rounded-full" onClick={() => setEditing("new")}>
                  Cadastrar o primeiro cliente
                </Button>
              ) : undefined}
            />
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
                    <Button type="button" variant="outline" className="h-11" onClick={() => setEditing(client)}>
                      Editar
                    </Button>
                    <ConfirmAction
                      title="Ocultar esta cliente?"
                      description="Ela some da lista. Os horários antigos continuam no histórico."
                      confirmLabel="Sim, ocultar"
                      cancelLabel="Manter na lista"
                      trigger={
                        <Button variant="outline" className="h-11" type="button">
                          Ocultar da lista
                        </Button>
                      }
                      onConfirm={async () => {
                        const formData = new FormData();
                        formData.set("id", client.id);
                        const result = await runFormAction(archiveClientAction, formData);
                        if (result.error) throw new Error(result.error);
                      }}
                    />
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
              Ficha da cliente no salão. Isso não é a conta dela no app Agendê.
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
              <details className="rounded-2xl bg-secondary/40 p-3">
                <summary className="cursor-pointer text-sm font-medium">Mais informações (opcional)</summary>
                <div className="mt-3 grid gap-3">
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
                </div>
              </details>
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
