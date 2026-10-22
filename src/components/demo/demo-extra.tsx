"use client";

import Link from "next/link";
import { MessageCircleHeart, Settings2, Star } from "lucide-react";
import { MetricCard } from "@/components/app/metric-card";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useDemo } from "@/components/demo/demo-provider";
import { TRIAL_COPY } from "@/lib/billing/plans";
import { PLANS } from "@/lib/marketing/content";
import { DEMO_NAME, DEMO_TIMEZONE } from "@/lib/demo/catalog";
import { DEMO_CLIENT_HREF, DEMO_PLANS_HREF, DEMO_TRIAL_HREF } from "@/lib/demo/paths";
import { demoReviews } from "@/lib/demo/project";
import { formatDateTimeInTimeZone } from "@/lib/time/timezone";

export function DemoReviews() {
  const demo = useDemo();
  const reviews = demoReviews(demo.appointments);
  const average = reviews.length ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1).replace(".", ",") : "—";
  return (
    <>
      <PageHeader eyebrow="Sua equipe" title="Avaliações" description="Notas fictícias de atendimentos concluídos. Enviar avaliação fica com a cliente, depois do atendimento, e não é disparado daqui." icon={Star} />
      <section className="grid gap-4 sm:grid-cols-2" aria-label="Resumo das avaliações">
        <MetricCard label="Nota média" value={average} hint="somente atendimentos concluídos" icon={Star} />
        <MetricCard label="Avaliações" value={reviews.length} hint="visíveis para a equipe" icon={MessageCircleHeart} tone="neutral" />
      </section>
      <div className="grid gap-4">
        {reviews.map((review) => (
          <Card key={review.appointmentId} className="rounded-3xl border-border/70 bg-card/85 shadow-sm">
            <CardContent className="grid gap-2">
              <p className="font-medium text-wine-deep">{review.clientName} · {review.serviceName}</p>
              <p className="text-sm text-muted-foreground">{review.professionalName} · {formatDateTimeInTimeZone(review.createdAt, DEMO_TIMEZONE)}</p>
              <p aria-label={`Nota ${review.rating} de 5`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</p>
              {review.comment ? <p className="text-sm leading-6">{review.comment}</p> : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

export function DemoSettings() {
  const fields = [
    ["Nome do salão ou estúdio", DEMO_NAME],
    ["Telefone comercial", "(11) 90000-0000"],
    ["E-mail comercial", "contato@exemplo.agende.test"],
    ["Endereço", "Rua das Acácias, 120 — endereço fictício"],
    ["Cidade", "Cidade Demonstração"],
    ["Estado", "MG"],
    ["CEP", "00000-000"],
    ["Fuso horário", "America/Sao_Paulo"],
    ["Endereço do seu link", "/demo/cliente"],
    ["Descrição", "Estúdio fictício para experimentar o Agendê."],
    ["Instagram", "Não publicado"],
  ];
  return (
    <>
      <PageHeader eyebrow="Estabelecimento" title="Configurações" description="Dados do salão fictício. Nada daqui é salvo e nenhuma foto ou cobrança é enviada." icon={Settings2} />
      <section className="rounded-[1.8rem] bg-white p-6 ring-1 ring-[#f0e4de] sm:p-8">
        <h2 className="font-serif text-2xl text-wine-deep">Dados do salão</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">A edição fica desligada. No Agendê, quem administra altera estes campos em Configurações.</p>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="mt-1 break-words font-medium text-wine-deep">{value}</dd>
            </div>
          ))}
        </dl>
        <Button variant="outline" className="mt-5 h-11 rounded-full" render={<Link href={DEMO_CLIENT_HREF} />}>Ver a página pública</Button>
      </section>
      <section className="rounded-[1.8rem] bg-white p-6 ring-1 ring-[#f0e4de] sm:p-8">
        <h2 className="font-serif text-2xl text-wine-deep">Identidade</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Este estúdio não publica logo, capa nem fotos de pessoas. No Agendê, a capa aparece na página pública quando o salão envia uma imagem. A foto da conta não é pedida na demonstração.</p>
      </section>
      <section className="rounded-[1.8rem] bg-white p-6 ring-1 ring-[#f0e4de] sm:p-8">
        <h2 className="font-serif text-2xl text-wine-deep">Assinatura</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Este salão não tem assinatura. {TRIAL_COPY}</p>
        <p className="mt-2 text-sm text-muted-foreground">Planos disponíveis: {PLANS.map((plan) => plan.name).join(", ")}. Os preços ficam na página de planos.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button className="h-11 rounded-full" render={<Link href={DEMO_TRIAL_HREF} />}>Começar meu teste gratuito</Button>
          <Button variant="outline" className="h-11 rounded-full" render={<Link href={DEMO_PLANS_HREF} />}>Conhecer os planos</Button>
        </div>
      </section>
    </>
  );
}
