import { SalonDirectory, type SalonSearch } from "@/components/admin/salon-directory";
import { requireReadyPlatformAdmin } from "@/lib/admin/guard";
import { redirect } from "next/navigation";
import { withParams } from "@/lib/admin/params";
export default async function Page({ searchParams }: { searchParams: Promise<SalonSearch & { plan?: string }> }) {
  await requireReadyPlatformAdmin("/admin/estabelecimentos");
  const params = await searchParams;
  if (params.plan || ["active", "trialing", "past_due", "expired", "held"].includes(params.status ?? "")) {
    redirect(withParams("/admin/estabelecimentos/gestao", params));
  }
  return <SalonDirectory path="/admin/estabelecimentos" params={params} />;
}
