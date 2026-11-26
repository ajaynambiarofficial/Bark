import { Check, ChevronDown, ChevronLeft, HelpCircle, LogOut, Monitor, Moon, Settings, Sun, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../auth/AuthContext";
import { useTheme } from "../../theme/ThemeContext";
import type { ColorTheme, ThemePreference } from "../../theme/ThemeContext";
import { Avatar } from "../ui/Avatar";
import packageJson from "../../../package.json";

const appearanceOptions: readonly {
  value: ThemePreference;
  label: string;
  icon: typeof Sun;
}[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

const colorThemes: readonly { value: ColorTheme; label: string; color: string }[] = [
  { value: "bark", label: "Bark Green", color: "#1f754d" },
  { value: "ocean", label: "Ocean Blue", color: "#1d6b87" },
  { value: "violet", label: "Violet", color: "#6952a3" },
  { value: "amber", label: "Amber", color: "#ad5b24" },
];

export function UserProfileMenu() {
  const { employee, signOut } = useAuth();
  const { preference, setPreference, colorTheme, setColorTheme } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setSettingsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!employee) return null;

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => { setOpen((current) => !current); setSettingsOpen(false); }}
        aria-label={`Open profile menu for ${employee.displayName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        data-tour="profile-menu"
        className="flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] px-1.5 py-1 text-left transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:pr-2.5"
      >
        <Avatar name={employee.displayName} size="sm" src="/api/auth/profile/avatar" />
        <span className="hidden max-w-32 truncate text-sm font-medium text-primary sm:block">{employee.displayName}</span>
        <ChevronDown size={15} className={`hidden text-muted transition-transform sm:block ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          aria-label={settingsOpen ? "Settings" : "Employee profile menu"}
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 max-h-[min(80vh,38rem)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-[var(--radius-lg)] border border-default bg-elevated shadow-[var(--shadow-menu)]"
        >
          <div className="border-b border-default p-4">
            <div className="flex items-center gap-3">
              <Avatar name={employee.displayName} src="/api/auth/profile/avatar" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-primary">{employee.displayName}</p>
                <p className="mt-0.5 truncate text-xs text-secondary">{employee.email}</p>
              </div>
            </div>
            <div className="mt-3 rounded-[var(--radius-sm)] bg-subtle px-3 py-2">
              <p className="text-xs font-medium text-primary">{employee.roleLabel}</p>
              <p className="mt-0.5 text-xs text-muted">{employee.assignment}</p>
            </div>
          </div>

          {settingsOpen ? (
            <>
              <div className="flex items-center justify-between border-b border-default px-3 py-2.5">
                <button type="button" onClick={() => setSettingsOpen(false)} className="grid size-9 place-items-center rounded-[var(--radius-sm)] text-secondary hover:bg-hover hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" aria-label="Back to profile menu"><ChevronLeft size={18} /></button>
                <h2 className="text-sm font-semibold text-primary">Settings</h2>
                <span className="w-9" aria-hidden="true" />
              </div>
              <div className="border-b border-default px-4 py-3">
                <p className="text-xs text-muted">App version</p>
                <p className="mt-0.5 text-sm font-medium text-primary">v{packageJson.version}</p>
              </div>
              <div className="p-3">
                <p className="px-1 pb-2 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Theme mode</p>
                <div role="radiogroup" aria-label="Theme mode" className="grid grid-cols-3 gap-1">
                  {appearanceOptions.map(({ value, label, icon: Icon }) => {
                    const selected = preference === value;
                    return (
                      <button key={value} type="button" role="radio" aria-checked={selected} onClick={() => setPreference(value)} className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-[var(--radius-sm)] text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${selected ? "bg-active text-brand-strong" : "text-secondary hover:bg-hover hover:text-primary"}`}>
                        <Icon size={17} aria-hidden="true" /><span>{label}</span>
                        {selected && <Check size={11} className="absolute right-1.5 top-1.5" aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
                <p className="px-1 pb-2 pt-4 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Color theme</p>
                <div role="radiogroup" aria-label="Color theme" className="grid grid-cols-2 gap-1.5">
                  {colorThemes.map(({ value, label, color }) => {
                    const selected = colorTheme === value;
                    return <button key={value} type="button" role="radio" aria-checked={selected} onClick={() => setColorTheme(value)} className={`flex min-h-10 items-center gap-2 rounded-[var(--radius-sm)] px-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${selected ? "bg-active text-brand-strong" : "text-secondary hover:bg-hover hover:text-primary"}`}><span className="size-4 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: color }} aria-hidden="true" />{label}{selected && <Check size={13} className="ml-auto" aria-hidden="true" />}</button>;
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="p-2">
              <button type="button" onClick={() => { setOpen(false); window.dispatchEvent(new Event("bark:start-product-tour")); }} className="flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 text-sm font-medium text-secondary transition-colors hover:bg-hover hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                <HelpCircle size={17} aria-hidden="true" /><span className="flex-1 text-left">Take a product tour</span>
              </button>
              <button type="button" onClick={() => { setOpen(false); navigate("/profile"); }} className="flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 text-sm font-medium text-secondary transition-colors hover:bg-hover hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                <UserRound size={17} aria-hidden="true" /><span className="flex-1 text-left">Edit profile</span>
              </button>
              <button type="button" onClick={() => setSettingsOpen(true)} className="flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 text-sm font-medium text-secondary transition-colors hover:bg-hover hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                <Settings size={17} aria-hidden="true" />
                <span className="flex-1 text-left">Settings</span>
                <span className="text-xs text-muted">v{packageJson.version}</span>
              </button>
            </div>
          )}

          <div className="border-t border-default p-2">
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="flex min-h-10 w-full items-center gap-2 rounded-[var(--radius-sm)] px-3 text-sm font-medium text-secondary transition-colors hover:bg-error-soft hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <LogOut size={17} aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
