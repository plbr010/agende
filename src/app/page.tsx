import Link from "next/link";
import { CalendarHeart, Sparkles, Users } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/layout/site-chrome";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const plans = [
  {
    name: "Solo",
    price: "R$ 89,90",
    detail: "Até 1 profissional",
  },
  {
    name: "Equipe",
    price: "R$ 169,90",
    detail: "Até 5 profissionais",
    featured: true,
  },
  {
    name: "Salão",
    price: "R$ 299,90",
    detail: "Até 15 profissionais",
  },
];

export default function HomePage() {
  return (
    <div className="agende-bloom flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-16 px-4 py-10 sm:py-16">
        <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="max-w-xl space-y-6">
            <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
              Beauty tech, no seu ritmo
            </p>
            <h1 className="font-serif text-4xl leading-[1.1] text-foreground sm:text-5xl lg:text-6xl">
              A agenda da sua beleza, com a calma que o seu tempo merece.
            </h1>
            <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
              O Agendê é para profissionais da beleza e para clientes que querem
              marcar horário sem fricção. Elegante, simples e feito para o celular.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button className="h-12 px-6 text-base" render={<Link href="/cadastro" />}>
                Começar agora
              </Button>
              <Button variant="outline" className="h-12 px-6 text-base" render={<Link href="/login" />}>
                Entrar
              </Button>
            </div>
          </div>
          <div className="grid gap-4">
            <Card className="border-none bg-card/90 shadow-none ring-1 ring-border">
              <CardHeader>
                <Badge variant="secondary">Sou cliente</Badge>
                <CardTitle className="font-serif text-2xl">Encontre e agende</CardTitle>
                <CardDescription>
                  Quero encontrar profissionais e agendar meus horários.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-none bg-card/90 shadow-none ring-1 ring-border">
              <CardHeader>
                <Badge variant="secondary">Sou profissional</Badge>
                <CardTitle className="font-serif text-2xl">Organize o negócio</CardTitle>
                <CardDescription>
                  Quero organizar minha agenda e gerenciar meu negócio.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: CalendarHeart,
              title: "Agenda no celular",
              text: "Feito primeiro para o telefone, com telas limpas e toque fácil.",
            },
            {
              icon: Sparkles,
              title: "Presença sofisticada",
              text: "Uma identidade visual pensada para estúdios, salões e autônomas.",
            },
            {
              icon: Users,
              title: "Cliente e profissional",
              text: "A mesma pessoa pode viver os dois lados, com contas e permissões certas.",
            },
          ].map((item) => (
            <Card key={item.title} className="border-none bg-card/80 ring-1 ring-border">
              <CardHeader>
                <item.icon className="size-5 text-primary" />
                <CardTitle>{item.title}</CardTitle>
                <CardDescription>{item.text}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>

        <section className="space-y-6">
          <div className="max-w-xl space-y-2">
            <h2 className="font-serif text-3xl">Planos preparados</h2>
            <p className="text-muted-foreground">
              A cobrança ainda não está ativa. Os limites de profissionais já
              existem no banco, para não depender só da interface.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={
                  plan.featured
                    ? "border-none bg-primary text-primary-foreground ring-1 ring-primary"
                    : "border-none bg-card ring-1 ring-border"
                }
              >
                <CardHeader>
                  <CardTitle className="font-serif text-2xl">{plan.name}</CardTitle>
                  <p className="text-3xl font-medium">{plan.price}<span className="text-base opacity-80">/mês</span></p>
                  <CardDescription className={plan.featured ? "text-primary-foreground/80" : undefined}>
                    {plan.detail}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm opacity-80">Pagamento em breve. Trial de 7 dias para o primeiro negócio.</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
