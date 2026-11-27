import { Target } from "lucide-react";
import { useEffect, useState } from "react";
import { Card } from "../ui/Card";

interface Goal { id: string; title: string; description: string; targetValue: string; unit: string; startsOn: string; endsOn: string }
const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api";

export function MyAgentGoals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${apiBase}/dashboard/my-goals`, { credentials: "include", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as { data?: Goal[] };
        if (!response.ok) throw new Error("Could not load goals");
        setGoals(body.data ?? []);
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  if (!loading && !failed && goals.length === 0) return null;
  return <Card className="p-5 sm:p-6">
    <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-strong"><Target size={19} aria-hidden="true" /></span><div><h2 className="text-base font-semibold text-primary">My targets</h2><p className="mt-1 text-sm text-secondary">Goals assigned to you by your manager or admin.</p></div></div>
    {loading ? <p className="mt-4 text-sm text-muted">Loading your targets…</p> : failed ? <p className="mt-4 text-sm text-muted">Your targets could not be loaded right now.</p> : <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{goals.map((goal) => <div key={goal.id} className="rounded-xl border border-default bg-subtle/40 p-4"><div className="flex items-start justify-between gap-3"><h3 className="font-semibold text-primary">{goal.title}</h3><span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-strong">{Number(goal.targetValue).toLocaleString()} {goal.unit}</span></div>{goal.description && <p className="mt-2 text-sm text-secondary">{goal.description}</p>}<p className="mt-3 text-xs text-muted">{goal.startsOn} – {goal.endsOn}</p></div>)}</div>}
  </Card>;
}
