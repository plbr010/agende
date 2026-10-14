"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { changeWorkspaceFavorite } from "@/lib/client/favorite-actions";
import { FAVORITES_COPY, type FavoritesView, type WorkspaceFavorite } from "@/lib/client/favorites";
import { publicLogoUrl } from "@/lib/workspace/public";

export function FavoritesPanel({
  favorites,
  compact = false,
}: {
  favorites: FavoritesView;
  compact?: boolean;
}) {
  const [items, setItems] = useState(favorites.items);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const visible = compact ? items.slice(0, 2) : items;

  function remove(item: WorkspaceFavorite) {
    if (pending) return;
    const previous = items;
    setItems((current) => current.filter((entry) => entry.workspaceId !== item.workspaceId));
    setMessage(null);
    setPendingId(item.workspaceId);
    startTransition(async () => {
      const result = await changeWorkspaceFavorite(item.workspaceId, false);
      if (result.error) {
        setItems(previous);
        setMessage(FAVORITES_COPY.removeFailed);
      } else {
        setMessage(FAVORITES_COPY.removed);
      }
      setPendingId(null);
    });
  }

  if (favorites.status === "error") {
    return (
      <div className="rounded-[1.8rem] border border-destructive/30 bg-destructive/10 p-5 sm:p-8" role="alert">
        <p className="font-serif text-2xl text-wine-deep">{FAVORITES_COPY.errorTitle}</p>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{FAVORITES_COPY.errorBody}</p>
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-[1.8rem] bg-white p-5 ring-1 ring-[#f0e4de] sm:p-8">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-metric-blush text-wine-deep">
            <Heart className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-serif text-2xl text-wine-deep">{FAVORITES_COPY.emptyTitle}</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{FAVORITES_COPY.emptyBody}</p>
          </div>
        </div>
        {compact ? null : (
          <Button className="mt-6 h-11 rounded-full" render={<Link href="/cliente/descobrir" />}>
            Encontrar um salão
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {message ? (
        <p className="rounded-2xl bg-secondary/70 px-4 py-3 text-sm" role="status">
          {message}
        </p>
      ) : null}
      <ul className="grid gap-3 sm:grid-cols-2">
        {visible.map((item) => {
          const logo = publicLogoUrl(item.logoPath);
          const busy = pending && pendingId === item.workspaceId;
          return (
            <li key={item.workspaceId}>
              <article className="flex h-full flex-col justify-between rounded-[1.6rem] bg-white p-5 ring-1 ring-[#f0e4de]">
                <div className="flex items-start gap-3">
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logo} alt="" className="size-14 rounded-2xl object-cover" />
                  ) : (
                    <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-metric-blush font-serif text-xl text-wine-deep">
                      {item.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <h3 className="truncate font-serif text-xl text-wine-deep">{item.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{item.city} · {item.state}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button className="h-11 rounded-full" render={<Link href={`/p/${item.slug}/agendar`} />}>
                    Agendar
                  </Button>
                  <Button variant="outline" className="h-11 rounded-full" render={<Link href={`/p/${item.slug}`} />}>
                    Ver o salão
                  </Button>
                  {compact ? null : (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-11 rounded-full"
                      disabled={busy}
                      aria-busy={busy}
                      onClick={() => remove(item)}
                    >
                      {busy ? "Removendo…" : "Remover"}
                    </Button>
                  )}
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
