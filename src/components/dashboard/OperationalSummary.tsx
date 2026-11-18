import { AlertTriangle, CalendarCheck2, Hospital, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Card } from "../ui/Card";
import { dataSources } from "../../config/data-sources";
import { loadTodaySnapshot, type TodaySnapshotData } from "../../features/dashboard/today-snapshot.service";

interface Summary { bookings: { total: number; cancelled: number }; escalations: { total: number; breached: number }; agents: { active: number }; clinics: { active: number } }

export function OperationalSummary() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [todaySnapshot, setTodaySnapshot] = useState<TodaySnapshotData | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { let active = true; fetch(dataSources.internalApi.dashboardSummary, { credentials: "include" }).then(async (response) => { if (!response.ok) throw new Error(); return response.json() as Promise<{ data: Summary }>; }).then((result) => { if (active) setSummary(result.data); }).catch(() => { if (active) setError(true); }); return () => { active = false; }; }, []);
  useEffect(() => { let active = true; const controller = new AbortController(); const refresh = () => { void loadTodaySnapshot(controller.signal).then((result) => { if (active) setTodaySnapshot(result); }).catch(() => undefined); }; refresh(); const interval = window.setInterval(refresh, 2 * 60 * 1000); return () => { active = false; controller.abort(); window.clearInterval(interval); }; }, []);
  if (error && !todaySnapshot) return <p className="text-xs text-muted">Live operational metrics are temporarily unavailable.</p>;
  const cards = [
    { label: "Bookings today", value: todaySnapshot?.total, detail: "Agent bookings · live sheet", icon: CalendarCheck2 },
    { label: "Escalations today", value: summary?.escalations.total, detail: `${summary?.escalations.breached ?? 0} SLA breached`, icon: AlertTriangle },
    { label: "Active agents", value: summary?.agents.active, detail: "Platform accounts", icon: UsersRound },
    { label: "Active clinics", value: summary?.clinics.active, detail: "Operational network", icon: Hospital },
  ];
  return <section aria-label="Live operational summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ label, value, detail, icon: Icon }) => <Card key={label} className="p-5"><div className="flex items-center justify-between"><p className="text-sm font-medium text-secondary">{label}</p><Icon size={18} className="text-brand" /></div><p className="mt-3 text-2xl font-semibold tabular-nums text-primary">{value ?? "—"}</p><p className="mt-1 text-xs text-muted">{detail}</p></Card>)}</section>;
}
