import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingHeader } from "@/components/marketing/header";

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="agende-bloom flex min-h-full flex-col">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-background focus:px-4 focus:py-2"
      >
        Ir para o conteúdo
      </a>
      <MarketingHeader />
      {children}
      <MarketingFooter />
    </div>
  );
}
