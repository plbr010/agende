import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="agende-bloom flex min-h-full flex-col px-4 py-8">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
        <BrandLogo className="mb-8 block" />
        <div className="flex-1">{children}</div>
        <footer className="mt-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <Link href="/termos" className="min-h-11 py-2 underline-offset-4 hover:underline">
            Termos
          </Link>
          <Link href="/privacidade" className="min-h-11 py-2 underline-offset-4 hover:underline">
            Privacidade
          </Link>
          <Link href="/" className="min-h-11 py-2 underline-offset-4 hover:underline">
            Página inicial
          </Link>
        </footer>
      </div>
    </div>
  );
}
