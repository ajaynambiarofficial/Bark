import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-[var(--radius-lg)] border border-default bg-surface shadow-[var(--shadow-card)] ${className}`}
      {...props}
    />
  );
}
