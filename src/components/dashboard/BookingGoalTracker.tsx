import { Award, Target } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { loadMonthlyShows, type MonthlyShowsData } from "../../features/dashboard/monthly-shows.service";
import { loadTodaySnapshot } from "../../features/dashboard/today-snapshot.service";
import { Card } from "../ui/Card";

interface Goal { period: string; actual: number | null; target: number | null; targetLabel: string; source: string }
type BookingPeriod = "today" | "week" | "month";
interface AssignedGoal { period: BookingPeriod | null; targetValue: string }

async function loadAssignedBookingGoals(signal: AbortSignal): Promise<AssignedGoal[]> {
  const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api";
  const response = await fetch(`${apiBase}/dashboard/my-goals`, { credentials: "include", signal });
  if (!response.ok) return [];
  const body = await response.json() as { data?: AssignedGoal[] };
  return body.data ?? [];
}

function GoalProgress({ period, actual, target, targetLabel, source }: Goal) {
  const configured = target !== null && target > 0;
  const hasActual = actual !== null;
  const progress = configured && hasActual ? Math.min(actual / target, 1) : 0;
  const circumference = 2 * Math.PI * 17;
  return <div className="flex items-center gap-3 rounded-[var(--radius-control)] bg-subtle/60 p-3"><div className="relative grid size-11 shrink-0 place-items-center" role="img" aria-label={configured && hasActual ? `${period}: ${actual} of ${targetLabel} bookings` : `${period} goal ${targetLabel} bookings, actual unavailable`}><svg viewBox="0 0 40 40" className="absolute inset-0 size-11 -rotate-90" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="none" stroke="var(--border-default)" strokeWidth="4" /><circle cx="20" cy="20" r="17" fill="none" stroke="var(--brand-primary)" strokeWidth="4" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} /></svg><span className="text-[10px] font-bold tabular-nums text-primary">{hasActual ? `${Math.round(progress * 100)}%` : "—"}</span></div><div className="min-w-0"><p className="text-xs font-semibold text-primary">{period}</p>{hasActual ? <p className="mt-0.5 text-xs text-secondary">{actual} of {targetLabel} bookings</p> : <p className="mt-0.5 text-xs text-muted">Goal {targetLabel} · actual unavailable</p>}<p className="mt-0.5 text-[10px] text-muted">{source}</p></div></div>;
}

export function BookingGoalTracker() {
  const { employee } = useAuth();
  const [todayActual, setTodayActual] = useState<number | null>(null);
  const [monthly, setMonthly] = useState<MonthlyShowsData | null>(null);
  const [assignedGoals, setAssignedGoals] = useState<AssignedGoal[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!employee) return undefined;
    let active = true;
    const controller = new AbortController();
    const refresh = () => {
      void Promise.all([loadTodaySnapshot(controller.signal), loadMonthlyShows(employee.email, controller.signal), loadAssignedBookingGoals(controller.signal).catch(() => [])]).then(([today, month, goals]) => {
        if (!active) return;
        setTodayActual(today.clinicStaff.find((staff) => staff.email.toLowerCase() === employee.email.toLowerCase())?.count ?? 0);
        setMonthly(month);
        setAssignedGoals(goals);
        setError(false);
      }).catch(() => { if (active && !controller.signal.aborted) setError(true); });
    };
    refresh();
    const interval = window.setInterval(refresh, 2 * 60 * 1000);
    return () => { active = false; controller.abort(); window.clearInterval(interval); };
  }, [employee]);

  const goals: Goal[] = [
    { period: "Today", actual: todayActual, target: 24, targetLabel: "24", source: "Today Snapshot · live" },
    { period: "This week", actual: null, target: 144, targetLabel: "144", source: "Weekly target" },
    { period: "This month", actual: monthly?.actual ?? null, target: monthly?.target ?? 622, targetLabel: String(monthly?.target ?? 622), source: monthly ? `MTD V2 · ${monthly.updatedAt}` : "MTD V2 · loading" },
  ];
  const assignedTarget = (period: BookingPeriod) => {
    const value = assignedGoals.find((goal) => goal.period === period)?.targetValue;
    return value === undefined ? null : Number(value);
  };
  const todayTarget = assignedTarget("today");
  const weeklyTarget = assignedTarget("week");
  const monthlyTarget = assignedTarget("month");
  goals[0] = { ...goals[0]!, target: todayTarget ?? 24, targetLabel: String(todayTarget ?? 24), source: todayTarget === null ? goals[0]!.source : "Admin-set booking target" };
  goals[1] = { ...goals[1]!, target: weeklyTarget ?? 144, targetLabel: String(weeklyTarget ?? 144), source: weeklyTarget === null ? goals[1]!.source : "Admin-set booking target" };
  goals[2] = { ...goals[2]!, target: monthlyTarget ?? goals[2]!.target, targetLabel: String(monthlyTarget ?? goals[2]!.target), source: monthlyTarget === null ? goals[2]!.source : "Admin-set booking target" };
  return <Card className="p-4 sm:p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-center"><div className="flex shrink-0 items-center gap-2 lg:w-44"><span className="grid size-9 place-items-center rounded-full bg-brand-soft text-brand-strong"><Target size={18} /></span><div><h2 className="text-sm font-semibold text-primary">My booking goals</h2><p className="text-[11px] text-muted">Progress tracker</p></div></div><div className="grid flex-1 gap-2 sm:grid-cols-3">{goals.map((goal) => <GoalProgress key={goal.period} {...goal} />)}</div><div className="flex items-start gap-2 border-t border-default pt-3 text-[11px] leading-4 text-muted lg:w-64 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0"><Award size={17} className="mt-0.5 shrink-0 text-warning" /><span><strong className="font-semibold text-primary">November incentive</strong><br />{error ? "Live incentive data is temporarily unavailable." : "Payout is calculated from shows in MTD V2 (Show (appt date))."}</span></div></div></Card>;
}
