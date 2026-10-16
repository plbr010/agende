import type { Metadata } from "next";
import Link from "next/link";
import { Clock3, Sparkles, WalletCards, WandSparkles } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/app/metric-card";
import { ServiceCatalog } from "@/components/catalog/directories";
import type { ServiceRow, TeamMember } from "@/lib/catalog/queries";
import { formatCentsToReais } from "@/lib/validation/money";

export const metadata: Metadata = {
  title: "Prévia da gestão de serviços",
  robots: { index: false, follow: false },
};

const professionals: TeamMember[] = [
  {
    memberId: "ana",
    userId: "user-ana",
    role: "owner",
    status: "active",
    fullName: "Ana Carolina",
    email: "ana@example.com",
    displayName: "Ana",
    bio: null,
    bookingEnabled: true,
    hasProfessionalProfile: true,
    serviceCount: 2,
    joinedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    memberId: "camila",
    userId: "user-camila",
    role: "professional",
    status: "active",
    fullName: "Camila Souza",
    email: "camila@example.com",
    displayName: "Camila",
    bio: null,
    bookingEnabled: true,
    hasProfessionalProfile: true,
    serviceCount: 1,
    joinedAt: "2026-02-01T00:00:00.000Z",
  },
];

const services: ServiceRow[] = [
  {
    id: "manicure",
    name: "Manicure",
    description: "Cuidado das unhas e esmaltação.",
    durationMinutes: 60,
    priceCents: 7000,
    active: true,
    archivedAt: null,
    professionalMemberIds: ["ana", "camila"],
  },
  {
    id: "escova",
    name: "Escova",
    description: "Escova modelada, sem química.",
    durationMinutes: 45,
    priceCents: 9000,
    active: true,
    archivedAt: null,
    professionalMemberIds: ["ana"],
  },
  {
    id: "cor",
    name: "Coloração",
    description: "Aplicação e tempo de pausa.",
    durationMinutes: 120,
    priceCents: 22000,
    active: false,
    archivedAt: null,
    professionalMemberIds: [],
  },
];

export default function ServicesPreviewPage() {
  const active = services.filter((service) => service.active);
  const averagePrice = Math.round(active.reduce((sum, service) => sum + service.priceCents, 0) / active.length);
  const averageDuration = Math.round(active.reduce((sum, service) => sum + service.durationMinutes, 0) / active.length);

  return (
    <>
      <p className="bg-wine-deep px-4 py-3 text-center text-sm text-white">
        Prévia visual para aprovação — dados ilustrativos, não é um salão real.{" "}
        <Link href="/identidade/salao" className="underline underline-offset-4">
          Ver a página do salão
        </Link>
      </p>
      <AppShell workspaceName="Studio Beleza" workspaceSlug="studio-beleza" userName="Ana Carolina" roleLabel="Proprietária" role="owner">
        <PageHeader
          eyebrow="O que você oferece"
          title="Serviços"
          description="O que você oferece, quanto tempo dura e o preço."
          icon={WandSparkles}
        />
        <section className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo de serviços">
          <MetricCard label="Serviços" value={services.length} hint="serviços cadastrados" icon={Sparkles} />
          <MetricCard label="Ativos" value={active.length} hint="disponíveis para agenda" icon={WandSparkles} tone="success" />
          <MetricCard label="Preço médio" value={formatCentsToReais(averagePrice)} hint="entre serviços ativos" icon={WalletCards} tone="warning" />
          <MetricCard label="Duração média" value={`${averageDuration} min`} hint="tempo por atendimento" icon={Clock3} tone="neutral" />
        </section>
        <ServiceCatalog services={services} professionals={professionals} canManage currentMemberId={null} />
      </AppShell>
    </>
  );
}
