import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BookingUnavailableNotice } from "@/components/booking/booking-unavailable";
import { PublicBookingFlow } from "@/components/booking/public-booking-flow";
import { loadPublicBookingCatalogResult } from "@/lib/booking/queries";
import { loadAppSession } from "@/lib/auth/session";
import { loadPublicWorkspaceProfile } from "@/lib/workspace/queries";
import { todayInTimeZone } from "@/lib/time/timezone";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ servico?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const profile = await loadPublicWorkspaceProfile(slug);
  return {
    title: profile ? `Agendar · ${profile.name}` : "Agendar",
  };
}

export default async function PublicBookingPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { servico } = await searchParams;
  const [{ catalog, unavailable, notFound: catalogMissing }, profile] = await Promise.all([
    loadPublicBookingCatalogResult(slug),
    loadPublicWorkspaceProfile(slug),
  ]);

  if (unavailable) {
    return <BookingUnavailableNotice workspaceName={profile?.name ?? null} slug={slug} />;
  }

  if (!catalog || catalogMissing) {
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
