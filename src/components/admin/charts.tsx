import { formatCount, formatMoney } from "@/lib/admin/format";

function pathFor(values: number[], width: number, height: number) {
  const max = Math.max(1, ...values);
  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - (value / max) * (height - 8) - 4;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

export function AdminTrendChart({
  title,
  hint,
  points,
  kind = "count",
}: {
  title: string;
  hint: string;
  points: { date: string; value: number }[];
  kind?: "count" | "money";
}) {
  const values = points.map((point) => point.value);
  const total = values.reduce((sum, value) => sum + value, 0);
  const width = 320;
  const height = 92;
  const d = pathFor(values, width, height);
  const last = points.at(-1);

  return (
    <article className="rounded-[1.5rem] bg-card p-5 ring-1 ring-primary/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-medium text-wine-deep">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
        </div>
        <p className="font-serif text-2xl text-wine-deep">
          {kind === "money" ? formatMoney(total) : formatCount(total)}
        </p>
      </div>
      {points.length === 0 || total === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">Ainda não há movimento neste período.</p>
      ) : (
        <svg viewBox={`0 0 ${width} ${height}`} className="mt-5 h-24 w-full overflow-visible" role="img" aria-label={title}>
          <path d={`${d} L${width} ${height} L0 ${height} Z`} fill="var(--blush)" fillOpacity="0.45" />
          <path d={d} fill="none" stroke="var(--wine)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      )}
      {last ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Último dia: {kind === "money" ? formatMoney(last.value) : formatCount(last.value)}
        </p>
      ) : null}
    </article>
  );
}
