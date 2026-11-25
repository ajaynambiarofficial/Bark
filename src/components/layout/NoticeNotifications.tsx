import { Bell, Check, ChevronRight, Megaphone } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useAuth } from "../../auth/AuthContext";
import { dataSources } from "../../config/data-sources";

type NoticeType = "general" | "important" | "reminder";
interface Notice { id: string; title: string; body: string; type: NoticeType; createdAt: string; acknowledgedByMe: boolean }
interface NoticeResponse { data?: { notices?: Notice[] }; error?: { message?: string } }

const apiBase = dataSources.internalApi.baseUrl;
const refreshIntervalMs = 2 * 60 * 1000;
const typeLabels: Record<NoticeType, string> = { general: "Update", important: "Important", reminder: "Reminder" };

async function loadNotices(signal: AbortSignal) {
  const response = await fetch(`${apiBase}/notices`, { credentials: "include", signal, headers: { Accept: "application/json" } });
  const result = await response.json().catch(() => null) as NoticeResponse | null;
  if (!response.ok) throw new Error(result?.error?.message ?? "Could not load notifications.");
  return result?.data?.notices ?? [];
}

export function NoticeNotifications() {
  const { employee } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!employee) return;
    let active = true;
    const controller = new AbortController();
    const refresh = () => {
      setLoading(true);
      void loadNotices(controller.signal)
        .then((items) => { if (active) { setNotices(items); setError(false); } })
        .catch((cause: unknown) => { if (active && cause instanceof Error && cause.name !== "AbortError") setError(true); })
        .finally(() => { if (active) setLoading(false); });
    };
    refresh();
    const interval = window.setInterval(refresh, refreshIntervalMs);
    return () => { active = false; controller.abort(); window.clearInterval(interval); };
  }, [employee]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("pointerdown", onPointerDown); document.removeEventListener("keydown", onKeyDown); };
  }, [open]);

  const unread = useMemo(() => notices.filter((notice) => !notice.acknowledgedByMe), [notices]);
  const preview = unread.slice(0, 4);

  if (!employee) return null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative grid size-10 place-items-center rounded-[var(--radius-control)] text-secondary transition-colors hover:bg-hover hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        aria-label={unread.length ? `${unread.length} unread notice${unread.length === 1 ? "" : "s"}` : "Notifications"}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Bell size={19} aria-hidden="true" />
        {unread.length > 0 && <span className="absolute right-1 top-1 grid min-w-4 translate-x-1/4 -translate-y-1/4 place-items-center rounded-full border-2 border-[var(--header-background)] bg-error px-1 text-[9px] font-bold leading-4 text-white" aria-hidden="true">{unread.length > 9 ? "9+" : unread.length}</span>}
      </button>

      {open && <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-[var(--radius-lg)] border border-default bg-elevated shadow-[var(--shadow-menu)]" role="dialog" aria-label="Notifications">
        <div className="flex items-center justify-between border-b border-default px-4 py-3">
          <div><h2 className="text-sm font-semibold text-primary">Notifications</h2><p className="mt-0.5 text-xs text-muted">Updates from the notice board</p></div>
          <span className="rounded-full bg-brand-soft px-2 py-1 text-[11px] font-semibold text-brand-strong">{unread.length} unread</span>
        </div>
        {loading && notices.length === 0 ? <div className="px-4 py-8 text-center text-sm text-secondary">Checking for notices…</div> : error && notices.length === 0 ? <div className="px-4 py-8 text-center text-sm text-secondary">Notifications are unavailable right now.</div> : preview.length === 0 ? <div className="flex flex-col items-center px-4 py-8 text-center"><span className="grid size-10 place-items-center rounded-full bg-success-soft text-success"><Check size={19} /></span><p className="mt-3 text-sm font-medium text-primary">You’re all caught up</p><p className="mt-1 text-xs text-secondary">New notice-board updates will appear here.</p></div> : <div className="divide-y divide-default">{preview.map((notice) => <button key={notice.id} type="button" onClick={() => { setOpen(false); navigate("/notice-board"); }} className="flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"><span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${notice.type === "important" ? "bg-error-soft text-error" : notice.type === "reminder" ? "bg-warning-soft text-warning" : "bg-info-soft text-info"}`}><Megaphone size={15} /></span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate text-sm font-semibold text-primary">{notice.title}</span><span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted">{typeLabels[notice.type]}</span></span><span className="mt-1 block line-clamp-2 text-xs leading-5 text-secondary">{notice.body}</span></span><ChevronRight size={15} className="mt-1 shrink-0 text-muted" /></button>)}</div>}
        <button type="button" onClick={() => { setOpen(false); navigate("/notice-board"); }} className="flex min-h-11 w-full items-center justify-between border-t border-default px-4 text-sm font-semibold text-brand-strong hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">View notice board <ChevronRight size={16} /></button>
      </div>}
    </div>
  );
}
