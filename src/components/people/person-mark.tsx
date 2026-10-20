"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function personInitials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return letters || "•";
}

export function PersonMark({
  name,
  photoUrl,
  className,
  size = "md",
}: {
  name: string;
  photoUrl?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const sizeClass = size === "lg" ? "size-16 text-xl" : size === "sm" ? "size-10 text-sm" : "size-14 text-lg";

  function rememberImage(image: HTMLImageElement | null) {
    if (image?.complete && image.naturalWidth === 0) setFailedUrl(photoUrl ?? null);
  }

  if (photoUrl && failedUrl !== photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={photoUrl}
        ref={rememberImage}
        src={photoUrl}
        alt=""
        onError={() => setFailedUrl(photoUrl ?? null)}
        className={cn("shrink-0 rounded-full object-cover ring-1 ring-[#f0e4de]", sizeClass, className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-metric-blush font-serif text-wine-deep",
        sizeClass,
        className,
      )}
      aria-hidden="true"
    >
      {personInitials(name)}
    </span>
  );
}
