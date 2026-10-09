import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";
import { WorkspaceFinder } from "@/components/client/workspace-finder";

export function BookingUnavailableNotice({
  workspaceName,
  slug,
}: {
  workspaceName?: string | null;
  slug: string;
}) {
  return (
    <div className="agende-bloom flex min-h-full flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md space-y-6 text-center">
        <BrandLogo className="mx-auto" />
        <div>
          <h1 className="font-serif text-3xl">Agenda temporariamente indisponível</h1>
          <p className="mt-2 text-muted-foreground">
            {workspaceName
              ? `${workspaceName} está no Agendê, mas a agenda online não está aberta neste momento.`
              : "Este estabelecimento está no Agendê, mas a agenda online não está aberta neste momento."}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Se você é a profissional, renove o trial ou a assinatura do negócio para voltar a receber reservas.
          </p>
        </div>
        <div className="grid gap-3 text-sm">
          <Link href={`/p/${slug}`} className="underline underline-offset-4">
            Ver página pública
          </Link>
          <Link href="/" className="underline underline-offset-4">
            Voltar ao Agendê
          </Link>
        </div>
        <WorkspaceFinder />
      </div>
    </div>
  );
}
