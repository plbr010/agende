"use client";

import { RouteError } from "@/components/layout/route-status";

export default function ClienteError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <RouteError
      retry={retry}
      title="Não foi possível abrir sua área"
      description="Seus agendamentos continuam salvos. Tente novamente em instantes."
    />
  );
}
