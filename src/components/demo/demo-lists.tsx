"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarClock, Clock3, ContactRound, Mail, NotebookPen, NotebookText, Phone, Search, Sparkles, UserRound, UserRoundCheck, UsersRound, WalletCards, WandSparkles } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { MetricCard } from "@/components/app/metric-card";
import { PageHeader } from "@/components/app/page-header";
import { PersonMark } from "@/components/people/person-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDemo } from "@/components/demo/demo-provider";
import { STATUS_LABEL } from "@/lib/agenda/status";
import { DEMO_PROFESSIONALS, DEMO_SERVICES, serviceById, type DemoClient } from "@/lib/demo/catalog";
import { demoClients } from "@/lib/demo/project";
import { isValidEmail } from "@/lib/validation/email";
import { formatCentsToReais } from "@/lib/validation/money";
import { formatPhoneBr, isValidPhone } from "@/lib/validation/phone";

function matches(query: string, values: Array<string | null>): boolean {
  const needle = query.trim().toLocaleLowerCase("pt-BR");
  if (needle.length < 2) return true;
  return values.some((value) => value?.toLocaleLowerCase("pt-BR").includes(needle));
}

export function DemoClients() {
  const demo = useDemo();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [creating, setCreating] = useState(params.get("novo") === "1");
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clients = demoClients(demo.session, demo.appointments);
  const visible = clients.filter((client) => matches(query, [client.fullName, client.phone, client.email]));
  const withContact = visible.filter((client) => client.phone || client.email).length;
  const withNotes = visible.filter((client) => client.notes).length;

  function save(formData: FormData) {
    const fullName = String(formData.get("fullName") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    if (fullName.length < 2) {
      setError("Informe o nome da cliente.");
      return;
    }
    if (phone && !isValidPhone(phone)) {
      setError("Informe um telefone brasileiro válido, com DDD.");
      return;
    }
    if (email && !isValidEmail(email)) {
      setError("Informe um e-mail válido.");
      return;
    }
    const client: DemoClient = {
      id: crypto.randomUUID(),
      fullName,
      phone: phone || null,
      email: email || null,
      birthDate: null,
      notes: notes || null,
      source: "visitor",
    };
    demo.addClient(client);
    setCreating(false);
    setError(null);
  }

  return (
    <>
      <PageHeader
        eyebrow="Relacionamento"
        title="Clientes"
        description="Fichas fictícias, com o histórico dos horários desta demonstração."
        icon={UsersRound}
        actions={
          <form className="flex w-full gap-2 sm:w-auto" onSubmit={(event) => { event.preventDefault(); setQuery(String(new FormData(event.currentTarget).get("q") ?? "")); }}>
            <Input name="q" defaultValue={query} placeholder="Nome, telefone ou e-mail" className="h-11 bg-background/80" />
            <Button type="submit" variant="outline" className="h-11 rounded-xl" aria-label="Buscar clientes"><Search className="size-4" /> <span className="hidden sm:inline">Buscar</span></Button>
          </form>
        }
      />
      <section className="grid gap-4 sm:grid-cols-3" aria-label="Resumo de clientes">
        <MetricCard label="Clientes ativos" value={visible.length} hint={query.trim().length >= 2 ? "no resultado da busca" : "na sua base"} icon={UsersRound} />
        <MetricCard label="Com contato" value={withContact} hint="telefone ou e-mail disponível" icon={ContactRound} tone="success" />
        <MetricCard label="Com observações" value={withNotes} hint="preferências registradas" icon={NotebookPen} tone="neutral" />
      </section>
      <div className="flex justify-end">
        <Button type="button" className="h-11" onClick={() => { setError(null); setCreating(true); }}>Novo cliente</Button>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">O cadastro novo fica só neste navegador. Telefones e e-mails da base são fictícios.</p>
      {visible.length === 0 ? (
        <Card className="border-none ring-1 ring-[#f0e4de]"><CardContent><EmptyState icon={UserRound} title="Nenhuma cliente ainda" description="Nenhum cliente encontrado. Ajuste a busca ou cadastre uma ficha fictícia." /></CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visible.map((client) => {
            const history = demo.appointments.filter((item) => item.clientId === client.id).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
            const open = openId === client.id;
            return (
              <Card key={client.id} className="rounded-3xl border-border/70 bg-card/85 shadow-sm">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <PersonMark name={client.fullName} photoUrl={null} />
                    <div className="min-w-0">
                      <CardTitle className="font-serif text-xl break-words text-wine-deep">{client.fullName}</CardTitle>
                      <CardDescription className="flex flex-wrap gap-x-3 gap-y-1">
                        <span className="inline-flex items-center gap-1"><Phone className="size-3" /> {client.phone ? formatPhoneBr(client.phone) : "Sem telefone"}</span>
                        {client.email ? <span className="inline-flex items-center gap-1 break-all"><Mail className="size-3" /> {client.email}</span> : null}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3 border-t border-border/60 pt-4">
                  <p className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
                    <NotebookText className="mt-1 size-3.5 shrink-0" /> {client.notes ?? "Cadastro pronto para agendamentos"}
                  </p>
                  <Button type="button" variant="outline" className="h-11 w-fit" aria-expanded={open} onClick={() => setOpenId(open ? null : client.id)}>
                    {open ? "Ocultar histórico" : `Ver histórico (${history.length})`}
                  </Button>
                  {open ? history.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum horário nesta demonstração.</p> : (
                    <ul className="grid gap-2">
                      {history.map((item) => (
                        <li key={item.id} className="rounded-2xl bg-secondary/50 px-3 py-2 text-sm">
                          <span className="font-medium">{item.localDate.split("-").reverse().join("/")} · {item.localStart}</span>
                          <span className="block text-muted-foreground">{item.serviceName} · {item.professionalName} · {STATUS_LABEL[item.status]}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo cliente</DialogTitle>
            <DialogDescription>Ficha da cliente no salão fictício. Isso não cria conta no Agendê.</DialogDescription>
          </DialogHeader>
          <form action={save} className="grid gap-4">
            <div className="grid gap-2"><Label htmlFor="fullName">Nome</Label><Input id="fullName" name="fullName" required className="h-11" /></div>
            <div className="grid gap-2"><Label htmlFor="phone">Telefone</Label><Input id="phone" name="phone" className="h-11" placeholder="(11) 90000-0000" /></div>
            <div className="grid gap-2"><Label htmlFor="email">E-mail</Label><Input id="email" name="email" type="email" className="h-11" /></div>
            <div className="grid gap-2"><Label htmlFor="notes">Observações</Label><Textarea id="notes" name="notes" /></div>
            {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
            <DialogFooter><Button type="submit" className="h-11">Salvar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DemoServices() {
  const [query, setQuery] = useState("");
  const services = DEMO_SERVICES.filter((service) => matches(query, [service.name, service.description]));
  const averagePrice = services.length ? Math.round(services.reduce((sum, service) => sum + service.priceCents, 0) / services.length) : 0;
  const averageDuration = services.length ? Math.round(services.reduce((sum, service) => sum + service.durationMinutes, 0) / services.length) : 0;
  return (
    <>
      <PageHeader eyebrow="O que você oferece" title="Serviços" description="O que o estúdio fictício oferece, quanto tempo dura e o preço. Valores demonstrativos." icon={WandSparkles} />
      <form className="agende-panel grid gap-3 rounded-[1.5rem] p-4 ring-1 ring-[#f0e4de] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" onSubmit={(event) => { event.preventDefault(); setQuery(String(new FormData(event.currentTarget).get("q") ?? "")); }}>
        <div className="grid gap-2">
          <Label htmlFor="service-search">Buscar pelo nome</Label>
          <Input id="service-search" name="q" defaultValue={query} placeholder="Ex.: manicure, escova" className="h-11 bg-white" />
        </div>
        <Button type="submit" variant="outline" className="h-11 rounded-full" aria-label="Buscar serviços"><Search className="size-4" /> Buscar</Button>
      </form>
      <p className="text-sm leading-6 text-muted-foreground">Cadastrar ou editar serviço fica desligado na demonstração. No Agendê, a dona faz isso em Serviços.</p>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo de serviços">
        <MetricCard label="Serviços" value={services.length} hint="serviços cadastrados" icon={Sparkles} />
        <MetricCard label="Ativos" value={services.length} hint="disponíveis para agenda" icon={WandSparkles} tone="success" />
        <MetricCard label="Preço médio" value={formatCentsToReais(averagePrice)} hint="entre os serviços exibidos" icon={WalletCards} tone="warning" />
        <MetricCard label="Duração média" value={`${averageDuration} min`} hint="tempo por atendimento" icon={Clock3} tone="neutral" />
      </section>
      <div className="grid gap-4">
        {services.map((service) => (
          <article key={service.id} className="agende-panel rounded-[1.5rem] p-5 ring-1 ring-[#f0e4de]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="font-serif text-2xl text-wine-deep">{service.name}</h2>
              <p className="font-medium text-wine-deep">{formatCentsToReais(service.priceCents)}</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{service.description}</p>
            <p className="mt-3 text-sm">{service.durationMinutes} minutos</p>
            <p className="mt-2 text-sm text-muted-foreground">Quem faz: {DEMO_PROFESSIONALS.filter((person) => person.serviceIds.includes(service.id)).map((person) => person.displayName).join(", ")}</p>
          </article>
        ))}
      </div>
    </>
  );
}

export function DemoTeam() {
  const linked = DEMO_PROFESSIONALS.reduce((sum, person) => sum + person.serviceIds.length, 0);
  return (
    <>
      <PageHeader eyebrow="Pessoas" title="Equipe" description="Quem atende no estúdio fictício e a jornada usada para calcular os horários." icon={UsersRound} />
      <section className="grid gap-4 sm:grid-cols-3" aria-label="Resumo da equipe">
        <MetricCard label="Pessoas ativas" value={DEMO_PROFESSIONALS.length} hint="pessoas na equipe" icon={UserRoundCheck} />
        <MetricCard label="Na agenda" value={DEMO_PROFESSIONALS.length} hint="quem recebe reservas" icon={CalendarClock} tone="success" />
        <MetricCard label="Serviços por profissional" value={linked} hint="o que cada pessoa faz" icon={Sparkles} tone="neutral" />
      </section>
      <p className="rounded-2xl bg-metric-ivory px-4 py-3 text-sm leading-6 text-muted-foreground">Convite de equipe e edição da jornada ficam desligados na demonstração, para não enviar e-mail nem alterar um salão real. Terça a sábado, 9h às 18h, com intervalo de 12h às 13h. Domingo e segunda fechados.</p>
      <div className="grid gap-4 lg:grid-cols-3">
        {DEMO_PROFESSIONALS.map((person) => (
          <article key={person.id} className="agende-panel rounded-[1.5rem] p-5 ring-1 ring-[#f0e4de]">
            <div className="flex items-center gap-3">
              <PersonMark name={person.displayName} photoUrl={null} />
              <div>
                <h2 className="font-serif text-2xl text-wine-deep">{person.displayName}</h2>
                <p className="text-sm text-muted-foreground">{person.role === "owner" ? "Dono" : "Profissional"} · Ativo</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{person.bio}</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {person.serviceIds.map((id) => <li key={id} className="rounded-full bg-metric-blush px-3 py-1 text-xs font-medium text-wine-deep">{serviceById(id)?.name}</li>)}
            </ul>
          </article>
        ))}
      </div>
    </>
  );
}
