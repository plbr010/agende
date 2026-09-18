import Link from "next/link";
import { cn } from "@/lib/utils";

export function BrandLogo({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const text =
    size === "lg" ? "text-4xl" : size === "sm" ? "text-xl" : "text-2xl";

  return (
    <Link
      href="/"
      className={cn(
        "font-serif tracking-tight text-foreground",
        text,
        className,
      )}
    >
      Agend<span className="italic text-primary">ê</span>
    </Link>
  );
}
