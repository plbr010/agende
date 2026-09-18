import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PublicBookingFlow } from "@/components/booking/public-booking-flow";
import { loadPublicBookingCatalog } from "@/lib/booking/queries";
import { loadAppSession } from "@/lib/auth/session";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const catalog = await loadPublicBookingCatalog(slug);
  return {
    title: catalog ? `Agendar · ${catalog.name}` : "Agendar",
  };
}

export default async function PublicBookingPage({ params }: PageProps) {
  const { slug } = await params;
  const catalog = await loadPublicBookingCatalog(slug);
  if (!catalog) {
    notFound();
  }
  const session = await loadAppSession();
  return (
    <PublicBookingFlow
      catalog={catalog}
      prefill={{
        fullName: session?.profile.fullName ?? "",
        phone: session?.profile.phone ?? "",
        email: session?.profile.email ?? session?.user.email ?? "",
      }}
    />
  );
}
