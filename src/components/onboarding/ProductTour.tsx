import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { canSendTeamEmail } from "../../auth/teamEmailAccess";
import { APP_MODULES } from "../../../shared/app-modules";
import type { AppModuleKey } from "../../../shared/app-modules";
import { useModuleVisibility } from "../../modules/ModuleVisibilityContext";

interface TourStep { title: string; description: string; target: string | null }
interface TargetRect { top: number; left: number; right: number; bottom: number; width: number; height: number }

const descriptions: Record<AppModuleKey, string> = {
  "team.home": "Your starting point: check the team dashboard and operational snapshot.",
  "team.bookings": "Create and track bookings from the shared team queue.",
  "team.calendar": "See the team schedule and upcoming work in one place.",
  "team.escalations": "Raise and follow escalations, report bugs, and submit feature requests.",
  "team.guide": "Look up service and package details, clinic contacts, and locations.",
  "team.notice-board": "Read company updates, acknowledge important notices, and comment.",
  "team.team-email": "Eligible team leads and managers can draft updates and email selected staff.",
  "pawcare.booking": "Book Pawcare services and check customer and package details.",
  "pawcare.appointments": "Review appointments, update their status, and reschedule work.",
  "pawcare.quotes": "Prepare and save service estimates for customers.",
  "pawcare.chat": "Coordinate with the clinic operations team.",
  "pawcare.pharmacy": "Open pharmacy tools and information.",
  "pawcare.diagnostics": "Find diagnostic service and result information.",
};

const completedKey = (employeeId: string) => `bark.product-tour.v1.completed.${employeeId}`;

