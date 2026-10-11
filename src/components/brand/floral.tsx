import { cn } from "@/lib/utils";

export function FloralSprig({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 160 240"
      fill="none"
      className={cn("text-[var(--rose)]", className)}
    >
      <path
        d="M78 228c8-38 6-78-8-112-12-28-14-62 4-96"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M74 176c-28-6-48-24-52-46 22 2 40 16 52 46Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M78 148c26-2 46-18 54-40-24 4-42 18-54 40Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M70 112c-24 2-42 16-48 36 20-6 36-16 48-36Z"
        stroke="var(--peach)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M76 84c22-8 40-8 54 4-16 10-34 12-54-4Z"
        stroke="var(--peach)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M72 52c-18 6-30 20-32 36 16-8 28-18 32-36Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
