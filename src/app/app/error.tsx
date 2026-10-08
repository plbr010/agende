"use client";

import { RouteError } from "@/components/layout/route-status";

export default function AppError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <RouteError
      retry={retry}
      title="A área profissional teve um imprevisto"
      description="Nada foi alterado no seu negócio. Atualize a página para continuar de onde parou."
    />
  );
}
