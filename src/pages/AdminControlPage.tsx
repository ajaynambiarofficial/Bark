import { Activity, Plus, Search, ShieldAlert, UsersRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { mockEmployees } from "../data/employees";

interface AdminRole { id: string; key: string; name: string; clearanceLevel: number }
interface AdminClinic { id: string; name: string; active: boolean }
interface AdminUser { id: string; employeeCode: string; displayName: string; email: string; department: string; assignment: string; accountStatus: string; clearanceLevel: number; role: { id?: string; key?: string; name: string } }
interface AuditEvent { id: string; action: string; entityType: string; entityId: string; reason: string | null; createdAt: string }
type Section = "users" | "audit";
interface NewUserForm { employeeCode: string; email: string; displayName: string; password: string; roleId: string; department: string; assignment: string; clinicIds: string[] }
const emptyUser: NewUserForm = { employeeCode: "", email: "", displayName: "", password: "", roleId: "", department: "", assignment: "", clinicIds: [] };
const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api";
const mockMode = import.meta.env.VITE_USE_MOCK_AUTH === "true";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, { ...init, credentials: "include", headers: { "content-type": "application/json", ...init?.headers } });
  const body = await response.json().catch(() => null) as { data?: T; error?: { message?: string } } | null;
  if (!response.ok) throw new Error(body?.error?.message ?? "The request failed.");
  return body?.data as T;
}

