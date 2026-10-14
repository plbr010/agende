"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function accountInitials(value: string): string {
  const letters = value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return letters || "?";
}

export function AccountAvatar({
  name,
  hasAvatar,
  version,
  size = "default",
  className,
  alt = "",
}: {
  name: string;
  hasAvatar: boolean;
  version?: string | null;
  size?: "default" | "sm" | "lg";
  className?: string;
  alt?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = version ? `/api/account/avatar?v=${encodeURIComponent(version)}` : "/api/account/avatar";

  return (
    <Avatar size={size} className={cn(size === "lg" && "size-24 data-[size=lg]:size-24", className)}>
      {hasAvatar && !failed ? <AvatarImage src={src} alt={alt} onError={() => setFailed(true)} /> : null}
      <AvatarFallback className="bg-metric-blush text-xs text-wine-deep">{accountInitials(name)}</AvatarFallback>
    </Avatar>
  );
}
