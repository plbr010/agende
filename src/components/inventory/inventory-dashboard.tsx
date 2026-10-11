"use client";
import { useState } from "react";
import type { InventorySnapshot, InventoryProduct } from "@/lib/inventory/queries";
import { formatCentsInput, formatCentsToReais } from "@/lib/validation/money";
import { ManagementForm, Field, SelectField, ActionPanel } from "@/components/modules/management-form";
function ProductFields({ product }: {
    product?: InventoryProduct;
}) {
    return <>
    <Field label="Nome do produto" name="name" value={product?.name}/>
    <Field label="Descrição" name="description" value={product?.description ?? ""} required={false}/>
    <Field label="Código do produto (opcional)" name="sku" value={product?.sku ?? ""} required={false}/>
    <SelectField label="Unidade" name="unit" value={product?.unit ?? "unidade"}>
    <option value="unidade">Unidade</option>
    <option value="ml">ml</option>
    <option value="g">g</option>
    </SelectField>
    <Field label="Estoque mínimo" name="minimum" type="number" min={0} step="0.001" value={product?.minimumQuantity ?? 0}/>
    <Field label="Custo por unidade (R$)" name="cost" value={product?.costCents == null ? "" : formatCentsInput(product.costCents)} required={false}/>{product ? <input type="hidden" name="active" value={String(product.active)}/> : <Field label="Quantidade inicial" name="quantity" type="number" min={0} step="0.001" value={0}/>}</>;
}
export function InventoryDashboard({ timezone, snapshot }: {
    timezone: string;
    snapshot: InventorySnapshot | null;
}) {
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("all");
    if (!snapshot)
        return <p className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive" role="alert">Não foi possível carregar o estoque. Atualize a página para tentar novamente.</p>;
    const products = snapshot.products.filter(p => p.name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")) && (filter === "archived" ? !!p.archivedAt : !p.archivedAt && (filter === "all" || (filter === "low" ? p.quantity > 0 && p.quantity <= p.minimumQuantity : p.quantity === 0))));
    return <div className="grid gap-5">
    <div className="grid gap-3 sm:grid-cols-3">{[["Produtos", snapshot.summary.products], ["Estoque baixo", snapshot.summary.lowStock], ["Custo em estoque", formatCentsToReais(snapshot.summary.estimatedCostCents)]].map(([label, value]) => <div className="rounded-2xl border bg-card p-5" key={label}>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-serif text-3xl">{value}</p>
        </div>)}</div>
 <ActionPanel title="+ Novo produto">
    <ManagementForm action="product-create" label="Criar produto">
    <ProductFields />
    </ManagementForm>
    </ActionPanel>
 <div className="grid gap-3 sm:grid-cols-2">
    <label className="grid gap-1 text-sm">Buscar produto<input className="h-11 rounded-xl border border-input bg-background px-3" value={search} onChange={e => setSearch(e.target.value)} placeholder="Nome do produto"/>
    </label>
    <label className="grid gap-1 text-sm">Exibir<select className="h-11 rounded-xl border border-input bg-background px-3" value={filter} onChange={e => setFilter(e.target.value)}>
    <option value="all">Todos</option>
    <option value="low">Estoque baixo</option>
    <option value="zero">Sem estoque</option>
    <option value="archived">Arquivados</option>
    </select>
    </label>
    </div>
 {products.length === 0 && <p className="rounded-2xl bg-secondary p-5">Nenhum produto encontrado. Cadastre seu primeiro produto ou ajuste a busca.</p>}
 <div className="grid gap-4 lg:grid-cols-2">{products.map(p => <article key={p.id} className="grid content-start gap-3 rounded-2xl border bg-card p-5">
        <h2 className="text-lg font-semibold">{p.name}</h2>
        <p>{p.quantity} {p.unit} · Mínimo {p.minimumQuantity} · <strong>{p.archivedAt ? "Arquivado" : p.quantity === 0 ? "Sem estoque" : p.quantity <= p.minimumQuantity ? "Baixo" : "Normal"}</strong>
        </p>
        <p className="text-sm text-muted-foreground">{p.costCents === null ? "Custo não informado" : formatCentsToReais(p.costCents)}</p>
 {p.archivedAt ? <ManagementForm action="product-reactivate" id={p.id} label="Reativar produto"/> : <>
            <ActionPanel title="Registrar entrada, saída ou correção">
            <ManagementForm action="movement" id={p.id} label="Salvar no estoque">
            <SelectField name="type" label="O que aconteceu">
            <option value="entry">Chegou produto</option>
            <option value="exit">Saiu produto</option>
            <option value="adjustment">Corrigir a quantidade</option>
            </SelectField>
            <Field name="quantity" label="Quantidade" type="number" min={0} step="0.001"/>
            <p className="text-sm text-muted-foreground">Se for correção, escreva quanto deve ficar no estoque.</p>
            <Field name="reason" label="Motivo"/>
            </ManagementForm>
            </ActionPanel>
            <ActionPanel title="Editar produto">
            <ManagementForm action="product-update" id={p.id} label="Salvar produto">
            <ProductFields product={p}/>
            </ManagementForm>
            </ActionPanel>
            <ManagementForm action="product-archive" id={p.id} label="Arquivar" confirm={"Arquivar " + p.name + "? Ele some da lista, mas o histórico continua."}/>
            </>}
 </article>)}</div>
    <section className="rounded-2xl border bg-card p-5">
    <h2 className="mb-4 text-xl font-semibold">Histórico recente</h2>{!snapshot.recentMovements.length && <p>As entradas, saídas e ajustes aparecerão aqui.</p>}{snapshot.recentMovements.map(m => <div key={m.id} className="flex justify-between gap-4 border-b py-3">
        <div>
        <p>{m.productName} · {m.label}</p>
        <p className="text-xs text-muted-foreground">{new Date(m.occurredAt).toLocaleString("pt-BR", { timeZone: timezone })} · {m.note}</p>
        </div>
        <strong>{m.quantityDelta > 0 ? "+" : ""}{m.quantityDelta}</strong>
        </div>)}</section>
    </div>;
}
