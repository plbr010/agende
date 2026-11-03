"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { selectClassName } from "@/lib/workspace/labels";

export function AdminFilters(props: {
  searchName?: string;
  searchPlaceholder: string;
  selects?: { name: string; label: string; options: { value: string; label: string }[] }[];
}) {
  return (
    <Suspense fallback={<div className="h-28 animate-pulse rounded-[1.5rem] bg-card ring-1 ring-primary/10" />}>
      <AdminFiltersForm {...props} />
    </Suspense>
  );
}

function AdminFiltersForm({
  searchName = "q",
  searchPlaceholder,
  selects = [],
}: {
  searchName?: string;
  searchPlaceholder: string;
  selects?: { name: string; label: string; options: { value: string; label: string }[] }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const urlQuery = params.get(searchName) ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [prevUrlQuery, setPrevUrlQuery] = useState(urlQuery);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (urlQuery !== prevUrlQuery) {
    setPrevUrlQuery(urlQuery);
    setQuery(urlQuery);
  }

  function replace(next: URLSearchParams) {
    next.delete("page");
    const search = next.toString();
    startTransition(() => {
      router.replace(search ? `${pathname}?${search}` : pathname);
    });
  }

  function onSearch(value: string) {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set(searchName, value.trim());
      else next.delete(searchName);
      replace(next);
    }, 250);
  }

  function onSelect(name: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    replace(next);
  }

  return (
    <form className="grid gap-3 rounded-[1.5rem] bg-card p-4 ring-1 ring-primary/10 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" onSubmit={(event) => event.preventDefault()}>
      <div className="grid gap-2">
        <Label htmlFor="admin-search">{searchPlaceholder}</Label>
        <Input
          id="admin-search"
          value={query}
          onChange={(event) => onSearch(event.currentTarget.value)}
          placeholder={searchPlaceholder}
          autoComplete="off"
        />
      </div>
      {selects.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {selects.map((select) => (
            <div key={select.name} className="grid gap-2">
              <Label htmlFor={select.name}>{select.label}</Label>
              <select
                id={select.name}
                className={selectClassName}
                value={params.get(select.name) ?? ""}
                onChange={(event) => onSelect(select.name, event.currentTarget.value)}
              >
                <option value="">Todos</option>
                {select.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      ) : null}
    </form>
  );
}
