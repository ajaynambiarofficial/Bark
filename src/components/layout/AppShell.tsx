import { useState } from "react";
import { Outlet } from "react-router";
import { useAuth } from "../../auth/AuthContext";
import { Sidebar } from "./Sidebar";
import { TopHeader } from "./TopHeader";

const SIDEBAR_KEY = "bark.sidebar.collapsed";

export function AppShell() {
  const { employee } = useAuth();
  const [collapsed, setCollapsed] = useState(() => window.localStorage.getItem(SIDEBAR_KEY) === "true");
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!employee) return null;

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_KEY, String(next));
      return next;
    });
  };

  const closeMobileNavigation = () => {
    setMobileOpen(false);
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>('[aria-label="Open navigation"]')?.focus();
    });
  };

  return (
    <div className="flex min-h-dvh bg-app text-primary">
      <Sidebar
        employee={employee}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapsed={toggleCollapsed}
        onCloseMobile={closeMobileNavigation}
      />
      <div className="min-w-0 flex-1">
        <TopHeader onOpenMobile={() => setMobileOpen(true)} />
        <main id="main-content" className="mx-auto w-full max-w-[1440px] px-4 py-7 sm:px-6 sm:py-9 lg:px-10 lg:py-11">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
