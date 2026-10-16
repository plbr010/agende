"use client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
export function PersonPhoto({ name, src }: { name: string; src?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("");
  return <Avatar size="lg"><AvatarImage src={src} alt={`Foto de ${name}`} loading="lazy" /><AvatarFallback>{initials || "•"}</AvatarFallback></Avatar>;
}
