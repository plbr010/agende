"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CLIPBOARD_COPY, copyTextToClipboard } from "@/lib/usability/clipboard";

export function CopyLinkButton({
  path,
  label = "Copiar link",
  copiedLabel = "Link copiado",
  className,
}: {
  path: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);

  async function copy() {
    if (pending) return;
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    const url = path.startsWith("http") ? path : `${origin}${path.startsWith("/") ? path : `/${path}`}`;
    setPending(true);
    try {
      const ok = await copyTextToClipboard(url);
      if (!ok) {
        toast.error(CLIPBOARD_COPY.failure);
        return;
      }
      setCopied(true);
      toast.success(CLIPBOARD_COPY.success);
      window.setTimeout(() => setCopied(false), 2500);
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={className ?? "h-11"}
      onClick={() => void copy()}
      disabled={pending}
      aria-busy={pending}
    >
      {copied ? copiedLabel : label}
    </Button>
  );
}
