import { CheckCircle2, Heart } from "lucide-react";
import { CLIENT_FAVORITES_STATUS } from "@/lib/client/favorites";

export function FavoritesPanel({ compact = false }: { compact?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-[1.8rem] bg-white p-5 ring-1 ring-[#f0e4de] sm:p-8">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-metric-blush text-wine-deep">
          <Heart className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="font-serif text-2xl text-wine-deep">{CLIENT_FAVORITES_STATUS.title}</p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{CLIENT_FAVORITES_STATUS.description}</p>
        </div>
      </div>
      {compact ? null : (
        <ul className="mt-6 grid gap-2 sm:grid-cols-2">
          {CLIENT_FAVORITES_STATUS.fields.map((field) => (
            <li key={field} className="flex items-center gap-2 rounded-2xl bg-metric-blush/70 px-4 py-3 text-sm">
              <CheckCircle2 className="size-4 shrink-0 text-wine-deep" aria-hidden="true" />
              {field}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
