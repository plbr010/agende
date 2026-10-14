"use client";

import { useActionState, useId } from "react";
import { setDiscoveryPublicationAction } from "@/lib/discovery/publication";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PortugueseForm } from "@/components/usability/portuguese-form";

export function DiscoveryPublicationForm({ enabled }: { enabled: boolean }) {
  const id = useId();
  const [state, action, pending] = useActionState(setDiscoveryPublicationAction, {});
  return (
    <Card className="border-none ring-1 ring-border">
      <CardHeader>
        <CardTitle>Aparecer na busca de salões</CardTitle>
        <CardDescription>
          Publique nome, cidade, descrição e profissionais do perfil público para clientes encontrarem seu salão.
          Contatos privados não aparecem na busca. Você pode retirar a publicação a qualquer momento.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PortugueseForm action={action} className="grid gap-4" key={String(enabled)}>
          <label htmlFor={id} className="flex min-h-11 items-center gap-3 text-sm leading-6">
            <input
              id={id}
              type="checkbox"
              name="enabled"
              defaultChecked={enabled}
              disabled={pending}
              className="size-5 shrink-0 rounded border-input"
            />
            Quero aparecer na busca pública
          </label>
          <Button disabled={pending} type="submit" className="h-12" aria-busy={pending}>
            {pending ? "Salvando..." : "Salvar publicação"}
          </Button>
          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p role="status" className="text-sm">
              {state.success}
            </p>
          ) : null}
        </PortugueseForm>
      </CardContent>
    </Card>
  );
}
