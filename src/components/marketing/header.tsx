"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { MARKETING_CTAS, MARKETING_NAV } from "@/lib/marketing/content";
import { cn } from "@/lib/utils";

export function MarketingHeader() {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full min-w-0 max-w-6xl items-center justify-between gap-3 px-4 sm:h-[4.25rem]">
        <BrandLogo size="sm" className="min-w-0 shrink" />

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Seções">
          {MARKETING_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button
            variant="ghost"
            className="hidden h-11 rounded-full px-3 sm:inline-flex"
            render={<Link href={MARKETING_CTAS.login.href} />}
          >
            {MARKETING_CTAS.login.label}
          </Button>
          <Button
            className="h-11 min-h-11 rounded-full px-3.5 text-sm sm:px-4"
            render={<Link href={MARKETING_CTAS.headerPrimary.href} />}
          >
            {MARKETING_CTAS.headerPrimary.label}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 min-h-11 min-w-11 rounded-full lg:hidden"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "lg:hidden",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        <button
          type="button"
          tabIndex={open ? 0 : -1}
          aria-label="Fechar menu"
          className={cn(
            "fixed inset-0 z-40 bg-foreground/20 backdrop-blur-[2px] transition-opacity",
            open ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setOpen(false)}
        />
        <div
          id={panelId}
          className={cn(
            "fixed inset-x-3 top-[4.5rem] z-50 origin-top rounded-3xl border border-border/80 bg-background/95 p-3 shadow-[0_24px_60px_-28px_oklch(0.4_0.05_25/0.45)] backdrop-blur-xl transition-all sm:inset-x-auto sm:right-4 sm:left-auto sm:w-[22rem]",
            open
              ? "translate-y-0 opacity-100"
              : "pointer-events-none -translate-y-2 opacity-0",
          )}
        >
          <nav className="flex flex-col gap-1" aria-label="Menu móvel">
            {MARKETING_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-12 items-center rounded-2xl px-4 text-base text-foreground hover:bg-muted"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href={MARKETING_CTAS.login.href}
              className="flex min-h-12 items-center rounded-2xl px-4 text-base text-foreground hover:bg-muted sm:hidden"
              onClick={() => setOpen(false)}
            >
              {MARKETING_CTAS.login.label}
            </Link>
            <Button
              className="mt-2 h-12 w-full rounded-full text-base"
              render={<Link href={MARKETING_CTAS.primary.href} />}
              onClick={() => setOpen(false)}
            >
              {MARKETING_CTAS.primary.label}
            </Button>
          </nav>
        </div>
      </div>
    </header>
  );
}
