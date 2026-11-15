import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-on-brand shadow-[var(--shadow-button)] hover:bg-brand-hover disabled:bg-disabled disabled:text-disabled-text",
  secondary: "border border-default bg-elevated text-primary hover:bg-hover disabled:text-disabled-text",
  ghost: "bg-transparent text-secondary hover:bg-hover hover:text-primary disabled:text-disabled-text",
};

export function Button({
  variant = "primary",
  icon,
  fullWidth = false,
  className = "",
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-app disabled:cursor-not-allowed ${variants[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
