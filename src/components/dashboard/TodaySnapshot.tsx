import { ArrowUpRight, CalendarDays, Clock3, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { dataSources } from "../../config/data-sources";
import { loadTodaySnapshot, type TodaySnapshotData } from "../../features/dashboard/today-snapshot.service";
import { Card } from "../ui/Card";

const refreshIntervalMs = 2 * 60 * 1000;
const workbookUrl = `https://docs.google.com/spreadsheets/d/${dataSources.dashboardSheets.bookingsForDay.spreadsheetId}/edit?usp=sharing`;

export function TodaySnapshot() {
  const [snapshot, setSnapshot] = useState<TodaySnapshotData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const refresh = () => {
      setLoading(true);
      void loadTodaySnapshot(controller.signal).then((result) => {
        if (active) { setSnapshot(result); setError(false); }
      }).catch(() => { if (active && !controller.signal.aborted) setError(true); }).finally(() => { if (active && !controller.signal.aborted) setLoading(false); });
    };
    refresh();
    const interval = window.setInterval(refresh, refreshIntervalMs);
    return () => { active = false; controller.abort(); window.clearInterval(interval); };
  }, [refreshKey]);

  const staff = snapshot?.clinicStaff ?? [];
  const maximum = Math.max(1, ...staff.map((member) => member.count));
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-default px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-strong">Daily operations</p>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-primary">Today’s booking snapshot</h2>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} aria-hidden="true" />{snapshot?.date ?? "Loading…"}</span>
            <span className="inline-flex items-center gap-1.5"><Clock3 size={14} aria-hidden="true" />Updated {snapshot?.updatedAt ?? "—"}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 self-start sm:self-auto">
          <button type="button" onClick={() => setRefreshKey((key) => key + 1)} disabled={loading} aria-label="Refresh bookings from source sheet" className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-[var(--radius-control)] border border-default bg-elevated px-3 text-secondary transition-colors hover:bg-hover hover:text-primary disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"><RefreshCw size={16} className={loading ? "animate-spin" : ""} aria-hidden="true" /></button>
          <a href={workbookUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-default bg-elevated px-3 text-sm font-semibold text-secondary transition-colors hover:bg-hover hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">Open source sheet <ArrowUpRight size={16} aria-hidden="true" /></a>
        </div>
      </div>
      {error && <p role="status" className="border-b border-warning/30 bg-warning-soft px-5 py-2 text-xs text-warning sm:px-6">The sheet could not be refreshed. Showing the last available data.</p>}
      <div className="grid gap-px bg-default sm:grid-cols-3">
        {[{ label: "Total bookings", count: snapshot?.total, tone: "bg-brand-soft text-brand-strong" }, { label: "Clinic", count: snapshot?.clinic, tone: "bg-info-soft text-info" }, { label: "UCJ", count: snapshot?.ucj, tone: "bg-subtle text-secondary" }].map((metric) => <div key={metric.label} className="bg-surface px-5 py-4 sm:px-6"><p className="text-sm text-secondary">{metric.label}</p><p className="mt-1 flex items-baseline gap-2 text-2xl font-semibold tracking-tight text-primary">{metric.count ?? "—"}<span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${metric.tone}`}>today</span></p></div>)}
      </div>
      <div className="px-5 py-5 sm:px-6 sm:py-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><h3 className="text-sm font-semibold text-primary">Clinic bookings by staff</h3><p className="mt-1 text-xs text-muted">{snapshot ? `${staff.length} staff with bookings` : "Loading staff bookings…"}</p></div><span className="text-xs font-medium text-muted">Bookings</span></div>
        <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">{staff.map(({ email, count }) => <div key={email}><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="min-w-0 truncate font-medium text-secondary" title={email}>{email}</span><span className="shrink-0 font-semibold tabular-nums text-primary">{count}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-subtle" role="img" aria-label={`${count} bookings for ${email}`}><div className="h-full rounded-full bg-brand" style={{ width: `${(count / maximum) * 100}%` }} /></div></div>)}</div>
        <p className="mt-5 border-t border-default pt-4 text-xs leading-5 text-muted">Source: “Today Snapshot” tab in the CX Clinic Dashboard workbook. Refreshes automatically every 2 minutes.</p>
      </div>
    </Card>
  );
}
