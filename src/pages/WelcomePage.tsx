import { ArrowRight, Building2, CircleUserRound, Headphones, ShieldCheck } from "lucide-react";
import { Link } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { Avatar } from "../components/ui/Avatar";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { roleDefinitions } from "../data/employees";
import { TodaySnapshot } from "../components/dashboard/TodaySnapshot";
import { BookingGoalTracker } from "../components/dashboard/BookingGoalTracker";
import { OperationalSummary } from "../components/dashboard/OperationalSummary";

function getGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function CallQualityScore() {
  return (
    <section
      className="flex w-[min(17rem,calc(100vw-5rem))] items-center gap-4 rounded-[var(--radius-md)] border border-default bg-surface px-4 py-3 shadow-[var(--shadow-card)]"
      aria-labelledby="call-quality-title"
    >
      <div
        className="grid size-14 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-strong"
        role="img"
        aria-label="Call quality score: 92 out of 100"
      >
        <span className="text-lg font-bold tabular-nums">92</span>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <Headphones size={15} className="shrink-0 text-brand" aria-hidden="true" />
          <h2 id="call-quality-title" className="text-sm font-semibold text-primary">Call Quality</h2>
        </div>
        <p className="mt-1 text-xs font-medium text-success">Excellent · 92/100</p>
        <p className="mt-0.5 text-[11px] text-muted">8 calls reviewed · Nov MTD</p>
      </div>
    </section>
  );
}

export function WelcomePage() {
  const { employee } = useAuth();
  if (!employee) return null;
  const role = roleDefinitions[employee.role];
  const firstName = employee.displayName.replace(/^Dr\.\s+/, "").split(" ")[0] ?? employee.displayName;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Your workspace"
        title={`${getGreeting()}, ${firstName}.`}
        description="Welcome to Bark. Everything you need to stay connected across teams starts here."
        action={employee.role === "sales-agent" ? <CallQualityScore /> : undefined}
      />

      {employee.role === "sales-agent" && <BookingGoalTracker />}

      <OperationalSummary />

      <TodaySnapshot />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
        <Card className="relative overflow-hidden p-6 sm:p-8">
          <span className="absolute inset-y-0 left-0 w-1 bg-brand" aria-hidden="true" />
          <div className="max-w-2xl">
            <span className="inline-flex items-center rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-strong">
              {employee.roleLabel}
            </span>
            <h2 className="mt-5 text-2xl font-semibold tracking-[-0.035em] text-primary">A clear start to your day.</h2>
            <p className="mt-3 text-[15px] leading-7 text-secondary">{role.welcomeCopy}</p>
            <Link
              to="/escalations"
              className="mt-7 inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] bg-brand px-4 text-sm font-semibold text-on-brand shadow-[var(--shadow-button)] transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              Go to Escalations
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <Avatar name={employee.displayName} size="lg" />
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-primary">{employee.displayName}</h2>
              <p className="mt-0.5 truncate text-sm text-secondary">{employee.email}</p>
            </div>
          </div>
          <dl className="mt-6 space-y-4 border-t border-default pt-5">
            <div className="flex items-start gap-3">
              <CircleUserRound size={17} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
              <div><dt className="text-xs text-muted">Role</dt><dd className="mt-0.5 text-sm font-medium text-primary">{employee.roleLabel}</dd></div>
            </div>
            <div className="flex items-start gap-3">
              <Building2 size={17} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
              <div><dt className="text-xs text-muted">Team or clinic</dt><dd className="mt-0.5 text-sm font-medium text-primary">{employee.assignment}</dd></div>
            </div>
            <div className="flex items-start gap-3">
              <Headphones size={17} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
              <div><dt className="text-xs text-muted">Department</dt><dd className="mt-0.5 text-sm font-medium text-primary">{employee.department}</dd></div>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck size={17} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
              <div><dt className="text-xs text-muted">Account status</dt><dd className="mt-0.5 text-sm font-medium text-success">Active</dd></div>
            </div>
          </dl>
        </Card>
      </section>

      <p className="text-xs leading-5 text-muted">Operational data and permissions are provided by Bark's secured backend services.</p>
    </div>
  );
}
