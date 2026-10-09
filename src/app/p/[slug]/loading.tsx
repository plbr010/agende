import { PageLoading } from "@/components/layout/route-status";

export default function PublicProfileLoading() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <PageLoading label="Carregando o perfil público" />
    </div>
  );
}
