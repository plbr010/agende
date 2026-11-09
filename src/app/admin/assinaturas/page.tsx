import { SalonDirectory, type SalonSearch } from "@/components/admin/salon-directory";
import { requireReadyPlatformAdmin } from "@/lib/admin/guard";
import { redirect } from "next/navigation";
import { withParams } from "@/lib/admin/params";
export default async function Page({ searchParams }: { searchParams: Promise<SalonSearch & { cobrancas?: string; plan?: string; kind?: string }> }) {
  await requireReadyPlatformAdmin("/admin/assinaturas");
  const params = await searchParams;
  if (params.cobrancas || params.plan || params.kind || ["active", "trialing", "past_due", "expired"].includes(params.status ?? "")) {
    redirect(withParams("/admin/assinaturas/historico", params));
  }
  return <SalonDirectory path="/admin/assinaturas" params={params} title="Assinaturas" />;
}
