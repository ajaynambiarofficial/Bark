import { Award, Target } from "lucide-react";
import { Card } from "../ui/Card";

const goals = [
  { period: "Today", actual: 19 as number | null, target: 23.9 as number | null, targetLabel: "24", source: "Today Snapshot · 13:59 IST" },
  { period: "This week", actual: null as number | null, target: 144 as number | null, targetLabel: "144", source: "622 ÷ 26 workdays × 6" },
  { period: "This month", actual: 305 as number | null, target: 622 as number | null, targetLabel: "622", source: "MTD · 15:14 IST" },
];

function GoalProgress({ period, actual, target, targetLabel, source }: (typeof goals)[number]) {
  const configured = target !== null && target > 0;
  const hasActual = actual !== null;
  const progress = configured && hasActual ? Math.min(actual / target, 1) : 0;
  const circumference = 2 * Math.PI * 17;

  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-control)] bg-subtle/60 p-3">
      <div className="relative grid size-11 shrink-0 place-items-center" role="img" aria-label={configured && hasActual ? `${period}: ${actual} of ${targetLabel} bookings` : `${period} goal ${targetLabel} bookings, actual unavailable`}>
        <svg viewBox="0 0 40 40" className="absolute inset-0 size-11 -rotate-90" aria-hidden="true">
          <circle cx="20" cy="20" r="17" fill="none" stroke="var(--border-default)" strokeWidth="4" />
          <circle cx="20" cy="20" r="17" fill="none" stroke="var(--brand-primary)" strokeWidth="4" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} />
        </svg>
        <span className="text-[10px] font-bold tabular-nums text-primary">{hasActual ? `${Math.round(progress * 100)}%` : "—"}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-primary">{period}</p>
        {hasActual ? <p className="mt-0.5 text-xs text-secondary">{actual} of {targetLabel} bookings</p> : <p className="mt-0.5 text-xs text-muted">Goal {targetLabel} · actual unavailable</p>}
        <p className="mt-0.5 text-[10px] text-muted">{source}</p>
      </div>
    </div>
  );
}

export function BookingGoalTracker() {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex shrink-0 items-center gap-2 lg:w-44">
          <span className="grid size-9 place-items-center rounded-full bg-brand-soft text-brand-strong"><Target size={18} aria-hidden="true" /></span>
          <div><h2 className="text-sm font-semibold text-primary">My booking goals</h2><p className="text-[11px] text-muted">Progress tracker</p></div>
        </div>
        <div className="grid flex-1 gap-2 sm:grid-cols-3">
          {goals.map((goal) => <GoalProgress key={goal.period} {...goal} />)}
        </div>
        <div className="flex items-start gap-2 border-t border-default pt-3 text-[11px] leading-4 text-muted lg:w-64 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
          <Award size={17} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
          <span><strong className="font-semibold text-primary">November incentive</strong><br />Qualify at 357 walk-ins (85% of 420). Payout per show: ₹20 at 85–&lt;90%, ₹25 at 90–&lt;100%, ₹30 at 100%+. Below 85%: no payout.</span>
        </div>
      </div>
    </Card>
  );
}
