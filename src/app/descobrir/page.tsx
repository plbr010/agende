import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { LocationDiscovery } from "@/components/discovery/location-discovery";
import { MarketingShell } from "@/components/marketing/shell";
import { searchPublicWorkspacesAction } from "@/lib/discovery/actions";
import { DISCOVERY_COPY, discoverySearchBlockedReason } from "@/lib/discovery/contract";
import { discoveryInputFromUrl, discoveryStateFromQuery } from "@/lib/discovery/url";

export const metadata: Metadata = {
  title: "Encontrar um salão",
  description:
    "Procure estabelecimentos do Agendê perto de você, em qualquer cidade ou pelo nome. A busca não fica limitada à cidade onde você mora.",
};

export default async function DescobrirPage({
  searchParams,
}: {
  searchParams: Promise<{ modo?: string | string[]; cidade?: string | string[]; uf?: string | string[]; q?: string | string[] }>;
}) {
  const query = discoveryStateFromQuery(await searchParams);
  const input = discoveryInputFromUrl(query);
  const initialResult = discoverySearchBlockedReason(input) ? null : await searchPublicWorkspacesAction(input);
  return (
    <MarketingShell>
      <main id="conteudo" className="mx-auto grid w-full min-w-0 max-w-3xl flex-1 gap-6 px-4 py-10 sm:py-14">
        <header className="grid gap-3">
          <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-wine-deep uppercase">
            <MapPin className="size-3.5" aria-hidden="true" />
            Qualquer cidade
          </p>
          <h1 className="font-serif text-4xl leading-tight text-wine-deep sm:text-5xl">{DISCOVERY_COPY.title}</h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">{DISCOVERY_COPY.description}</p>
        </header>
        <LocationDiscovery initialQuery={query} initialResult={initialResult} />
      </main>
    </MarketingShell>
  );
}
