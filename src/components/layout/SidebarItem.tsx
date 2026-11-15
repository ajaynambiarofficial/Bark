import type { LucideIcon } from "lucide-react";
import { NavLink } from "react-router";

interface SidebarItemProps {
  to: string;
  label: string;
  icon: LucideIcon;
  collapsed: boolean;
  onNavigate?: () => void;
}

export function SidebarItem({ to, label, icon: Icon, collapsed, onNavigate }: SidebarItemProps) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `group relative flex min-h-11 items-center rounded-[var(--radius-control)] text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
          collapsed ? "justify-center px-0" : "gap-3 px-3"
        } ${isActive ? "bg-active text-brand-strong" : "text-sidebar-muted hover:bg-hover hover:text-primary"}`
      }
    >
      <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
      {!collapsed && <span>{label}</span>}
    </NavLink>
  );
}
