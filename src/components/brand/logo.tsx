import Link from "next/link";
import { cn } from "@/lib/utils";

export function BrandLogo({
  className,
  size = "md",
  tone = "default",
  href = "/",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  tone?: "default" | "light";
  href?: string;
}) {
  const text =
    size === "lg" ? "text-4xl" : size === "sm" ? "text-xl" : "text-2xl";
  const mark = size === "lg" ? "size-7" : size === "sm" ? "size-4" : "size-5";

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 font-serif tracking-tight",
        tone === "light" ? "text-[#fffaf8]" : "text-foreground",
        text,
        className,
      )}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className={cn(mark, "shrink-0")}>
        <path
          d="M12 3c1.2 2.4 1.2 4.2 0 6.4C10.8 7.2 10.8 5.4 12 3Z"
          fill={tone === "light" ? "#e6a78f" : "#b95b76"}
        />
        <path
          d="M12 21c-1.2-2.4-1.2-4.2 0-6.4 1.2 2.2 1.2 4 0 6.4Z"
          fill={tone === "light" ? "#f3c8c7" : "#e6a78f"}
        />
        <path
          d="M3 12c2.4-1.2 4.2-1.2 6.4 0-2.2 1.2-4 1.2-6.4 0Z"
          fill={tone === "light" ? "#f3c8c7" : "#8e3a55"}
        />
        <path
          d="M21 12c-2.4 1.2-4.2 1.2-6.4 0 2.2-1.2 4-1.2 6.4 0Z"
          fill={tone === "light" ? "#e6a78f" : "#631d38"}
        />
      </svg>
      <span>
        Agend<span className={cn("italic", tone === "light" ? "text-[#e6a78f]" : "text-[var(--rose-ink)]")}>ê</span>
      </span>
    </Link>
  );
}
