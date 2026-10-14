"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountAvatar } from "@/components/account/account-avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { avatarUploadMessage, clampOffset, coverScale } from "@/lib/account/avatar-ui";
import { cn } from "@/lib/utils";

const FRAME = 220;
const OUTPUT = 512;

type Draft = {
  image: HTMLImageElement;
  url: string;
  zoom: number;
  offsetX: number;
  offsetY: number;
};

async function readError(response: Response): Promise<string> {
  let code: string | null = null;
  try {
    const body = (await response.json()) as { error?: unknown };
    code = typeof body.error === "string" ? body.error : null;
  } catch {
    code = null;
  }
  return avatarUploadMessage(response.status, code);
}

export function AccountPhotoEditor({
  name,
  hasAvatar,
  version,
}: {
  name: string;
  hasAvatar: boolean;
  version: string | null;
}) {
  const router = useRouter();
  const [photo, setPhoto] = useState(hasAvatar);
  const [cacheVersion, setCacheVersion] = useState(version);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"status" | "alert">("status");
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const drag = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);

  function resetDraft() {
    setDraft((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  }

  function openFile(file: File | undefined) {
    if (!file || lock.current) return;
    setMessage(null);
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      setDraft((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return { image, url, zoom: 1, offsetX: 0, offsetY: 0 };
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      setTone("alert");
      setMessage("Não foi possível abrir essa foto. Escolha outra.");
    };
    image.src = url;
  }

  function moveDraft(clientX: number, clientY: number) {
    const start = drag.current;
    if (!start) return;
    setDraft((current) => {
      if (!current) return current;
      const scale = coverScale(current.image.naturalWidth, current.image.naturalHeight, FRAME, current.zoom);
      return {
        ...current,
        offsetX: clampOffset(start.originX + clientX - start.x, current.image.naturalWidth, scale, FRAME),
        offsetY: clampOffset(start.originY + clientY - start.y, current.image.naturalHeight, scale, FRAME),
      };
    });
  }

  async function saveDraft() {
    if (!draft || lock.current) return;
    lock.current = true;
    setPending(true);
    setMessage(null);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT;
      canvas.height = OUTPUT;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("canvas");
      const scale = coverScale(draft.image.naturalWidth, draft.image.naturalHeight, OUTPUT, draft.zoom);
      const ratio = OUTPUT / FRAME;
      const offsetX = clampOffset(draft.offsetX * ratio, draft.image.naturalWidth, scale, OUTPUT);
      const offsetY = clampOffset(draft.offsetY * ratio, draft.image.naturalHeight, scale, OUTPUT);
      const width = draft.image.naturalWidth * scale;
      const height = draft.image.naturalHeight * scale;
      context.drawImage(draft.image, (OUTPUT - width) / 2 + offsetX, (OUTPUT - height) / 2 + offsetY, width, height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
      const file = blob ?? (await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9)));
      if (!file) throw new Error("blob");
      const response = await fetch("/api/account/avatar", { method: "PUT", body: file });
      if (!response.ok) {
        setTone("alert");
        setMessage(await readError(response));
        return;
      }
      resetDraft();
      setPhoto(true);
      setCacheVersion(String(Date.now()));
      setTone("status");
      setMessage("Foto atualizada. Só você vê esta imagem.");
      router.refresh();
    } catch {
      setTone("alert");
      setMessage("Não foi possível salvar a foto agora. Tente de novo.");
    } finally {
      lock.current = false;
      setPending(false);
    }
  }

  async function removePhoto() {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/account/avatar", { method: "DELETE" });
      if (!response.ok) {
        setTone("alert");
        setMessage(await readError(response));
        return;
      }
      resetDraft();
      setPhoto(false);
      setCacheVersion(null);
      setTone("status");
      setMessage("Foto removida.");
      router.refresh();
    } catch {
      setTone("alert");
      setMessage("Não foi possível remover a foto agora. Tente de novo.");
    } finally {
      lock.current = false;
      setPending(false);
    }
  }

  const previewScale = draft
    ? coverScale(draft.image.naturalWidth, draft.image.naturalHeight, FRAME, draft.zoom)
    : 1;

  return (
    <div className="grid gap-4">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        {draft ? (
          <div
            className="relative touch-none overflow-hidden rounded-full bg-metric-blush ring-1 ring-[#f0e4de]"
            style={{ width: FRAME, height: FRAME }}
            role="application"
            aria-label="Ajuste a foto arrastando"
            onPointerDown={(event) => {
              drag.current = { x: event.clientX, y: event.clientY, originX: draft.offsetX, originY: draft.offsetY };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => moveDraft(event.clientX, event.clientY)}
            onPointerUp={() => {
              drag.current = null;
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={draft.url}
              alt="Pré-visualização da foto"
              draggable={false}
              className="absolute max-w-none select-none"
              style={{
                width: draft.image.naturalWidth * previewScale,
                height: draft.image.naturalHeight * previewScale,
                left: (FRAME - draft.image.naturalWidth * previewScale) / 2 + draft.offsetX,
                top: (FRAME - draft.image.naturalHeight * previewScale) / 2 + draft.offsetY,
              }}
            />
          </div>
        ) : (
          <AccountAvatar name={name} hasAvatar={photo} version={cacheVersion} size="lg" alt={photo ? `Foto de ${name}` : ""} className="size-24" />
        )}
        <div className="grid gap-1">
          <p className="font-medium text-wine-deep">{photo || draft ? "Sua foto" : "Sem foto ainda"}</p>
          <p className="text-sm leading-6 text-muted-foreground">
            {draft ? "Arraste para centralizar e ajuste o zoom. A foto fica só na sua conta." : "Aparecem as suas iniciais até você escolher uma foto."}
          </p>
        </div>
      </div>

      {draft ? (
        <label className="grid gap-2 text-sm">
          Zoom
          <input
            type="range"
            min={1}
            max={2.5}
            step={0.05}
            value={draft.zoom}
            disabled={pending}
            aria-valuetext={`${Math.round(draft.zoom * 100)}%`}
            onChange={(event) => {
              const zoom = Number(event.target.value);
              setDraft((current) => {
                if (!current) return current;
                const scale = coverScale(current.image.naturalWidth, current.image.naturalHeight, FRAME, zoom);
                return {
                  ...current,
                  zoom,
                  offsetX: clampOffset(current.offsetX, current.image.naturalWidth, scale, FRAME),
                  offsetY: clampOffset(current.offsetY, current.image.naturalHeight, scale, FRAME),
                };
              });
            }}
          />
        </label>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <input
          id="avatar-gallery"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={pending}
          onChange={(event) => {
            openFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <label htmlFor="avatar-gallery" className={cn(buttonVariants({ variant: "outline" }), "h-11 cursor-pointer rounded-full", pending && "pointer-events-none opacity-50")}>
          Escolher da galeria
        </label>
        <input
          id="avatar-camera"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="user"
          className="sr-only"
          disabled={pending}
          onChange={(event) => {
            openFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <label htmlFor="avatar-camera" className={cn(buttonVariants({ variant: "outline" }), "h-11 cursor-pointer rounded-full", pending && "pointer-events-none opacity-50")}>
          Tirar foto
        </label>
        {draft ? (
          <>
            <Button type="button" className="h-11 rounded-full" disabled={pending} aria-busy={pending} onClick={() => void saveDraft()}>
              {pending ? "Salvando…" : "Usar esta foto"}
            </Button>
            <Button type="button" variant="ghost" className="h-11 rounded-full" disabled={pending} onClick={resetDraft}>
              Cancelar
            </Button>
          </>
        ) : null}
        {photo && !draft ? (
          <Button type="button" variant="ghost" className="h-11 rounded-full" disabled={pending} aria-busy={pending} onClick={() => void removePhoto()}>
            {pending ? "Removendo…" : "Remover foto"}
          </Button>
        ) : null}
      </div>
      {message ? (
        <p className={tone === "alert" ? "text-sm text-destructive" : "text-sm text-muted-foreground"} role={tone === "alert" ? "alert" : "status"}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
