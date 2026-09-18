"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { scrollToHash } from "@/components/marketing/hash-link";
import { cn } from "@/lib/utils";

type Variant = "default" | "outline" | "secondary" | "ghost";

export function MarketingLinkButton({
  href,
  children,
  variant = "default",
  className,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={(event) => {
        if (href.includes("#") && window.location.pathname === "/") {
          if (scrollToHash(href)) event.preventDefault();
        }
        onClick?.();
      }}
      className={cn(buttonVariants({ variant, size: "lg" }), className)}
    >
      {children}
    </Link>
  );
}
