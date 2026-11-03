import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { loadAppSession } from "@/lib/auth/session";
import { signOutAction } from "@/lib/auth/actions";
import { formatDateTime } from "@/lib/workspace/timezone";

export const metadata: Metadata = {
  title: "Conta suspensa",
  robots: { index: false, follow: false },
};

export default async function ContaSuspensaPage() {
  const session = await loadAppSession();
  if (!session) {
    redirect("/login?next=/conta-suspensa");
  }
  if (!session.context.emailConfirmed) {
    redirect("/verificar-email");
  }
  if (!session.hold.held) {
    redirect(session.context.isPlatformAdmin ? "/admin" : session.workspaces.length ? "/app" : "/cliente");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-app-canvas px-4 py-10">
      <div className="w-full max-w-lg rounded-[2rem] bg-card p-7 ring-1 ring-primary/10">
        <BrandLogo size="md" href="/" />
        <h1 className="mt-5 font-serif text-3xl text-wine-deep">Conta suspensa</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          O acesso profissional desta conta está bloqueado pela administração da plataforma. Nada foi apagado.
        </p>
        {session.hold.reason ? (
          <p className="mt-4 rounded-2xl bg-metric-blush px-4 py-3 text-sm leading-6 text-wine-deep">
            Motivo: {session.hold.reason}
            {session.hold.createdAt ? ` · ${formatDateTime(session.hold.createdAt)}` : ""}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-2">
          {session.context.hasClientProfile ? (
            <Button render={<Link href="/cliente" />}>Abrir área do cliente</Button>
          ) : null}
          <form action={signOutAction}>
            <Button type="submit" variant="outline">Sair</Button>
          </form>
        </div>
      </div>
    </div>
  );
}
