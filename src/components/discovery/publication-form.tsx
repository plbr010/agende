"use client";

import { useActionState, useId } from "react";
import { setDiscoveryPublicationAction } from "@/lib/discovery/publication";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function DiscoveryPublicationForm({ enabled }: { enabled: boolean }) {
  const id = useId();
  const [state, action, pending] = useActionState(setDiscoveryPublicationAction, {});
  return <Card className="border-none ring-1 ring-border">
    <CardHeader><CardTitle>Aparecer na busca de salões</CardTitle>
      <CardDescription>Publique nome, cidade, descrição e profissionais do perfil público para clientes encontrarem seu salão. Contatos privados não aparecem na busca. Você pode retirar a publicação a qualquer momento.</CardDescription>
    </CardHeader>
    <CardContent><form action={action} className="grid gap-4">
      <label htmlFor={id} className="flex items-center gap-3"><input id={id} type="checkbox" name="enabled" defaultChecked={enabled} disabled={pending} />Quero aparecer na busca pública</label>
      <Button disabled={pending} type="submit">{pending ? "Salvando..." : "Salvar publicação"}</Button>
      <p role="status" className={state.error ? "text-sm text-destructive" : "text-sm"}>{state.error ?? state.success}</p>
    </form></CardContent>
  </Card>;
}
