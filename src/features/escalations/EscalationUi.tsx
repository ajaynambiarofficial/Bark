import { AlertTriangle, CheckCircle2, Clock3, X } from "lucide-react";
import { useEffect, useId, useRef, type PropsWithChildren, type ReactNode } from "react";
import { Button } from "../../components/ui/Button";
import type { Escalation, EscalationPriority, EscalationStatus, EscalationTier, SlaState } from "./escalation.types";

const statusStyles: Record<EscalationStatus, string> = {
  New: "bg-info-soft text-info", Assigned: "bg-brand-soft text-brand-strong", "In Progress": "bg-warning-soft text-warning",
  "Awaiting Response": "bg-warning-soft text-warning", Resolved: "bg-success-soft text-success", Closed: "bg-subtle text-secondary", Reopened: "bg-error-soft text-error",
};
const priorityStyles: Record<EscalationPriority, string> = {
  Standard: "bg-subtle text-secondary", P1: "bg-error-soft text-error", P2: "bg-warning-soft text-warning", P3: "bg-info-soft text-info",
};

export function StatusBadge({ status }: { status: EscalationStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[status]}`}>{status}</span>;
}

export function PriorityBadge({ priority }: { priority: EscalationPriority }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${priorityStyles[priority]}`}>{priority}</span>;
}

export function TierBadge({ tier }: { tier: EscalationTier }) {
  return <span className="inline-flex rounded-full border border-default bg-elevated px-2.5 py-1 text-xs font-semibold text-secondary">Tier {tier}</span>;
}

export function getSlaState(item: Escalation): SlaState {
  if (item.resolvedAt) return new Date(item.resolvedAt) <= new Date(item.slaDueAt) ? "met" : "breached";
  const remaining = new Date(item.slaDueAt).getTime() - Date.now();
  if (remaining <= 0) return "breached";
  if (remaining <= item.slaTargetMinutes * 60_000 * 0.25) return "due-soon";
  return "healthy";
}

export function formatSlaRemaining(item: Escalation) {
  const state = getSlaState(item);
  if (state === "met") return "Met";
  if (state === "breached" && item.resolvedAt) return "Breached";
  const difference = Math.abs(new Date(item.slaDueAt).getTime() - Date.now());
  const minutes = Math.max(1, Math.round(difference / 60_000));
  const label = minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
  return state === "breached" ? `${label} overdue` : label;
}

export function SlaIndicator({ item }: { item: Escalation }) {
  const state = getSlaState(item);
  const Icon = state === "breached" ? AlertTriangle : state === "met" ? CheckCircle2 : Clock3;
  const styles = state === "breached" ? "text-error" : state === "due-soon" ? "text-warning" : state === "met" ? "text-success" : "text-secondary";
  return <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${styles}`}><Icon size={14} aria-hidden="true" />{formatSlaRemaining(item)}</span>;
}

interface ModalProps extends PropsWithChildren {
  open: boolean;
  title: string;
  description?: string;
  onClose(): void;
  footer?: ReactNode;
}

export function Modal({ open, title, description, onClose, footer, children }: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
      if (event.key !== "Tab") return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      const first = focusable.item(0);
      const last = focusable.item(focusable.length - 1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); previous?.focus(); };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-overlay p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-[var(--radius-lg)] border border-default bg-elevated shadow-[var(--shadow-menu)]">
        <div className="flex items-start justify-between gap-4 border-b border-default px-5 py-4">
          <div><h2 id={titleId} className="text-lg font-semibold text-primary">{title}</h2>{description && <p id={descriptionId} className="mt-1 text-sm text-secondary">{description}</p>}</div>
          <button ref={closeRef} type="button" onClick={onClose} className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)] text-muted hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" aria-label={`Close ${title}`}><X size={18} /></button>
        </div>
        <div className="px-5 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-default px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export const fieldClass = "min-h-11 w-full rounded-[var(--radius-control)] border border-default bg-input px-3 text-sm text-primary outline-none transition-colors hover:border-input-hover focus:border-focus focus:ring-2 focus:ring-focus-soft disabled:cursor-not-allowed disabled:bg-subtle disabled:text-muted";
export const labelClass = "mb-1.5 block text-sm font-semibold text-primary";
export const secondaryButton = <Button variant="secondary">Cancel</Button>;
