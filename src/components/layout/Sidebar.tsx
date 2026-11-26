import { AlertCircle, BookOpen, CalendarDays, ChevronsLeft, ChevronsRight, FileText, House, Mail, Megaphone, MessageCircle, Pill, Settings2, Stethoscope, TestTube, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BarkLogo } from "../brand/BarkLogo";
import { SidebarItem } from "./SidebarItem";
import type { Employee } from "../../types/auth";
import { Avatar } from "../ui/Avatar";
import { canSendTeamEmail } from "../../auth/teamEmailAccess";
import { useModuleVisibility } from "../../modules/ModuleVisibilityContext";

interface SidebarProps {
  employee: Employee;
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapsed(): void;
  onCloseMobile(): void;
}

export function Sidebar({
  employee,
  collapsed,
  mobileOpen,
  onToggleCollapsed,
  onCloseMobile,
}: SidebarProps) {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia("(min-width: 1024px)").matches);
  const asideRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const onChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!mobileOpen || isDesktop) return;

    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseMobile();
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = asideRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusableElements?.length) return;

      const firstElement = focusableElements.item(0);
      const lastElement = focusableElements.item(focusableElements.length - 1);
      if (!firstElement || !lastElement) return;

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isDesktop, mobileOpen, onCloseMobile]);

  const hiddenOnMobile = !isDesktop && !mobileOpen;
  const { isEnabled } = useModuleVisibility();
  const teamModules = [
    { key: "team.home" as const, to: "/welcome", label: "Home", icon: House },
    { key: "team.bookings" as const, to: "/bookings", label: "Bookings", icon: CalendarDays },
    { key: "team.calendar" as const, to: "/calendar", label: "Calendar", icon: CalendarDays },
    { key: "team.escalations" as const, to: "/escalations", label: "Escalations", icon: AlertCircle },
    { key: "team.guide" as const, to: "/guide", label: "Guide", icon: BookOpen },
    { key: "team.notice-board" as const, to: "/notice-board", label: "Notice Board", icon: Megaphone },
    ...(canSendTeamEmail(employee.role) ? [{ key: "team.team-email" as const, to: "/team-email", label: "Team Email", icon: Mail }] : []),
  ].filter((item) => isEnabled(item.key));
  const pawcareModules = [
    { key: "pawcare.booking" as const, to: "/pawcare/booking", label: "Booking", icon: Stethoscope },
    { key: "pawcare.appointments" as const, to: "/pawcare/appointments", label: "Appointments", icon: CalendarDays },
    { key: "pawcare.quotes" as const, to: "/pawcare/quotes", label: "Quote generator", icon: FileText },
    { key: "pawcare.chat" as const, to: "/pawcare/chat", label: "Clinic Chat", icon: MessageCircle },
    { key: "pawcare.pharmacy" as const, to: "/pawcare/pharmacy", label: "Pharmacy", icon: Pill },
    { key: "pawcare.diagnostics" as const, to: "/pawcare/diagnostics", label: "Diagnostics", icon: TestTube },
  ].filter((item) => isEnabled(item.key));
  const nav = (
    <>
      <div className="flex h-[72px] items-center justify-between border-b border-default px-4">
        <BarkLogo compact={collapsed} />
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onCloseMobile}
          className="grid size-10 place-items-center rounded-lg text-secondary hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus lg:hidden"
          aria-label="Close navigation"
        >
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 space-y-1.5 px-3 py-5" aria-label="Primary navigation">
        {teamModules.length > 0 && <>{!collapsed && <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Team</p>}{teamModules.map((item) => <SidebarItem key={item.key} to={item.to} label={item.label} icon={item.icon} collapsed={collapsed} onNavigate={onCloseMobile} tourId={item.key} />)}</>}
        {(employee.role === "god" || employee.role === "system-administrator") && <SidebarItem to="/admin" label="Admin Control" icon={Settings2} collapsed={collapsed} onNavigate={onCloseMobile} tourId="admin-control" />}
        {pawcareModules.length > 0 && <><div className="my-3 border-t border-default" aria-hidden="true" />{!collapsed && <p data-tour="pawcare-heading" className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Pawcare</p>}{pawcareModules.map((item) => <SidebarItem key={item.key} to={item.to} label={item.label} icon={item.icon} collapsed={collapsed} onNavigate={onCloseMobile} tourId={item.key} />)}</>}
      </nav>

      <div className="border-t border-default p-3">
        <div className={`flex items-center rounded-[var(--radius-control)] ${collapsed ? "justify-center" : "gap-3 px-2 py-2"}`}>
          <Avatar name={employee.displayName} size="sm" />
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-primary">{employee.displayName}</p>
              <p className="mt-0.5 truncate text-xs text-muted">{employee.roleLabel}</p>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className={`mt-2 hidden min-h-10 w-full items-center rounded-[var(--radius-control)] text-xs font-medium text-muted transition-colors hover:bg-hover hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus lg:flex ${collapsed ? "justify-center" : "gap-2 px-3"}`}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : undefined}
        >
          {collapsed ? <ChevronsRight size={17} /> : <><ChevronsLeft size={17} /><span>Collapse sidebar</span></>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-overlay lg:hidden"
          onClick={onCloseMobile}
          aria-label="Close navigation overlay"
        />
      )}
      <aside
        ref={asideRef}
        inert={hiddenOnMobile}
        aria-hidden={hiddenOnMobile}
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(86vw,260px)] flex-col border-r border-default bg-sidebar shadow-[var(--shadow-drawer)] transition-transform duration-200 motion-reduce:transition-none lg:static lg:z-auto lg:shadow-none ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "lg:w-[72px]" : "lg:w-[252px]"} lg:translate-x-0`}
      >
        {nav}
      </aside>
    </>
  );
}
