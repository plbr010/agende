import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";

export default function PublicProfileNotFound() {
  return (
    <div className="agende-bloom flex min-h-full flex-col items-center justify-center px-4 py-16 text-center">
      <BrandLogo />
      <h1 className="mt-8 font-serif text-3xl">Este estabelecimento não está público</h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        O endereço pode estar errado ou o salão ainda não existe no Agendê.
      </p>
      <Link href="/" className="mt-6 underline underline-offset-4">
        Voltar ao Agendê
      </Link>
    </div>
  );
}
