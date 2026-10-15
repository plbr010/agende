"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { saveWorkspaceImageAction } from "@/lib/workspace/image-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/lib/auth/actions";
import { LogoCropField } from "@/components/workspace/logo-crop-field";

export function WorkspaceImageForm({ kind, url, salonName }: { kind: "logo" | "cover"; url: string | null; salonName: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveWorkspaceImageAction, {});
  const [fileError, setFileError] = useState<string | null>(null);
  const isLogo = kind === "logo";
  const name = isLogo ? "Logo" : "Foto de capa";
  return (
    <form action={action} className="grid gap-4 rounded-[1.6rem] bg-[var(--cream)] p-5 ring-1 ring-[#f0e4de]">
      <input type="hidden" name="kind" value={kind} />
      <div>
        <h3 className="font-serif text-2xl text-wine-deep">{name} do estabelecimento</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {isLogo
            ? "A logo aparece na página do salão. Ela só muda depois que o envio terminar."
            : "A capa é a imagem larga da página do salão. Ela só muda depois que o envio terminar."}
        </p>
      </div>
      <Label htmlFor={`workspace-image-${kind}`}>{name}</Label>
      {isLogo ? (
        <LogoCropField key={url ?? "empty"} currentUrl={url} salonName={salonName} inputName="image" inputId={`workspace-image-${kind}`} allowRemoval={false} disabled={pending} />
      ) : url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={`${name} de ${salonName}`} className="max-h-56 w-full rounded-[1.25rem] object-cover ring-1 ring-[#f0e4de]" />
      ) : (
        <p className="rounded-[1.25rem] border border-dashed border-[#e4d5ce] bg-white px-4 py-8 text-center text-sm leading-6 text-muted-foreground">
          Nenhuma capa ainda. Escolha uma imagem e salve para as clientes verem.
        </p>
      )}
      {kind === "cover" ? (
        <Input id={`workspace-image-${kind}`} name="image" type="file" accept="image/jpeg,image/png,image/webp" disabled={pending} className="h-12 bg-white"
          onChange={event => {
            if ((event.currentTarget.files?.[0]?.size ?? 0) > 4 * 1024 * 1024) {
              event.currentTarget.value = ""; setFileError("A imagem pode ter no máximo 4 MB.");
            } else setFileError(null);
          }} />
      ) : null}
      <label className="flex min-h-11 items-start gap-3 text-sm leading-6">
        <input type="checkbox" name="publicConsent" value="true" disabled={pending} className="mt-1 size-5" />
        Autorizo exibir esta imagem na página pública do estabelecimento.
      </label>
      <p className="text-sm leading-6 text-muted-foreground">JPEG, PNG ou WebP, até 4 MB. A foto da sua conta continua privada.</p>
      {fileError ? <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{fileError}</p> : null}
      {state.error ? <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{state.error}</p> : null}
      {state.subscriptionInactive ? <Link href="/app/configuracoes/assinatura" className="inline-flex min-h-11 items-center text-sm underline">Conferir assinatura</Link> : null}
      {state.success ? <p role="status" className="rounded-full bg-metric-blush px-4 py-2 text-sm text-wine-deep">{state.success}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" disabled={pending || Boolean(fileError)} aria-busy={pending}>{pending ? "Salvando..." : `Salvar ${isLogo ? "logo" : "capa"}`}</Button>
        {url ? <Button type="submit" name="remove" value="true" variant="outline" size="lg" disabled={pending}>Remover {isLogo ? "logo" : "capa"}</Button> : null}
      </div>
    </form>
  );
}
