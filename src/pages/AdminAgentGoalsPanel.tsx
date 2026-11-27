import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

interface AgentOption { id: string; displayName: string; email: string; accountStatus: string; role: { key?: string; name: string } }
interface GoalRecord { id: string; userId: string; title: string; description: string; targetValue: string; unit: string; startsOn: string; endsOn: string; active: boolean; agent?: { displayName: string; email?: string } }
interface GoalForm { userId: string; title: string; description: string; targetValue: string; unit: string; startsOn: string; endsOn: string; reason: string }

const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api";
const blankForm = (): GoalForm => ({ userId: "", title: "", description: "", targetValue: "", unit: "", startsOn: new Date().toISOString().slice(0, 10), endsOn: "", reason: "" });
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, { ...init, credentials: "include", headers: { "content-type": "application/json", ...init?.headers } });
  const body = await response.json().catch(() => null) as { data?: T; error?: { message?: string } } | null;
  if (!response.ok) throw new Error(body?.error?.message ?? "The request failed.");
  return body?.data as T;
}

export function AdminAgentGoalsPanel({ users, mockMode }: { users: AgentOption[]; mockMode: boolean }) {
  const agents = useMemo(() => users.filter((user) => user.accountStatus === "active" && user.role.key?.includes("agent")), [users]);
  const [goals, setGoals] = useState<GoalRecord[]>([]);
  const [form, setForm] = useState<GoalForm>(blankForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGoals = async () => {
    if (mockMode) { setLoading(false); return; }
    setLoading(true);
    try { setGoals(await api<GoalRecord[]>("/admin/agent-goals")); setError(null); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load agent goals."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadGoals(); }, [mockMode]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true); setError(null);
    try {
      const body = { ...form, targetValue: Number(form.targetValue) };
      const saved = await api<GoalRecord>(editingId ? `/admin/agent-goals/${editingId}` : "/admin/agent-goals", { method: editingId ? "PATCH" : "POST", body: JSON.stringify(body) });
      setGoals((current) => editingId ? current.map((goal) => goal.id === editingId ? { ...goal, ...saved } : goal) : [saved, ...current]);
      setEditingId(null); setForm(blankForm());
      await loadGoals();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save the goal."); }
    finally { setSaving(false); }
  };

  const beginEdit = (goal: GoalRecord) => {
    setEditingId(goal.id);
    setForm({ userId: goal.userId, title: goal.title, description: goal.description, targetValue: goal.targetValue, unit: goal.unit, startsOn: goal.startsOn, endsOn: goal.endsOn, reason: "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const archive = async (goal: GoalRecord) => {
    const reason = window.prompt(`Why are you archiving “${goal.title}” for ${goal.agent?.displayName ?? "this agent"}?`);
    if (!reason?.trim()) return;
    try {
      await api(`/admin/agent-goals/${goal.id}`, { method: "PATCH", body: JSON.stringify({ active: false, reason: reason.trim() }) });
      await loadGoals();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not archive the goal."); }
  };

  const restore = async (goal: GoalRecord) => {
    const reason = window.prompt(`Why are you restoring “${goal.title}” for ${goal.agent?.displayName ?? "this agent"}?`);
    if (!reason?.trim()) return;
    try {
      await api(`/admin/agent-goals/${goal.id}`, { method: "PATCH", body: JSON.stringify({ active: true, reason: reason.trim() }) });
      await loadGoals();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not restore the goal."); }
  };

  return <div className="space-y-5">
    <Card className="p-5 sm:p-6">
      <div><h2 className="text-lg font-semibold text-primary">{editingId ? "Edit agent target" : "Assign an agent target"}</h2><p className="mt-1 text-sm text-secondary">Set a measurable goal for one active agent and a date range. Agents can see their current targets on Home.</p></div>
      {mockMode && <p className="mt-4 rounded-lg border border-warning-border bg-warning-soft p-3 text-sm text-warning-strong">Goal assignment needs the connected backend and database. Switch off demo authentication to save targets.</p>}
      {error && <p role="alert" className="mt-4 rounded-lg border border-error-border bg-error-soft p-3 text-sm text-error">{error}</p>}
      <form onSubmit={(event) => void submit(event)} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm font-medium">Agent<select required value={form.userId} disabled={Boolean(editingId) || mockMode} onChange={(event) => setForm({ ...form, userId: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm"><option value="">Select an agent</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.displayName} · {agent.email}</option>)}</select></label>
        <label className="text-sm font-medium">Goal name<input required minLength={2} maxLength={160} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. New customer calls" className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm" /></label>
        <div className="grid grid-cols-[1fr_1fr] gap-3"><label className="text-sm font-medium">Target<input required type="number" min="0.01" step="0.01" value={form.targetValue} onChange={(event) => setForm({ ...form, targetValue: event.target.value })} placeholder="e.g. 120" className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm" /></label><label className="text-sm font-medium">Unit<input required maxLength={40} value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} placeholder="calls, ₹, bookings" className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm" /></label></div>
        <label className="text-sm font-medium">Starts on<input required type="date" value={form.startsOn} onChange={(event) => setForm({ ...form, startsOn: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm" /></label>
        <label className="text-sm font-medium">Ends on<input required type="date" min={form.startsOn} value={form.endsOn} onChange={(event) => setForm({ ...form, endsOn: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm" /></label>
        <label className="text-sm font-medium sm:col-span-2 lg:col-span-3">Notes<textarea maxLength={2000} rows={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Optional details on what counts toward the goal" className="mt-1.5 w-full rounded-lg border border-input bg-input px-3 py-2 text-sm" /></label>
        <label className="text-sm font-medium sm:col-span-2 lg:col-span-3">Reason for change<input required minLength={3} maxLength={1000} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="This will be recorded in the audit log" className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm" /></label>
        <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-3"><Button type="button" variant="secondary" onClick={() => { setEditingId(null); setForm(blankForm()); }}>Clear</Button><Button type="submit" disabled={saving || mockMode || !agents.length}>{saving ? "Saving…" : editingId ? "Save target" : "Assign target"}</Button></div>
      </form>
    </Card>

    <Card className="overflow-hidden">
      <div className="border-b border-default p-5"><h2 className="text-base font-semibold text-primary">Assigned goals</h2><p className="mt-1 text-sm text-muted">Active and archived targets for individual agents.</p></div>
      {loading ? <p className="p-5 text-sm text-muted">Loading agent goals…</p> : goals.length === 0 ? <p className="p-5 text-sm text-muted">No targets have been assigned yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-subtle text-xs uppercase text-muted"><tr><th className="p-4">Agent / goal</th><th className="p-4">Target</th><th className="p-4">Period</th><th className="p-4">Status</th><th className="p-4">Actions</th></tr></thead><tbody>{goals.map((goal) => <tr key={goal.id} className="border-t border-default"><td className="p-4"><p className="font-semibold text-primary">{goal.agent?.displayName ?? "Agent"}</p><p className="mt-1 text-secondary">{goal.title}</p>{goal.description && <p className="mt-1 max-w-md text-xs text-muted">{goal.description}</p>}</td><td className="p-4 font-medium">{Number(goal.targetValue).toLocaleString()} {goal.unit}</td><td className="p-4 whitespace-nowrap">{goal.startsOn} – {goal.endsOn}</td><td className="p-4">{goal.active ? "Active" : "Archived"}</td><td className="p-4"><div className="flex gap-2">{goal.active ? <><Button variant="secondary" disabled={mockMode} onClick={() => beginEdit(goal)}>Edit</Button><Button variant="secondary" disabled={mockMode} onClick={() => void archive(goal)}>Archive</Button></> : <Button variant="secondary" disabled={mockMode} onClick={() => void restore(goal)}>Restore</Button>}</div></td></tr>)}</tbody></table></div>}
    </Card>
  </div>;
}
