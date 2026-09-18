"use client";

import Link from "next/link";

export function scrollToHash(href: string) {
  const hashIndex = href.indexOf("#");
  if (hashIndex < 0) return false;
  const hash = href.slice(hashIndex);
  const target = document.querySelector(hash);
  if (!target) return false;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  window.history.pushState(null, "", hash);
  return true;
}

export function MarketingHashLink({
  href,
  className,
  children,
  onClick,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={(event) => {
        if (href.includes("#") && window.location.pathname === "/") {
          if (scrollToHash(href)) {
            event.preventDefault();
          }
        }
        onClick?.();
      }}
    >
      {children}
    </Link>
  );
}
