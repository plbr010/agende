import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PublicWorkspacePage } from "@/components/workspace/public-profile";
import { loadAppSession } from "@/lib/auth/session";
import { loadPublicBookingCatalogResult } from "@/lib/booking/queries";
import { loadWorkspaceFavorites } from "@/lib/client/favorite-actions";
import { favoritesViewFromLoad } from "@/lib/client/favorites";
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
  const [profile, booking, session] = await Promise.all([
    loadPublicWorkspaceProfile(slug),
    loadPublicBookingCatalogResult(slug),
    loadAppSession(),
  ]);
  if (!profile) {
    notFound();
  }
  const canSave = Boolean(session?.context.emailConfirmed && session.context.hasClientProfile);
  const saved = canSave
    ? favoritesViewFromLoad(await loadWorkspaceFavorites()).items.find((item) => item.slug === profile.slug)
    : undefined;
  return (
    <PublicWorkspacePage
      profile={profile}
      bookingOpen={!booking.unavailable && Boolean(booking.catalog)}
      favorite={canSave ? { workspaceId: saved?.workspaceId ?? profile.workspaceId, saved: Boolean(saved) } : null}
    />
  );
}
