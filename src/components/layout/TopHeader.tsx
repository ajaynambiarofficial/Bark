import { Menu } from "lucide-react";
import { useLocation } from "react-router";
import { UserProfileMenu } from "./UserProfileMenu";

interface TopHeaderProps {
  onOpenMobile(): void;
}

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  "/welcome": { title: "Home", subtitle: "Your Bark workspace" },
  "/bookings": { title: "Bookings", subtitle: "Bookings workspace" },
  "/calendar": { title: "Calendar", subtitle: "Team schedule" },
  "/guide": { title: "Guide", subtitle: "Escalations guide" },
  "/team-email": { title: "Team Email", subtitle: "Draft and send team updates" },
  "/pawcare/booking": { title: "Booking", subtitle: "Pawcare" },
  "/pawcare/appointments": { title: "Appointments", subtitle: "Pawcare" },
  "/pawcare/quotes": { title: "Quote generator", subtitle: "Pawcare" },
  "/pawcare/chat": { title: "Clinic Chat", subtitle: "Pawcare" },
  "/pawcare/pharmacy": { title: "Pharmacy", subtitle: "Pawcare" },
  "/pawcare/diagnostics": { title: "Diagnostics", subtitle: "Pawcare" },
  "/escalations": { title: "Escalations", subtitle: "Operational coordination" },
};

export function TopHeader({ onOpenMobile }: TopHeaderProps) {
  const location = useLocation();
  const current = location.pathname.startsWith("/escalations")
    ? pageMeta["/escalations"]!
    : pageMeta[location.pathname] ?? { title: "Bark", subtitle: "Supertails operations" };

  return (
    <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-default bg-header px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobile}
          className="grid size-10 place-items-center rounded-[var(--radius-control)] text-secondary hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus lg:hidden"
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>
        <div>
          <p className="text-sm font-semibold text-primary">{current.title}</p>
          <p className="hidden text-xs text-muted sm:block">{current.subtitle}</p>
        </div>
      </div>
      <UserProfileMenu />
    </header>
  );
}