export function ProductTour({ onOpenMobileNav, onCloseMobileNav }: { onOpenMobileNav(): void; onCloseMobileNav(): void }) {
  const { employee } = useAuth();
  const employeeId = employee?.id;
  const employeeRole = employee?.role;
  const { isEnabled, isLoading } = useModuleVisibility();
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const launchedFor = useRef<string | null>(null);

  const steps = useMemo<TourStep[]>(() => {
    const visibleModules = APP_MODULES.filter((module) => isEnabled(module.key) && (module.key !== "team.team-email" || (employeeRole ? canSendTeamEmail(employeeRole) : false)));
    const tourSteps: TourStep[] = [{ title: "Welcome to Bark", description: "This quick tour shows you the main sections of your workspace. Use Next to move through it, or skip and replay the tour later from your profile menu.", target: null }];
    for (const module of visibleModules) {
      if (module.group === "Pawcare" && !tourSteps.some((step) => step.target === "pawcare-heading")) {
        tourSteps.push({ title: "Pawcare workspace", description: "Pawcare tools for bookings, clinic appointments, estimates, chat, pharmacy, and diagnostics are grouped here.", target: "pawcare-heading" });
      }
      tourSteps.push({ title: module.label, description: descriptions[module.key], target: module.key });
      if (module.key === "team.team-email" && (employeeRole === "god" || employeeRole === "system-administrator")) {
        tourSteps.push({ title: "Admin Control", description: "Manage users, review escalations, configure services, and control which sections staff can see.", target: "admin-control" });
      }
    }
    if ((employeeRole === "god" || employeeRole === "system-administrator") && !tourSteps.some((step) => step.target === "admin-control")) {
      const firstPawcare = tourSteps.findIndex((step) => step.target === "pawcare-heading");
      tourSteps.splice(firstPawcare >= 0 ? firstPawcare : tourSteps.length, 0, { title: "Admin Control", description: "Manage users, review escalations, configure services, and control which sections staff can see.", target: "admin-control" });
    }
    tourSteps.push({ title: "Your profile and settings", description: "Update your profile, choose a theme, and reopen this tour whenever you need it.", target: "profile-menu" });
    return tourSteps;
  }, [employeeRole, isEnabled]);

  const close = useCallback(() => {
    setOpen(false);
    if (employeeId) {
      try { window.localStorage.setItem(completedKey(employeeId), "true"); } catch { /* Tour can still close if storage is unavailable. */ }
    }
    onCloseMobileNav();
  }, [employeeId, onCloseMobileNav]);

  const start = useCallback(() => {
    setStepIndex(0);
    setOpen(true);
    if (window.innerWidth < 1024) onOpenMobileNav();
  }, [onOpenMobileNav]);

  useEffect(() => {
    if (!employeeId || isLoading || launchedFor.current === employeeId) return;
    let completed = false;
    try { completed = window.localStorage.getItem(completedKey(employeeId)) === "true"; } catch { /* Fall through to a first-session guide. */ }
    if (!completed) {
      const timer = window.setTimeout(() => {
        launchedFor.current = employeeId;
        start();
      }, 650);
      return () => window.clearTimeout(timer);
    }
    launchedFor.current = employeeId;
  }, [employeeId, isLoading, start]);

  useEffect(() => {
    const openTour = () => start();
    window.addEventListener("bark:start-product-tour", openTour);
    return () => window.removeEventListener("bark:start-product-tour", openTour);
  }, [start]);

  useEffect(() => {
    if (!open) return;
    const updateViewport = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") setStepIndex((index) => Math.min(index + 1, steps.length - 1));
      if (event.key === "ArrowLeft") setStepIndex((index) => Math.max(0, index - 1));
    };
    window.addEventListener("resize", updateViewport);
    window.addEventListener("keydown", onKeyDown);
    nextButtonRef.current?.focus();
    return () => {
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [close, open, steps.length]);

  useEffect(() => {
    if (!open) return;
    const targetId = steps[stepIndex]?.target;
    if (!targetId) { setTargetRect(null); return; }
    const target = document.querySelector<HTMLElement>(`[data-tour="${CSS.escape(targetId)}"]`);
    if (!target) { setTargetRect(null); return; }
    target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    const measure = () => {
      const rect = target.getBoundingClientRect();
      setTargetRect({ top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height });
    };
    const timer = window.setTimeout(measure, 80);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, stepIndex, steps]);

  if (!open || !steps.length) return null;
  const step = steps[stepIndex]!;
  const isLast = stepIndex === steps.length - 1;
  const wide = viewport.width > 760;
  let cardStyle: React.CSSProperties;
  if (!targetRect) {
    cardStyle = { width: Math.min(420, viewport.width - 32), left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  } else if (!wide) {
    cardStyle = { width: viewport.width - 32, left: 16, bottom: 16 };
  } else {
    const cardWidth = Math.min(370, viewport.width - 32);
    const left = targetRect.right + cardWidth + 24 <= viewport.width ? targetRect.right + 16 : Math.max(16, targetRect.left - cardWidth - 16);
    const top = Math.max(16, Math.min(targetRect.top - 10, viewport.height - 300));
    cardStyle = { width: cardWidth, left, top };
  }

  return createPortal(<>
    <div className={`fixed inset-0 z-[1000] ${targetRect ? "bg-transparent" : "bg-black/60"}`} aria-hidden="true" />
    {targetRect && <div aria-hidden="true" className="pointer-events-none fixed z-[1001] rounded-lg border-2 border-brand bg-transparent transition-all duration-200" style={{ top: targetRect.top - 4, left: targetRect.left - 4, width: targetRect.width + 8, height: targetRect.height + 8, boxShadow: "0 0 0 9999px rgba(0,0,0,.62)" }} />}
    <section role="dialog" aria-modal="true" aria-labelledby="product-tour-title" aria-describedby="product-tour-description" className="fixed z-[1002] rounded-xl border border-default bg-elevated p-5 text-primary shadow-2xl sm:p-6" style={cardStyle}>
      <div className="flex items-start justify-between gap-3"><span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">Bark workspace tour · {stepIndex + 1} of {steps.length}</span><button type="button" onClick={close} aria-label="Close product tour" className="grid size-8 shrink-0 place-items-center rounded-md text-muted hover:bg-hover hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"><X size={17} /></button></div>
      <h2 id="product-tour-title" className="mt-3 text-xl font-semibold tracking-tight">{step.title}</h2>
      <p id="product-tour-description" className="mt-2 text-sm leading-6 text-secondary">{step.description}</p>
      <div className="mt-5 flex items-center justify-between gap-3"><button type="button" onClick={close} className="min-h-10 rounded-lg px-3 text-sm font-medium text-secondary hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">Skip tour</button><div className="flex gap-2"><button type="button" disabled={stepIndex === 0} onClick={() => setStepIndex((index) => Math.max(0, index - 1))} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-default px-3 text-sm font-medium text-secondary hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"><ArrowLeft size={15} />Back</button><button ref={nextButtonRef} type="button" onClick={() => isLast ? close() : setStepIndex((index) => index + 1)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">{isLast ? "Finish" : "Next"}{!isLast && <ArrowRight size={15} />}</button></div></div>
    </section>
  </>, document.body);
}
