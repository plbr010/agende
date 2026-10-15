"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { saveWorkspaceImageAction } from "@/lib/workspace/image-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/lib/auth/actions";
import { LogoCropField } from "@/components/workspace/logo-crop-field";

export function WorkspaceImageForm({ kind, url }: { kind: "logo" | "cover"; url: string | null }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveWorkspaceImageAction, {});
  const [fileError, setFileError] = useState<string | null>(null);
  const name = kind === "logo" ? "Logo" : "Foto de capa";
  return <form action={action} className="grid gap-3 rounded-2xl border p-4">
    <input type="hidden" name="kind" value={kind} />
    <Label htmlFor={`workspace-image-${kind}`}>{name}</Label>
    {kind === "logo" ? <LogoCropField currentUrl={url} salonName="estabelecimento" inputName="image" inputId={`workspace-image-${kind}`} allowRemoval={false} disabled={pending} /> : url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={`${name} do estabelecimento`} className="max-h-40 max-w-full rounded-xl object-contain" />
    ) : <p className="text-sm text-muted-foreground">Nenhuma imagem cadastrada.</p>}
    {kind === "cover" ? <Input id={`workspace-image-${kind}`} name="image" type="file" accept="image/jpeg,image/png,image/webp" disabled={pending}
      onChange={event => {
        if ((event.currentTarget.files?.[0]?.size ?? 0) > 4 * 1024 * 1024) {
          event.currentTarget.value = ""; setFileError("A imagem pode ter no máximo 4 MB.");
        } else setFileError(null);
      }} /> : null}
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="publicConsent" value="true" disabled={pending} />Autorizo exibir esta imagem no perfil público do estabelecimento.</label>
    <p className="text-xs text-muted-foreground">JPEG, PNG ou WebP até 4 MB. Fotos pessoais continuam privadas.</p>
    {fileError ? <p role="alert" className="text-sm text-destructive">{fileError}</p> : null}
    {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
    {state.subscriptionInactive ? <Link href="/app/configuracoes/assinatura" className="text-sm underline">Conferir assinatura</Link> : null}
    {state.success ? <p role="status" className="text-sm">{state.success}</p> : null}
    <div className="flex gap-2">
      <Button type="submit" disabled={pending || Boolean(fileError)}>{pending ? "Salvando..." : `Salvar ${kind === "logo" ? "logo" : "capa"}`}</Button>
      {url ? <Button type="submit" name="remove" value="true" variant="outline" disabled={pending}>Remover {kind === "logo" ? "logo" : "capa"}</Button> : null}
    </div>
  </form>;
}
