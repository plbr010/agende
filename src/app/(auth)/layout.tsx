import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";
import { FloralSprig } from "@/components/brand/floral";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="agende-bloom relative flex min-h-full flex-col overflow-hidden px-4 py-8">
      <FloralSprig className="pointer-events-none absolute -top-8 -left-8 h-48 w-28 opacity-70" />
      <FloralSprig className="pointer-events-none absolute right-0 bottom-0 h-40 w-24 rotate-180 opacity-60" />
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col">
        <div className="mb-8 flex items-center justify-between gap-3">
          <BrandLogo />
          <Link href="/" className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-4 hover:underline">
            Voltar ao início
          </Link>
        </div>
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
