import type { Metadata } from "next";
import Link from "next/link";
import { PublicWorkspacePage } from "@/components/workspace/public-profile";
import { parsePublicWorkspaceProfile } from "@/lib/workspace/public";

export const metadata: Metadata = {
  title: "Prévia da página do salão",
  robots: { index: false, follow: false },
};

const parsed = parsePublicWorkspaceProfile({
  name: "Studio Beleza",
  slug: "studio-beleza",
  description: "Cuidado com hora marcada, em um espaço calmo.",
  address: "Rua das Flores, 120",
  city: "Juiz de Fora",
  state: "MG",
  instagram: "studiobeleza",
  services: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Manicure",
      description: "Cuidado das unhas e esmaltação.",
      duration_minutes: 60,
      price_cents: 7000,
      min_price_cents: 7000,
      max_price_cents: 7000,
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Escova",
      description: "Escova modelada.",
      duration_minutes: 45,
      price_cents: 9000,
      min_price_cents: 8000,
      max_price_cents: 12000,
    },
  ],
  professionals: [
    { id: "33333333-3333-4333-8333-333333333333", display_name: "Ana Carolina", bio: "Atendimento com hora marcada.", services: ["Manicure", "Escova"] },
    { id: "44444444-4444-4444-8444-444444444444", display_name: "Camila", bio: null, services: ["Manicure"] },
  ],
});

export default function SalonPreviewPage() {
  if (!parsed) return null;
  return (
    <>
      <p className="bg-wine-deep px-4 py-3 text-center text-sm text-white">
        Prévia visual para aprovação — dados ilustrativos, não é um salão real. Esta prévia não publica foto nem avaliação.{" "}
        <Link href="/identidade/servicos" className="underline underline-offset-4">
          Ver a gestão de serviços
        </Link>
      </p>
      <PublicWorkspacePage profile={{ ...parsed, coverUrl: null }} bookingOpen />
    </>
  );
}
