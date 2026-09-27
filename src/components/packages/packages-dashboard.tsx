import type { PackagesSnapshot } from "@/lib/packages/queries";
import type { ServiceRow, ClientRow } from "@/lib/catalog/queries";
import { formatCentsToReais } from "@/lib/validation/money";
import { ManagementForm, Field, SelectField, ActionPanel } from "@/components/modules/management-form";
const statuses = { active: "Ativo", exhausted: "Esgotado", expired: "Expirado", cancelled: "Cancelado" };
export function PackagesDashboard({ snapshot, services, clients }: {
    snapshot: PackagesSnapshot | null;
    services: ServiceRow[];
    clients: ClientRow[];
}) {
    if (!snapshot)
        return <p>Não foi possível carregar os pacotes. Atualize a página para tentar novamente.</p>;
    const available = services.filter(s => s.active && !s.archivedAt);
    return <div className="grid gap-5">
    <ActionPanel title="+ Criar pacote">{available.length ? <ManagementForm action="package-create" label="Criar pacote">
        <Field name="name" label="Nome do pacote"/>
        <Field name="description" label="Descrição" required={false}/>
        <Field name="amount" label="Preço (R$)"/>
        <Field name="validity" label="Validade em dias (vazio para sem prazo)" type="number" min={1} max={3650} required={false}/>
        <fieldset className="grid gap-3">
        <legend>Serviços incluídos e sessões</legend>{available.map(s => <div key={s.id} className="grid gap-2 rounded-xl border p-3">
            <label>
            <input type="checkbox" name="service" value={s.id}/> {s.name}</label>
            <Field label="Quantidade de sessões" name={"sessions-" + s.id} type="number" min={1} max={100} value={1}/>
            </div>)}</fieldset>
        </ManagementForm> : <p>Cadastre um serviço ativo em Serviços antes de criar seu pacote.</p>}</ActionPanel>
 <section className="grid gap-4 lg:grid-cols-2">{!snapshot.catalog.length && <p>Crie um pacote para oferecer uma sequência de cuidados aos seus clientes.</p>}{snapshot.catalog.map(p => <article key={p.id} className="grid content-start gap-3 rounded-2xl border bg-card p-5">
        <h2 className="text-xl font-semibold">{p.name}</h2>
        <p>{p.description}</p>
        <p className="font-medium">{formatCentsToReais(p.priceCents)} · {p.validityDays ? p.validityDays + " dias" : "Sem prazo de validade"}</p>
        <ul>{p.sessions.map(s => <li key={s.serviceId}>{s.serviceName} · {s.included} sessões</li>)}</ul>{p.active && !p.archivedAt && <ActionPanel title="Vender pacote">{clients.length ? <ManagementForm action="package-sell" id={p.id} label="Confirmar venda" confirm={"Confirmar venda de " + p.name + " por " + formatCentsToReais(p.priceCents) + "?"}>
                <SelectField name="client" label="Cliente">
                <option value="">Selecione o cliente</option>{clients.filter(c => !c.archivedAt).map(c => <option key={c.id} value={c.id}>{c.fullName}</option>)}</SelectField>
                <p className="text-sm">A venda registra o pacote do cliente e seu lançamento financeiro.</p>
                </ManagementForm> : <p>Cadastre um cliente antes de vender.</p>}</ActionPanel>}</article>)}</section>
 <section className="grid gap-3">
    <h2 className="text-xl font-semibold">Pacotes dos clientes</h2><p className="text-sm text-muted-foreground">Últimas 30 vendas.</p>{!snapshot.sales.length && <p>Nenhum pacote vendido. Escolha um pacote acima para registrar uma venda.</p>}{snapshot.sales.map(s => <article key={s.id} className="grid gap-2 rounded-2xl border bg-card p-5">
        <h3 className="font-semibold">{s.clientName} · {s.packageName}</h3>
        <p>{statuses[s.status]} · {s.usedTotal} usadas / {Math.max(0, s.includedTotal - s.usedTotal)} restantes</p>
        <p>{formatCentsToReais(s.priceCents)} · Validade: {s.expiresAt ? new Date(s.expiresAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "Sem prazo"}</p>{s.status === "active" && <ManagementForm action="package-cancel" id={s.id} label="Cancelar pacote" confirm="Solicitar cancelamento deste pacote? A operação será validada conforme o uso e a situação financeira."/>}</article>)}</section>
    </div>;
}
