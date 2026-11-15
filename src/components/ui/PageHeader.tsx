import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="mb-2 text-xs font-semibold tracking-[0.08em] text-brand uppercase">{eyebrow}</p>}
        <h1 className="text-[clamp(1.65rem,3vw,2rem)] font-semibold tracking-[-0.035em] text-primary">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[15px] leading-6 text-secondary">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
