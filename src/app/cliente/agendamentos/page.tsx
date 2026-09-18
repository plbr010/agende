import Link from "next/link";
import { requireConfirmedSession } from "@/lib/auth/session";
import { signOutAction } from "@/lib/auth/actions";
import { BrandLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ClientAppointments } from "@/components/booking/client-appointments";
import { loadMyAppointments } from "@/lib/booking/queries";

export default async function ClienteAgendamentosPage() {
  const session = await requireConfirmedSession("/cliente/agendamentos");
  const appointments = await loadMyAppointments();

  return (
    <div className="agende-bloom min-h-full">
      <header className="border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-lg items-center justify-between px-4">
          <BrandLogo size="sm" />
          <form action={signOutAction}>
            <Button variant="ghost" type="submit">
              Sair
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-lg gap-6 px-4 py-8">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/cliente" className="underline-offset-4 hover:underline">
              Área do cliente
            </Link>
          </p>
          <h1 className="font-serif text-3xl">Meus agendamentos</h1>
          <p className="mt-2 text-muted-foreground">Olá, {session.profile.fullName}. Só você vê estes horários.</p>
        </div>
        <ClientAppointments initial={appointments} />
      </main>
    </div>
  );
}
