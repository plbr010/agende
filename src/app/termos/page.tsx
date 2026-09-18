import { BrandLogo } from "@/components/brand/logo";
import { SiteFooter, SiteHeader } from "@/components/layout/site-chrome";

export default function TermosPage() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <BrandLogo className="mb-6" />
        <h1 className="font-serif text-4xl">Termos de Uso</h1>
        <div className="mt-6 space-y-4 text-muted-foreground">
          <p>
            Esta é a versão inicial dos Termos de Uso do Agendê. O serviço destina-se a
            profissionais da beleza e a clientes finais.
          </p>
          <p>
            Ao criar uma conta, você confirma que as informações fornecidas são suas e
            que o e-mail informado poderá ser usado para autenticação e comunicação
            essencial do produto.
          </p>
          <p>
            Dados de um negócio não devem ser acessados por outro. Assinaturas e trials
            pertencem ao workspace, não à pessoa física isoladamente.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
