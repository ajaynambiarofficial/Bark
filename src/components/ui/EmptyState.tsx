import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-info-soft text-info" aria-hidden="true">
        <Icon size={26} strokeWidth={1.8} />
      </span>
      <h2 className="mt-5 text-xl font-semibold tracking-[-0.025em] text-primary">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-secondary">{description}</p>
    </div>
  );
}
