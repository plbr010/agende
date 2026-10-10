import { cn } from "@/lib/utils";

export function ContextualHint({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <p className={cn("text-sm leading-6 text-muted-foreground", className)}>{children}</p>;
}
