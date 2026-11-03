import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { pageCount, withParams } from "@/lib/admin/params";
import type { LucideIcon } from "lucide-react";

export function AdminTable({
  columns,
  children,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  isEmpty,
}: {
  columns: string[];
  children: React.ReactNode;
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
  isEmpty: boolean;
}) {
  if (isEmpty) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="overflow-x-auto rounded-[1.5rem] bg-card ring-1 ring-primary/10">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-border/80 text-xs uppercase tracking-[0.12em] text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th key={column} className="whitespace-nowrap px-4 py-3 font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">{children}</tbody>
      </table>
    </div>
  );
}

export function AdminPager({
  path,
  page,
  total,
  params,
}: {
  path: string;
  page: number;
  total: number;
  params: Record<string, string | null | undefined>;
}) {
  const pages = pageCount(total);
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 pt-4">
      <p className="text-sm text-muted-foreground">
        Página {page} de {pages}
      </p>
      <div className="flex gap-2">
        {page <= 1 ? (
          <Button variant="outline" size="sm" disabled>Anterior</Button>
        ) : (
          <Button variant="outline" size="sm" render={<Link href={withParams(path, { ...params, page: String(page - 1) })} />}>
            Anterior
          </Button>
        )}
        {page >= pages ? (
          <Button variant="outline" size="sm" disabled>Próxima</Button>
        ) : (
          <Button variant="outline" size="sm" render={<Link href={withParams(path, { ...params, page: String(page + 1) })} />}>
            Próxima
          </Button>
        )}
      </div>
    </div>
  );
}
