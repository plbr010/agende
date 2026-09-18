import { BrandLogo } from "@/components/brand/logo";
import { SiteFooter, SiteHeader } from "@/components/layout/site-chrome";

export default function PrivacidadePage() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <BrandLogo className="mb-6" />
        <h1 className="font-serif text-4xl">Política de Privacidade</h1>
        <div className="mt-6 space-y-4 text-muted-foreground">
          <p>
            O Agendê trata nome, e-mail, telefone e dados do negócio para autenticar
            usuários, criar workspaces e operar o produto.
          </p>
          <p>
            O e-mail é confirmado via Supabase Auth. O telefone é armazenado de forma
            normalizada e, nesta versão, não exige verificação por SMS.
          </p>
          <p>
            Não vendemos dados pessoais. Regras críticas de acesso ficam no banco, com
            Row Level Security, e não apenas na interface.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
