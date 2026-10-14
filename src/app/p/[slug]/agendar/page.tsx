import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BookingUnavailableNotice } from "@/components/booking/booking-unavailable";
import { PublicBookingFlow } from "@/components/booking/public-booking-flow";
import { loadPublicBookingCatalogResult } from "@/lib/booking/queries";
import { loadAppSession } from "@/lib/auth/session";
import { loadPublicWorkspaceProfile } from "@/lib/workspace/queries";
import { todayInTimeZone } from "@/lib/time/timezone";
import { cookies } from "next/headers";
import { BOOKING_DRAFT_COOKIE, decodeBookingDraft } from "@/lib/booking/draft";
import { fetchPublicSlotsAction } from "@/lib/booking/actions";

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
  let draft = session?.user.emailConfirmed ? decodeBookingDraft((await cookies()).get(BOOKING_DRAFT_COOKIE)?.value, slug) : null;
  const resumedServiceId = draft?.serviceId ?? null;
  let draftSlotUnavailable = false;
  if (draft) {
    const selection = draft;
    const serviceExists = catalog.services.some(s => s.id === selection.serviceId);
    const professionalExists = selection.professionalMemberId === null || catalog.professionals.some(p =>
      p.id === selection.professionalMemberId && p.serviceIds.includes(selection.serviceId));
    if (!serviceExists || !professionalExists) draft = null;
    else {
      const slots = await fetchPublicSlotsAction(selection);
      draftSlotUnavailable = !slots.slots.some(s => Date.parse(s) === Date.parse(selection.startsAt));
    }
  }
  const initialServiceId =
    catalog.services.some((service) => service.id === (resumedServiceId ?? servico))
      ? resumedServiceId ?? servico ?? null
      : null;
  return (
    <PublicBookingFlow
      catalog={catalog}
      today={todayInTimeZone(catalog.timezone)}
      initialServiceId={initialServiceId}
      initialDraft={draft}
      initialDraftSlotUnavailable={draftSlotUnavailable}
      authenticated={session?.user.emailConfirmed ?? false}
      hasClientProfile={session?.context.hasClientProfile ?? false}
      prefill={{
        fullName: session?.profile.fullName ?? "",
        phone: session?.profile.phone ?? "",
        email: session?.profile.email ?? session?.user.email ?? "",
      }}
    />
  );
}
