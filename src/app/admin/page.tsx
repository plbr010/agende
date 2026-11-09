import { SalonDirectory, type SalonSearch } from "@/components/admin/salon-directory";
import { requireReadyPlatformAdmin } from "@/lib/admin/guard";
export default async function Page({ searchParams }: { searchParams: Promise<SalonSearch> }) {
  await requireReadyPlatformAdmin("/admin");
  return <SalonDirectory path="/admin" params={await searchParams} overview />;
}
