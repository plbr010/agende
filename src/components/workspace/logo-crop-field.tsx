"use client";

import { useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { clampOffset, coverScale } from "@/lib/account/avatar-ui";
import { cn } from "@/lib/utils";

const FRAME = 160;
const OUTPUT = 512;
const MAX_BYTES = 2 * 1024 * 1024;

type Draft = {
  image: HTMLImageElement;
  url: string;
  zoom: number;
  offsetX: number;
  offsetY: number;
};

export function LogoCropField({
  currentUrl,
  salonName,
  disabled,
  inputName = "logo",
  inputId = "logo",
  allowRemoval = true,
}: {
  currentUrl: string | null;
  salonName: string;
  disabled?: boolean;
  inputName?: string;
  inputId?: string;
  allowRemoval?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [preparedUrl, setPreparedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function clearPrepared() {
    setPreparedUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    if (inputRef.current) inputRef.current.value = "";
  }

  function openFile(file: File | undefined) {
    if (!file || disabled) return;
    setError(null);
    clearPrepared();
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
      setError("Não foi possível abrir essa imagem. Escolha outra.");
    };
    image.src = url;
  }

  async function prepareCrop() {
    if (!draft) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const context = canvas.getContext("2d");
    if (!context) {
      setError("Não foi possível preparar a imagem neste aparelho.");
      return;
    }
    const scale = coverScale(draft.image.naturalWidth, draft.image.naturalHeight, OUTPUT, draft.zoom);
    const ratio = OUTPUT / FRAME;
    const offsetX = clampOffset(draft.offsetX * ratio, draft.image.naturalWidth, scale, OUTPUT);
    const offsetY = clampOffset(draft.offsetY * ratio, draft.image.naturalHeight, scale, OUTPUT);
    const width = draft.image.naturalWidth * scale;
    const height = draft.image.naturalHeight * scale;
    context.drawImage(draft.image, (OUTPUT - width) / 2 + offsetX, (OUTPUT - height) / 2 + offsetY, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
    const fileBlob = blob ?? (await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9)));
    if (!fileBlob) {
      setError("Não foi possível preparar a imagem. Tente outra foto.");
      return;
    }
    if (fileBlob.size > MAX_BYTES) {
      setError("A imagem pode ter no máximo 2 MB.");
      return;
    }
    const type = fileBlob.type || "image/jpeg";
    const named = new File([fileBlob], type === "image/webp" ? "logo.webp" : "logo.jpg", { type });
    const transfer = new DataTransfer();
    transfer.items.add(named);
    if (inputRef.current) inputRef.current.files = transfer.files;
    const preview = URL.createObjectURL(fileBlob);
    setPreparedUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return preview;
    });
    setDraft((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  }

  const previewScale = draft
    ? coverScale(draft.image.naturalWidth, draft.image.naturalHeight, FRAME, draft.zoom)
    : 1;

  return (
    <div className="grid justify-items-center gap-3 rounded-[1.4rem] bg-[var(--cream)] px-4 py-5">
      <input ref={inputRef} id={inputId} name={inputName} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} disabled={disabled} />
      {draft ? (
        <div
          className="relative touch-none overflow-hidden rounded-[1.4rem] bg-white ring-1 ring-[#f0e4de]"
          style={{ width: FRAME, height: FRAME }}
          role="application"
          aria-label="Ajuste a logo arrastando"
          onPointerDown={(event) => {
            drag.current = { x: event.clientX, y: event.clientY, originX: draft.offsetX, originY: draft.offsetY };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const start = drag.current;
            if (!start) return;
            setDraft((current) => {
              if (!current) return current;
              const scale = coverScale(current.image.naturalWidth, current.image.naturalHeight, FRAME, current.zoom);
              return {
                ...current,
                offsetX: clampOffset(start.originX + event.clientX - start.x, current.image.naturalWidth, scale, FRAME),
                offsetY: clampOffset(start.originY + event.clientY - start.y, current.image.naturalHeight, scale, FRAME),
              };
            });
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={draft.url}
            alt="Pré-visualização da logo"
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
      ) : preparedUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preparedUrl} alt="Logo pronta para salvar" className="size-28 rounded-[1.4rem] object-cover ring-1 ring-[#f0e4de]" />
      ) : currentUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={currentUrl} alt={`Logo de ${salonName}`} className="size-28 rounded-[1.4rem] object-cover ring-1 ring-[#f0e4de]" />
      ) : (
        <div className="grid size-28 place-items-center rounded-[1.4rem] bg-white font-serif text-3xl text-primary ring-1 ring-[#f0e4de]">
          {salonName.slice(0, 1)}
        </div>
      )}

      {draft ? (
        <label className="grid w-36 gap-1 text-left text-xs text-muted-foreground">
          <span className="flex justify-between">Zoom <span>{Math.round(draft.zoom * 100)}%</span></span>
          <input
            type="range"
            min={1}
            max={2.5}
            step={0.05}
            value={draft.zoom}
            className="accent-[var(--rose)]"
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

      <div className="flex flex-wrap justify-center gap-2">
        <input
          id={`${inputId}-gallery`}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={disabled}
          onChange={(event) => {
            openFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <label htmlFor={`${inputId}-gallery`} className={cn(buttonVariants({ variant: "outline" }), "h-11 cursor-pointer rounded-full", disabled && "pointer-events-none opacity-50")}>
          Escolher logo
        </label>
        {draft ? (
          <>
            <Button type="button" className="h-11 rounded-full" onClick={() => void prepareCrop()}>
              Usar este enquadramento
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-full"
              onClick={() => {
                setDraft((current) => {
                  if (current) URL.revokeObjectURL(current.url);
                  return null;
                });
              }}
            >
              Cancelar
            </Button>
          </>
        ) : null}
      </div>
      <p className="max-w-sm text-center text-xs leading-5 text-muted-foreground">
        {preparedUrl
          ? "Enquadramento pronto. A logo só troca depois que você salvar e o envio terminar."
          : "JPG, PNG ou WebP. A logo é preparada com até 2 MB; a capa fica na seção própria."}
      </p>
      {currentUrl && allowRemoval ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="clearLogo" value="true" className="size-4 rounded border-input" disabled={disabled} />
          Remover imagem atual
        </label>
      ) : null}
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
    </div>
  );
}
