import Link from "next/link";
import { CalendarHeart, Scissors, Store } from "lucide-react";
import { FloralCorner, FloralSprig } from "@/components/brand/floral";
import { buttonVariants } from "@/components/ui/button";
import { signupChoiceHref, type SignupJourney } from "@/lib/auth/signup-journey";
import { cn } from "@/lib/utils";

const choices: Array<{
  journey: SignupJourney;
  title: string;
  body: string;
  note: string;
  action: string;
  icon: typeof CalendarHeart;
  tone: string;
}> = [
  {
    journey: "client",
    title: "Quero agendar serviços",
    body: "Para encontrar salões, ver os serviços e marcar um horário.",
    note: "Sem salão e sem mensalidade.",
    action: "Criar conta de cliente",
    icon: CalendarHeart,
    tone: "bg-metric-blush",
  },
  {
    journey: "owner",
    title: "Tenho meu próprio salão",
    body: "Para quem administra o próprio espaço e quer a agenda no mesmo lugar.",
    note: "Depois do e-mail, você escolhe o plano e testa por 7 dias, sem cartão.",
    action: "Começar como dono",
    icon: Store,
    tone: "bg-white",
  },
  {
    journey: "team",
    title: "Trabalho em um salão parceiro",
    body: "Para profissionais, recepção e outras pessoas convidadas pela equipe.",
    note: "Você não paga assinatura. O acesso começa só depois de aceitar o convite.",
    action: "Entrar com convite",
    icon: Scissors,
    tone: "bg-metric-ivory",
  },
];

export function SignupChooser({
  next,
  plan,
}: {
  next?: string | null;
  plan?: string | null;
}) {
  const inviteNext = next?.startsWith("/convite/") ? next : null;
  const returnNext = next && !inviteNext ? next : null;

  return (
    <section className="relative isolate">
      <FloralCorner className="pointer-events-none absolute -top-6 -left-8 z-0 h-24 w-32 opacity-70" />
      <FloralSprig className="pointer-events-none absolute -right-4 -bottom-8 z-0 h-28 w-16 opacity-70" />
      <div className="relative z-10 space-y-6">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.16em] text-wine-deep uppercase">Criar conta</p>
          <h1 className="mt-2 font-serif text-4xl leading-tight text-wine-deep sm:text-5xl">Como você quer usar o Agendê?</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            Escolha uma opção. Dá para voltar e trocar antes de criar a conta.
          </p>
        </div>
        {inviteNext ? (
          <p role="status" className="rounded-[1.25rem] bg-metric-blush px-4 py-3 text-sm leading-6">
            Este endereço já tem um convite. A opção da equipe guarda o link para você não precisar colar de novo.
          </p>
        ) : null}
        <div className="grid gap-4 lg:grid-cols-3">
          {choices.map((choice) => {
            const Icon = choice.icon;
            const href = signupChoiceHref(choice.journey, {
              next: choice.journey === "team" ? inviteNext : returnNext,
              plan: choice.journey === "owner" ? plan : null,
            });
            return (
              <Link
                key={choice.journey}
                href={href}
                className={cn(
                  "group flex min-h-72 flex-col rounded-[1.8rem] p-6 shadow-[0_24px_48px_-32px_rgb(92_26_46/0.45)] ring-1 ring-[#f0e4de] transition hover:-translate-y-0.5",
                  choice.tone,
                )}
              >
                <span className="grid size-12 place-items-center rounded-full bg-white text-wine-deep ring-1 ring-[#f0e4de]">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h2 className="mt-5 font-serif text-3xl leading-tight text-wine-deep">{choice.title}</h2>
                <p className="mt-3 text-base leading-7 text-muted-foreground">{choice.body}</p>
                <p className="mt-3 text-sm font-medium leading-6 text-wine-deep">{choice.note}</p>
                <span className={cn(buttonVariants({ size: "lg" }), "mt-auto w-full group-hover:bg-[var(--rose-ink)]")}>
                  {choice.action}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
