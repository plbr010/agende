import { cn } from "@/lib/utils";

export function FloralSprig({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 160 240" fill="none" className={cn("text-[var(--rose)]", className)}>
      <path d="M78 228c8-38 6-78-8-112-12-28-14-62 4-96" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M74 176c-28-6-48-24-52-46 22 2 40 16 52 46Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M78 148c26-2 46-18 54-40-24 4-42 18-54 40Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M70 112c-24 2-42 16-48 36 20-6 36-16 48-36Z" stroke="var(--peach)" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M76 84c22-8 40-8 54 4-16 10-34 12-54-4Z" stroke="var(--peach)" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M72 52c-18 6-30 20-32 36 16-8 28-18 32-36Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

export function FloralBranch({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 280 360" fill="none" className={cn("text-[var(--peach)]", className)}>
      <path d="M48 340c28-70 40-130 28-188 10-46 38-92 92-128" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.9" />
      <path d="M86 250c-38-8-70-36-78-72 40 8 70 32 78 72Z" fill="currentColor" opacity="0.35" />
      <path d="M110 210c42-6 78-34 92-72-44 10-76 36-92 72Z" fill="#e8b4a0" opacity="0.55" />
      <path d="M128 168c-36 4-64 28-74 62 32-12 56-32 74-62Z" fill="#c45d7c" opacity="0.22" />
      <path d="M142 128c40-18 74-16 102 8-28 18-62 22-102-8Z" fill="currentColor" opacity="0.5" />
      <path d="M168 84c-30 10-52 34-56 62 28-14 48-32 56-62Z" fill="#f3c4c2" opacity="0.7" />
      <path d="M196 52c26-16 52-14 70 6-22 16-46 18-70-6Z" fill="#e8b4a0" opacity="0.65" />
      <ellipse cx="214" cy="36" rx="10" ry="14" fill="#c45d7c" opacity="0.35" />
    </svg>
  );
}

export function FloralCorner({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 220 180" fill="none" className={cn(className)}>
      <path d="M12 168c36-18 70-22 108-8 28 10 62 8 88-18" stroke="#e8b4a0" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M40 150c-8-28 4-52 28-64-4 28 8 48-28 64Z" fill="#e8b4a0" opacity="0.55" />
      <path d="M78 138c12-32 40-46 68-42-18 24-40 36-68 42Z" fill="#f3c4c2" opacity="0.7" />
      <path d="M126 128c18-26 48-34 76-22-24 18-50 24-76 22Z" fill="#c45d7c" opacity="0.28" />
      <path d="M54 112c-16-22-8-48 14-62-2 24 12 42-14 62Z" fill="#e8b4a0" opacity="0.4" />
    </svg>
  );
}
