"use client";

import { useState } from "react";
import { BrandLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { claimPlatformAdminAction } from "@/lib/admin/actions";

export function AdminProvisionPanel({ email }: { email: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-app-canvas px-4 py-10">
      <div className="w-full max-w-md rounded-[2rem] bg-card p-7 ring-1 ring-primary/10">
        <BrandLogo size="md" href="/admin" />
        <p className="mt-5 text-xs font-semibold tracking-[0.18em] text-wine-deep uppercase">Acesso master</p>
        <h1 className="mt-2 font-serif text-3xl text-wine-deep">Ativar painel administrativo</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          A identidade autenticada de <strong>{email}</strong> será gravada como master no banco, pelo UUID do Auth, fora do perfil editável. Nenhuma senha é alterada.
        </p>
        <form
          className="mt-6"
          action={async () => {
            setPending(true);
            setError(null);
            const result = await claimPlatformAdminAction();
            setPending(false);
            if (result?.error) setError(result.error);
          }}
        >
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Ativando…" : "Ativar meu acesso master"}
          </Button>
        </form>
        {error ? <p role="alert" className="mt-4 text-sm text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}
