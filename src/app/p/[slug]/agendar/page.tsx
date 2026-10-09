import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PublicBookingFlow } from "@/components/booking/public-booking-flow";
import { loadPublicBookingCatalog } from "@/lib/booking/queries";
import { loadAppSession } from "@/lib/auth/session";
import { todayInTimeZone } from "@/lib/time/timezone";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ servico?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const catalog = await loadPublicBookingCatalog(slug);
  return {
    title: catalog ? `Agendar · ${catalog.name}` : "Agendar",
  };
}

export default async function PublicBookingPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { servico } = await searchParams;
  const catalog = await loadPublicBookingCatalog(slug);
  if (!catalog) {
    notFound();
  }
  const session = await loadAppSession();
  const initialServiceId =
    typeof servico === "string" && catalog.services.some((service) => service.id === servico)
      ? servico
      : null;
  return (
    <PublicBookingFlow
      catalog={catalog}
      today={todayInTimeZone(catalog.timezone)}
      initialServiceId={initialServiceId}
      hasClientProfile={session?.context.hasClientProfile ?? false}
      prefill={{
        fullName: session?.profile.fullName ?? "",
        phone: session?.profile.phone ?? "",
        email: session?.profile.email ?? session?.user.email ?? "",
      }}
    />
  );
}
