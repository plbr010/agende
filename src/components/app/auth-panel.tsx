import type { ReactNode } from "react";

export function AuthPanel({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div>
        {eyebrow ? (
          <p className="text-xs font-semibold tracking-[0.16em] text-wine-deep uppercase">{eyebrow}</p>
        ) : null}
        <h1 className="mt-2 font-serif text-3xl leading-tight text-wine-deep">{title}</h1>
        {description ? <p className="mt-2 text-muted-foreground">{description}</p> : null}
      </div>
      <div className="agende-panel rounded-[1.5rem] p-5 ring-1 ring-[#f0e4de] sm:p-6">{children}</div>
      {footer}
    </div>
  );
}
