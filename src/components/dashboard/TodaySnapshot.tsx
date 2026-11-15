import { ArrowUpRight, CalendarDays, Clock3 } from "lucide-react";
import { Card } from "../ui/Card";

const snapshot = {
  date: "13 Nov 2026 (Friday)",
  updatedAt: "2026-11-13 14:03 IST",
  total: 92,
  clinic: 92,
  ucj: 0,
  clinicStaff: [
    { email: "ajay.nlovespets@supertails.in", count: 22 },
    { email: "susan.falovespets@supertails.com", count: 15 },
    { email: "shruthi.gslovespets@supertails.com", count: 11 },
    { email: "shruti.vishwakarma@srcomsoft.co.in", count: 9 },
    { email: "taiseen.mlovespets@supertails.com", count: 7 },
    { email: "shristi.kesharwani@srcomsoft.co.in", count: 7 },
    { email: "hashim.mdlovespets@supertails.in", count: 6 },
    { email: "rabiya.mdlovespets@supertails.in", count: 5 },
    { email: "namantiwari@starwalkspl.com", count: 5 },
    { email: "shobhita.dubey@srcomsoft.co.in", count: 2 },
    { email: "nkumar.klovespets@supertails.in", count: 2 },
    { email: "gaurav.glovespets@supertails.in", count: 1 },
  ],
};

const workbookUrl = "https://docs.google.com/spreadsheets/d/1EyTmbBSkZMvL5JolKuo8xxOkguYGUKpTJTzlN68n5hM/edit?usp=sharing";

export function TodaySnapshot() {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-default px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-strong">Daily operations</p>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-primary">Today’s booking snapshot</h2>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} aria-hidden="true" />{snapshot.date}</span>
            <span className="inline-flex items-center gap-1.5"><Clock3 size={14} aria-hidden="true" />Updated {snapshot.updatedAt}</span>
          </div>
        </div>
        <a href={workbookUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 self-start rounded-[var(--radius-control)] border border-default bg-elevated px-3 text-sm font-semibold text-secondary transition-colors hover:bg-hover hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:self-auto">
          Open source sheet <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </div>

      <div className="grid gap-px bg-default sm:grid-cols-3">
        {[
          { label: "Total bookings", count: snapshot.total, tone: "bg-brand-soft text-brand-strong" },
          { label: "Clinic", count: snapshot.clinic, tone: "bg-info-soft text-info" },
          { label: "UCJ", count: snapshot.ucj, tone: "bg-subtle text-secondary" },
        ].map((metric) => (
          <div key={metric.label} className="bg-surface px-5 py-4 sm:px-6">
            <p className="text-sm text-secondary">{metric.label}</p>
            <p className="mt-1 flex items-baseline gap-2 text-2xl font-semibold tracking-tight text-primary">
              {metric.count}<span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${metric.tone}`}>today</span>
            </p>
          </div>
        ))}
      </div>

      <div className="px-5 py-5 sm:px-6 sm:py-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-primary">Clinic bookings by staff</h3>
            <p className="mt-1 text-xs text-muted">{snapshot.clinicStaff.length} staff with bookings</p>
          </div>
          <span className="text-xs font-medium text-muted">Bookings</span>
        </div>
        <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
          {snapshot.clinicStaff.map(({ email, count }) => (
            <div key={email}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 truncate font-medium text-secondary" title={email}>{email}</span>
                <span className="shrink-0 font-semibold tabular-nums text-primary">{count}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-subtle" role="img" aria-label={`${count} bookings for ${email}`}>
                <div className="h-full rounded-full bg-brand" style={{ width: `${(count / Math.max(...snapshot.clinicStaff.map((staff) => staff.count))) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-5 border-t border-default pt-4 text-xs leading-5 text-muted">UCJ staff: no bookings yet. Source: “Today Snapshot” tab in the CX Clinic Dashboard workbook.</p>
      </div>
    </Card>
  );
}
