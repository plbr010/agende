import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PublicWorkspacePage } from "@/components/workspace/public-profile";
import { loadPublicBookingCatalogResult } from "@/lib/booking/queries";
import { loadPublicWorkspaceProfile } from "@/lib/workspace/queries";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const profile = await loadPublicWorkspaceProfile(slug);
  if (!profile) {
    return { title: "Estabelecimento" };
  }
  return {
    title: profile.name,
    description: profile.description ?? `Conheça ${profile.name} no Agendê.`,
  };
}

export default async function PublicSlugPage({ params }: PageProps) {
  const { slug } = await params;
  const [profile, booking] = await Promise.all([
    loadPublicWorkspaceProfile(slug),
    loadPublicBookingCatalogResult(slug),
  ]);
  if (!profile) {
    notFound();
  }
  return <PublicWorkspacePage profile={profile} bookingOpen={!booking.unavailable && Boolean(booking.catalog)} />;
}
