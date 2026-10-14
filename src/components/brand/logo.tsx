import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

const MARK = {
  sm: "size-7",
  md: "size-9",
  lg: "size-12",
} as const;

const TYPE = {
  sm: "text-[1.35rem]",
  md: "text-[1.65rem]",
  lg: "text-4xl",
} as const;

export function BrandMark({
  className,
  size = "md",
}: {
  className?: string;
  size?: keyof typeof MARK;
}) {
  return (
    <Image
      src="/brand/logo-mark.png"
      alt=""
      width={size === "lg" ? 48 : size === "sm" ? 28 : 36}
      height={size === "lg" ? 48 : size === "sm" ? 28 : 36}
      className={cn(MARK[size], "rounded-[22%] shadow-[0_8px_18px_-12px_rgb(92_26_46/0.55)]", className)}
    />
  );
}

export function BrandLogo({
  className,
  size = "md",
  tone = "default",
  href = "/",
  compact = false,
}: {
  className?: string;
  size?: keyof typeof MARK;
  tone?: "default" | "light";
  href?: string;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label="Agendê"
      className={cn(
        "inline-flex min-h-11 items-center gap-2 font-serif tracking-tight",
        tone === "light" ? "text-[#fffaf8]" : "text-wine-deep",
        TYPE[size],
        className,
      )}
    >
      <BrandMark size={size} />
      {compact ? (
        <span className="sr-only">Agendê</span>
      ) : (
        <span>
          Agend<span className={cn("italic", tone === "light" ? "text-[#f3c4c2]" : "text-[var(--rose-ink)]")}>ê</span>
        </span>
      )}
    </Link>
  );
}