export function AdminControlPage() {
  const { employee } = useAuth();
  const [section, setSection] = useState<Section>("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [clinics, setClinics] = useState<AdminClinic[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState<NewUserForm>(emptyUser);
  const permitted = employee?.role === "god" || employee?.role === "system-administrator";

  const load = async () => {
    setLoading(true); setError(null);
    try {
      if (mockMode) {
        setUsers(mockEmployees.map((user, index) => ({ id: user.id, employeeCode: `DEMO-${String(index + 1).padStart(3, "0")}`, displayName: user.displayName, email: user.email, department: user.department, assignment: user.assignment, accountStatus: user.accountStatus, clearanceLevel: user.role === "god" ? 100 : user.role === "system-administrator" ? 90 : 10, role: { name: user.roleLabel } })));
        setEvents([{ id: "demo-audit-1", action: "auth.login", entityType: "session", entityId: "development-session", reason: "Mock mode demonstration", createdAt: new Date().toISOString() }]);
        return;
      }
      const [userRows, auditRows, roleRows, clinicRows] = await Promise.all([api<AdminUser[]>("/admin/users?limit=100"), api<AuditEvent[]>("/admin/audit-events?limit=100"), api<AdminRole[]>("/admin/roles"), api<AdminClinic[]>("/admin/clinics")]);
      setUsers(userRows); setEvents(auditRows); setRoles(roleRows.filter((role) => role.clearanceLevel < (employee?.role === "god" ? 101 : 90))); setClinics(clinicRows.filter((clinic) => clinic.active));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load administration data."); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (permitted) void load(); }, [permitted]);

  const visibleUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? users.filter((user) => [user.displayName, user.email, user.employeeCode, user.role.name].some((value) => value.toLowerCase().includes(term))) : users;
  }, [search, users]);

  if (!permitted) return <Navigate to="/welcome" replace />;
  const suspend = async (user: AdminUser) => {
    const reason = window.prompt(`Reason for ${user.accountStatus === "suspended" ? "reactivating" : "suspending"} ${user.displayName}:`);
    if (!reason || reason.trim().length < 3) return;
    try {
      if (mockMode) {
        setUsers((current) => current.map((candidate) => candidate.id === user.id ? { ...candidate, accountStatus: candidate.accountStatus === "suspended" ? "active" : "suspended" } : candidate));
        setEvents((current) => [{ id: `demo-audit-${Date.now()}`, action: user.accountStatus === "suspended" ? "admin.user_reactivated" : "admin.user_suspended", entityType: "user", entityId: user.id, reason, createdAt: new Date().toISOString() }, ...current]);
        return;
      }
      await api(`/admin/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ accountStatus: user.accountStatus === "suspended" ? "active" : "suspended", reason }) });
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Account update failed."); }
  };

  const createUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setCreating(true); setError(null);
    try {
      await api<AdminUser>("/admin/users", { method: "POST", body: JSON.stringify(newUser) });
      setNewUser(emptyUser); setCreateOpen(false); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not create the user."); }
    finally { setCreating(false); }
  };

  return <div className="space-y-6">
    <div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-brand">Clearance 100</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">Admin Control Center</h1><p className="mt-2 text-sm text-secondary">Controlled access to users, roles, workflows, settings, emergency controls, and immutable audit history.</p></div>
    <div className="grid gap-4 sm:grid-cols-3">
      <Card className="p-5"><UsersRound className="text-brand" size={20} /><p className="mt-3 text-2xl font-semibold">{users.length}</p><p className="text-sm text-muted">Managed users</p></Card>
      <Card className="p-5"><Activity className="text-brand" size={20} /><p className="mt-3 text-2xl font-semibold">{events.length}</p><p className="text-sm text-muted">Recent audit events</p></Card>
      <Card className="p-5"><ShieldAlert className="text-brand" size={20} /><p className="mt-3 text-2xl font-semibold">Immutable</p><p className="text-sm text-muted">Audit retention</p></Card>
    </div>
    <div className="flex gap-2"><Button variant={section === "users" ? "primary" : "secondary"} onClick={() => setSection("users")}>Users</Button><Button variant={section === "audit" ? "primary" : "secondary"} onClick={() => setSection("audit")}>Audit Center</Button></div>
    {error && <p role="alert" className="rounded-lg border border-error-border bg-error-soft p-3 text-sm text-error">{error}</p>}
    <Card className="overflow-hidden">
      {section === "users" ? <>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-default p-4"><label className="relative block w-full max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} /><input aria-label="Search users" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people, roles, or employee codes" className="min-h-11 w-full rounded-lg border border-input bg-input pl-10 pr-3 text-sm" /></label><Button onClick={() => { setCreateOpen((open) => !open); setError(null); }} icon={createOpen ? <X size={16} /> : <Plus size={16} />}>{createOpen ? "Close" : "Create user"}</Button></div>
        {createOpen && <form onSubmit={(event) => void createUser(event)} className="space-y-4 border-b border-default bg-subtle/40 p-4 sm:p-6">
          <div><h2 className="text-lg font-semibold text-primary">Create an account</h2><p className="mt-1 text-sm text-secondary">Choose a role, set an initial password, and scope clinic access where needed.</p></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div><label htmlFor="new-user-code" className="text-sm font-medium text-primary">Employee ID</label><input id="new-user-code" required minLength={2} maxLength={80} value={newUser.employeeCode} onChange={(event) => setNewUser({ ...newUser, employeeCode: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm" /></div>
            <div><label htmlFor="new-user-name" className="text-sm font-medium text-primary">Full name</label><input id="new-user-name" required minLength={2} maxLength={160} value={newUser.displayName} onChange={(event) => setNewUser({ ...newUser, displayName: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm" /></div>
            <div><label htmlFor="new-user-email" className="text-sm font-medium text-primary">Work email</label><input id="new-user-email" type="email" autoComplete="off" required value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm" /></div>
            <div><label htmlFor="new-user-password" className="text-sm font-medium text-primary">Initial password</label><input id="new-user-password" type="password" autoComplete="new-password" required minLength={14} value={newUser.password} onChange={(event) => setNewUser({ ...newUser, password: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm" /><p className="mt-1 text-xs text-muted">At least 14 characters.</p></div>
            <div><label htmlFor="new-user-role" className="text-sm font-medium text-primary">Access type</label><select id="new-user-role" required value={newUser.roleId} onChange={(event) => setNewUser({ ...newUser, roleId: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm"><option value="">Select a role</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></div>
            <div><label htmlFor="new-user-department" className="text-sm font-medium text-primary">Department</label><input id="new-user-department" required minLength={2} maxLength={120} value={newUser.department} onChange={(event) => setNewUser({ ...newUser, department: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm" /></div>
            <div className="sm:col-span-2"><label htmlFor="new-user-assignment" className="text-sm font-medium text-primary">Team / assignment</label><input id="new-user-assignment" required minLength={2} maxLength={160} value={newUser.assignment} onChange={(event) => setNewUser({ ...newUser, assignment: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm" /></div>
            <fieldset className="sm:col-span-2 lg:col-span-3"><legend className="text-sm font-medium text-primary">Clinic access</legend><p className="mb-2 mt-1 text-xs text-muted">Select one or more clinics for clinic staff or zonal heads. Leave blank for central teams.</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{clinics.map((clinic) => <label key={clinic.id} className="flex min-h-10 items-center gap-2 rounded-lg border border-default bg-surface px-3 text-sm"><input type="checkbox" checked={newUser.clinicIds.includes(clinic.id)} onChange={(event) => setNewUser({ ...newUser, clinicIds: event.target.checked ? [...newUser.clinicIds, clinic.id] : newUser.clinicIds.filter((id) => id !== clinic.id) })} />{clinic.name}</label>)}</div></fieldset>
          </div>
          {mockMode && <p className="text-xs text-muted">Account creation requires the connected backend; switch off mock authentication to save users.</p>}
          <div className="flex justify-end"><Button type="submit" disabled={creating || mockMode || !roles.length} icon={<Plus size={16} />}>{creating ? "Creating…" : "Create account"}</Button></div>
        </form>}
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-subtle text-xs uppercase text-muted"><tr><th className="p-4">User</th><th className="p-4">Role</th><th className="p-4">Clearance</th><th className="p-4">Status</th><th className="p-4">Control</th></tr></thead><tbody>{visibleUsers.map((user) => <tr key={user.id} className="border-t border-default"><td className="p-4"><p className="font-semibold text-primary">{user.displayName}</p><p className="text-xs text-muted">{user.email}</p></td><td className="p-4">{user.role.name}</td><td className="p-4">{user.clearanceLevel}</td><td className="p-4 capitalize">{user.accountStatus}</td><td className="p-4"><Button variant="secondary" disabled={user.clearanceLevel >= (employee?.role === "god" ? 101 : 90)} onClick={() => void suspend(user)}>{user.accountStatus === "suspended" ? "Reactivate" : "Suspend"}</Button></td></tr>)}</tbody></table></div>
      </> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-subtle text-xs uppercase text-muted"><tr><th className="p-4">When</th><th className="p-4">Action</th><th className="p-4">Record</th><th className="p-4">Reason</th></tr></thead><tbody>{events.map((event) => <tr key={event.id} className="border-t border-default"><td className="p-4 whitespace-nowrap">{new Date(event.createdAt).toLocaleString()}</td><td className="p-4 font-medium">{event.action}</td><td className="p-4">{event.entityType}: {event.entityId}</td><td className="p-4 text-muted">{event.reason ?? "—"}</td></tr>)}</tbody></table></div>}
      {loading && <p className="p-6 text-sm text-muted">Loading control center…</p>}
    </Card>
  </div>;
}
