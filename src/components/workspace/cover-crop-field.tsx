"use client";

import { useEffect, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { clampOffset, coverScaleRect } from "@/lib/account/avatar-ui";
import { cn } from "@/lib/utils";

const OUTPUT_W = 1600;
const OUTPUT_H = 640;
const MAX_SOURCE = 4 * 1024 * 1024;
const MAX_OUTPUT = 2 * 1024 * 1024;

type Draft = {
  image: HTMLImageElement;
  url: string;
  zoom: number;
  offsetX: number;
  offsetY: number;
};

export function CoverCropField({
  currentUrl,
  salonName,
  disabled,
  inputName = "image",
  inputId = "workspace-image-cover",
}: {
  currentUrl: string | null;
  salonName: string;
  disabled?: boolean;
  inputName?: string;
  inputId?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [frame, setFrame] = useState({ w: 320, h: 128 });
  const [preparedUrl, setPreparedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  useEffect(() => {
    const node = frameRef.current;
    if (!node || !draft) return;
    const update = () => {
      const rect = node.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setFrame({ w: rect.width, h: rect.height });
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [draft]);

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
    const allowed = /image\/(jpeg|png|webp)/.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
    if (!allowed) {
      setError("Escolha uma foto JPG, PNG ou WebP.");
      return;
    }
    if (file.size > MAX_SOURCE) {
      setError("A imagem pode ter no máximo 4 MB.");
      return;
    }
    clearPrepared();
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth < 32 || image.naturalHeight < 32) {
        URL.revokeObjectURL(url);
        setError("Essa imagem é pequena demais. Escolha outra.");
        return;
      }
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
    canvas.width = OUTPUT_W;
    canvas.height = OUTPUT_H;
    const context = canvas.getContext("2d");
    if (!context) {
      setError("Não foi possível preparar a imagem neste aparelho.");
      return;
    }
    const scale = coverScaleRect(draft.image.naturalWidth, draft.image.naturalHeight, OUTPUT_W, OUTPUT_H, draft.zoom);
    const ratio = OUTPUT_W / Math.max(frame.w, 1);
    const offsetX = clampOffset(draft.offsetX * ratio, draft.image.naturalWidth, scale, OUTPUT_W);
    const offsetY = clampOffset(draft.offsetY * ratio, draft.image.naturalHeight, scale, OUTPUT_H);
    const width = draft.image.naturalWidth * scale;
    const height = draft.image.naturalHeight * scale;
    context.drawImage(draft.image, (OUTPUT_W - width) / 2 + offsetX, (OUTPUT_H - height) / 2 + offsetY, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));
    const fileBlob = blob ?? (await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86)));
    if (!fileBlob) {
      setError("Não foi possível preparar a imagem. Tente outra foto.");
      return;
    }
    if (fileBlob.size > MAX_OUTPUT) {
      setError("Aproxime menos a foto ou escolha uma imagem mais leve. O limite é 2 MB.");
      return;
    }
    const type = fileBlob.type || "image/jpeg";
    const named = new File([fileBlob], type === "image/webp" ? "capa.webp" : "capa.jpg", { type });
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
    setError(null);
  }

  const previewScale = draft
    ? coverScaleRect(draft.image.naturalWidth, draft.image.naturalHeight, frame.w, frame.h, draft.zoom)
    : 1;

  return (
    <div className="grid gap-3" data-framing={draft ? "open" : "ready"}>
      <input
        ref={inputRef}
        id={inputId}
        name={inputName}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        disabled={disabled}
      />
      <div
        ref={frameRef}
        className={cn(
          "relative aspect-[5/2] w-full touch-none overflow-hidden rounded-[1.25rem] bg-white ring-1 ring-[#f0e4de]",
          over && "ring-2 ring-primary",
        )}
        role={draft ? "application" : undefined}
        aria-label={draft ? "Ajuste a capa arrastando" : undefined}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          openFile(event.dataTransfer.files?.[0]);
        }}
        onPointerDown={(event) => {
          if (!draft) return;
          drag.current = { x: event.clientX, y: event.clientY, originX: draft.offsetX, originY: draft.offsetY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!draft || !start) return;
          setDraft((current) => {
            if (!current) return current;
            const scale = coverScaleRect(current.image.naturalWidth, current.image.naturalHeight, frame.w, frame.h, current.zoom);
            return {
              ...current,
              offsetX: clampOffset(start.originX + event.clientX - start.x, current.image.naturalWidth, scale, frame.w),
              offsetY: clampOffset(start.originY + event.clientY - start.y, current.image.naturalHeight, scale, frame.h),
            };
          });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        {draft ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={draft.url}
            alt="Pré-visualização da capa"
            draggable={false}
            className="absolute max-w-none select-none"
            style={{
              width: draft.image.naturalWidth * previewScale,
              height: draft.image.naturalHeight * previewScale,
              left: (frame.w - draft.image.naturalWidth * previewScale) / 2 + draft.offsetX,
              top: (frame.h - draft.image.naturalHeight * previewScale) / 2 + draft.offsetY,
            }}
          />
        ) : preparedUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preparedUrl} alt="Capa pronta para salvar" className="h-full w-full object-cover" />
        ) : currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentUrl} alt={`Capa de ${salonName}`} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center bg-gradient-to-br from-[#f8e4df] via-[#fbf4ee] to-[#e8b4a0]/70 px-4 text-center">
            <p className="font-serif text-2xl text-wine-deep">Nenhuma capa ainda</p>
          </div>
        )}
      </div>

      {draft ? (
        <label className="grid gap-1 text-sm text-muted-foreground">
          <span className="flex justify-between">
            Aproximar <span>{Math.round(draft.zoom * 100)}%</span>
          </span>
          <input
            type="range"
            min={1}
            max={2.5}
            step={0.05}
            value={draft.zoom}
            className="h-11 accent-[var(--rose)]"
            aria-valuetext={`${Math.round(draft.zoom * 100)} por cento`}
            onChange={(event) => {
              const zoom = Number(event.target.value);
              setDraft((current) => {
                if (!current) return current;
                const scale = coverScaleRect(current.image.naturalWidth, current.image.naturalHeight, frame.w, frame.h, zoom);
                return {
                  ...current,
                  zoom,
                  offsetX: clampOffset(current.offsetX, current.image.naturalWidth, scale, frame.w),
                  offsetY: clampOffset(current.offsetY, current.image.naturalHeight, scale, frame.h),
                };
              });
            }}
          />
        </label>
      ) : null}

      <div className="flex flex-wrap gap-2">
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
        <label
          htmlFor={`${inputId}-gallery`}
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "cursor-pointer", disabled && "pointer-events-none opacity-50")}
        >
          {currentUrl || preparedUrl ? "Trocar capa" : "Escolher capa"}
        </label>
        {draft ? (
          <>
            <Button type="button" size="lg" onClick={() => void prepareCrop()}>
              Usar este enquadramento
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
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
      <p className="text-sm leading-6 text-muted-foreground">
        {preparedUrl
          ? "Enquadramento pronto. A capa só muda depois que você salvar e o envio terminar."
          : "Foto horizontal, JPG, PNG ou WebP, até 4 MB. Arraste a imagem ou toque em Escolher capa. Depois ajuste o enquadramento."}
      </p>
      {error ? (
        <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
