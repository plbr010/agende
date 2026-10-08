import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";
import { WorkspaceFinder } from "@/components/client/workspace-finder";

export default function PublicProfileNotFound() {
  return (
    <div className="agende-bloom flex min-h-full flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md space-y-6 text-center">
        <BrandLogo className="mx-auto" />
        <div>
          <h1 className="font-serif text-3xl">Este estabelecimento não está público</h1>
          <p className="mt-2 text-muted-foreground">
            O endereço pode estar errado, o salão ainda não existe no Agendê, ou a página pública não foi ativada.
          </p>
        </div>
        <WorkspaceFinder />
        <p className="text-sm">
          <Link href="/" className="underline underline-offset-4">
            Voltar ao Agendê
          </Link>
        </p>
      </div>
    </div>
  );
}
