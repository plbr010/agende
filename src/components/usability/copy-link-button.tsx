"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

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

  async function copy() {
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    const url = path.startsWith("http") ? path : `${origin}${path.startsWith("/") ? path : `/${path}`}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copiado. Cole no WhatsApp para enviar.");
    window.setTimeout(() => setCopied(false), 2500);
  }

  return (
    <Button type="button" variant="outline" className={className ?? "h-11"} onClick={copy}>
      {copied ? copiedLabel : label}
    </Button>
  );
}
