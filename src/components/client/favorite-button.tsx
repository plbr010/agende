"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { changeWorkspaceFavorite, savePublicFavorite } from "@/lib/client/favorite-actions";
import { FAVORITES_COPY, favoriteActionMessage } from "@/lib/client/favorites";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  slug,
  workspaceId,
  initialSaved,
  name,
}: {
  slug: string;
  workspaceId: string | null;
  initialSaved: boolean;
  name: string;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [knownId, setKnownId] = useState(workspaceId);
  const [message, setMessage] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (pending || blocked) return;
    setMessage(null);
    startTransition(async () => {
      if (saved && knownId) {
        const result = await changeWorkspaceFavorite(knownId, false);
        if (result.error) {
          setMessage(FAVORITES_COPY.removeFailed);
          return;
        }
        setSaved(false);
        setMessage(FAVORITES_COPY.removed);
        return;
      }
      const result = await savePublicFavorite(slug);
      if (!("workspaceId" in result)) {
        if (result.error === "missing_target") setBlocked(true);
        setMessage(favoriteActionMessage(result.error));
        return;
      }
      setKnownId(result.workspaceId);
      setSaved(true);
      setMessage(FAVORITES_COPY.saved);
    });
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={pending || blocked}
        aria-busy={pending}
        aria-pressed={saved}
        aria-label={saved ? `Remover ${name} dos favoritos` : `Guardar ${name}`}
        className={cn(
          "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium ring-1 transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60",
          saved ? "bg-metric-blush text-wine-deep ring-[#f0e4de]" : "bg-white text-wine-deep ring-[#f0e4de] hover:bg-metric-blush",
        )}
      >
        <Heart className={cn("size-4", saved && "fill-current")} aria-hidden="true" />
        {pending ? "Salvando…" : saved ? "Nos favoritos" : "Guardar salão"}
      </button>
      {message ? (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
