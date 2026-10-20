"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PersonMark } from "@/components/people/person-mark";
import { Button, buttonVariants } from "@/components/ui/button";
import { avatarUploadMessage } from "@/lib/account/avatar-ui";
import { cn } from "@/lib/utils";

async function readPhotoError(response: Response): Promise<string> {
  let code: string | null = null;
  try {
    const body = (await response.json()) as { error?: unknown };
    code = typeof body.error === "string" ? body.error : null;
  } catch {
    code = null;
  }
  return avatarUploadMessage(response.status, code);
}

export function ProfessionalPhotoEditor({ memberId, name }: { memberId: string; name: string }) {
  const inputId = useId();
  const router = useRouter();
  const [revision, setRevision] = useState(0);
  const [removed, setRemoved] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [tone, setTone] = useState<"status" | "alert">("status");
  const [pending, start] = useTransition();
  const url = `/api/professionals/photo?memberId=${encodeURIComponent(memberId)}`;

  function replacePreview(next: string | null) {
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return next;
    });
  }

  function save(file: File | null) {
    start(async () => {
      setFeedback("");
      try {
        if (file && (file.size > 4 * 1024 * 1024 || !/\.(jpe?g|png|webp)$/i.test(file.name) || !["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
          replacePreview(null);
          setTone("alert");
          setFeedback("Escolha uma foto JPEG, PNG ou WebP de até 4 MB.");
          return;
        }
        if (file) replacePreview(URL.createObjectURL(file));
        const result = await fetch(url, {
          method: file ? "PUT" : "DELETE",
          body: file,
          headers: file
            ? {
                "Content-Type": file.type,
                "X-Public-Photo-Consent": "true",
                "X-Image-Extension": file.name.split(".").pop()!.toLowerCase(),
              }
            : {},
        });
        if (!result.ok) {
          replacePreview(null);
          setTone("alert");
          setFeedback(await readPhotoError(result));
          return;
        }
        const data = (await result.json()) as { cleanupPending?: boolean };
        setRevision((value) => value + 1);
        setRemoved(!file);
        replacePreview(null);
        router.refresh();
        setTone("status");
        setFeedback(
          data.cleanupPending
            ? "Foto salva. A imagem anterior ainda está sendo apagada."
            : file
              ? "Foto salva. As clientes veem esta imagem ao escolher quem atende."
              : "Foto removida. As clientes passam a ver as iniciais.",
        );
      } catch {
        replacePreview(null);
        setTone("alert");
        setFeedback("Não foi possível salvar. Confira sua conexão e tente novamente.");
      }
    });
  }

  const photoUrl = removed ? null : previewUrl ?? `${url}&v=${revision}`;

  return (
    <section className="grid justify-items-center gap-4 rounded-[1.4rem] bg-[var(--cream)] p-4 text-center ring-1 ring-[#f0e4de]" aria-label={`Foto de ${name}`} aria-busy={pending}>
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt={`Prévia da foto de ${name}`} className="size-24 rounded-full object-cover ring-4 ring-white" />
      ) : (
        <PersonMark key={`${revision}-${removed ? "empty" : "photo"}`} name={name} photoUrl={photoUrl} className="size-24 text-2xl ring-4 ring-white" />
      )}
      <div className="grid gap-1">
        <p className="font-medium text-wine-deep">{removed && !previewUrl ? "Sem foto pública" : "Foto de atendimento"}</p>
        <p className="text-sm leading-6 text-muted-foreground">
          Esta foto aparece na escolha de profissional. Sem foto, mostramos as iniciais. Envie somente uma imagem autorizada.
        </p>
      </div>
      {pending ? (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white" role="progressbar" aria-valuetext="Enviando foto">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />
        </div>
      ) : null}
      <div className="flex w-full flex-col gap-2">
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={pending}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) save(file);
          }}
        />
        <label htmlFor={inputId} className={cn(buttonVariants({ size: "lg" }), "h-12 cursor-pointer", pending && "pointer-events-none opacity-50")}>
          {pending ? "Salvando..." : "Adicionar ou trocar foto"}
        </label>
        <Button type="button" variant="outline" size="lg" className="h-12" disabled={pending} onClick={() => save(null)}>
          Remover foto
        </Button>
      </div>
      {feedback ? (
        <p
          role={tone === "alert" ? "alert" : "status"}
          className={tone === "alert" ? "text-sm leading-6 text-destructive" : "rounded-full bg-white px-4 py-2 text-sm leading-6 text-wine-deep"}
        >
          {feedback}
        </p>
      ) : null}
    </section>
  );
}
