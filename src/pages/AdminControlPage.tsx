import { Activity, Plus, Search, ShieldAlert, UsersRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { mockEmployees } from "../data/employees";
import { AdminConfigurationPanel } from "./AdminConfigurationPanel";
import { AdminBulkActionsPanel } from "./AdminBulkActionsPanel";
import { AdminEscalationsDashboard } from "./AdminEscalationsDashboard";
import { AdminModuleVisibilityPanel } from "./AdminModuleVisibilityPanel";

interface AdminRole { id: string; key: string; name: string; clearanceLevel: number }
interface AdminClinic { id: string; name: string; active: boolean }
interface AdminUser { id: string; employeeCode: string; displayName: string; email: string; contactPhone?: string | null; profileBio?: string | null; department: string; assignment: string; accountStatus: string; clearanceLevel: number; clinicIds?: string[]; role: { id?: string; key?: string; name: string } }
interface AuditEvent { id: string; action: string; entityType: string; entityId: string; reason: string | null; createdAt: string }
type Section = "users" | "audit" | "configure" | "escalations" | "bulk" | "modules";
interface NewUserForm { employeeCode: string; email: string; displayName: string; password: string; roleId: string; department: string; assignment: string; clinicIds: string[] }
interface EditUserForm { employeeCode: string; email: string; displayName: string; contactPhone: string; profileBio: string; roleId: string; clearanceLevel: number; department: string; assignment: string; accountStatus: "active" | "inactive" | "suspended"; clinicIds: string[]; reason: string }
interface PasswordForm { password: string; confirmPassword: string; reason: string }
const emptyUser: NewUserForm = { employeeCode: "", email: "", displayName: "", password: "", roleId: "", department: "", assignment: "", clinicIds: [] };
const emptyPasswordForm: PasswordForm = { password: "", confirmPassword: "", reason: "" };
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
  const [allClinics, setAllClinics] = useState<AdminClinic[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState<NewUserForm>(emptyUser);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState<EditUserForm | null>(null);
  const [savingUser, setSavingUser] = useState(false);
  const [passwordUser, setPasswordUser] = useState<AdminUser | null>(null);
  const [passwordForm, setPasswordForm] = useState<PasswordForm>(emptyPasswordForm);
  const [savingPassword, setSavingPassword] = useState(false);
  const permitted = employee?.role === "god" || employee?.role === "system-administrator";

  const load = async () => {
    setLoading(true); setError(null);
    try {
      if (mockMode) {
        const mockRoles = new Map<string, AdminRole>();
        setUsers(mockEmployees.map((user, index) => {
          const clearanceLevel = user.role === "god" ? 100 : user.role === "system-administrator" ? 90 : 10;
          mockRoles.set(user.role, { id: user.role, key: user.role, name: user.roleLabel, clearanceLevel });
          return { id: user.id, employeeCode: `DEMO-${String(index + 1).padStart(3, "0")}`, displayName: user.displayName, email: user.email, contactPhone: null, profileBio: null, department: user.department, assignment: user.assignment, accountStatus: user.accountStatus, clearanceLevel, clinicIds: [], role: { id: user.role, key: user.role, name: user.roleLabel } };
        }));
        setRoles([...mockRoles.values()].filter((role) => role.clearanceLevel < (employee?.role === "god" ? 101 : 90)));
        setEvents([{ id: "demo-audit-1", action: "auth.login", entityType: "session", entityId: "development-session", reason: "Mock mode demonstration", createdAt: new Date().toISOString() }]);
        return;
      }
      const [userRows, auditRows, roleRows, clinicRows] = await Promise.all([api<AdminUser[]>("/admin/users?limit=100"), api<AuditEvent[]>("/admin/audit-events?limit=100"), api<AdminRole[]>("/admin/roles"), api<AdminClinic[]>("/admin/clinics")]);
      setUsers(userRows); setEvents(auditRows); setRoles(roleRows.filter((role) => role.clearanceLevel < (employee?.role === "god" ? 101 : 90))); setAllClinics(clinicRows); setClinics(clinicRows.filter((clinic) => clinic.active));
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

  const beginEditUser = (user: AdminUser) => {
    setError(null);
    setEditingUser(user);
    setEditForm({ employeeCode: user.employeeCode, email: user.email, displayName: user.displayName, contactPhone: user.contactPhone ?? "", profileBio: user.profileBio ?? "", roleId: user.role.id ?? "", clearanceLevel: user.clearanceLevel, department: user.department, assignment: user.assignment, accountStatus: user.accountStatus === "inactive" || user.accountStatus === "suspended" ? user.accountStatus : "active", clinicIds: user.clinicIds ?? [], reason: "" });
    setCreateOpen(false);
  };

  const saveUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingUser || !editForm) return;
    setSavingUser(true); setError(null);
    const changes = { ...editForm, contactPhone: editForm.contactPhone.trim() || null, profileBio: editForm.profileBio.trim() || null };
    const { reason: _reason, ...editableChanges } = changes;
    try {
      if (mockMode) {
        const selectedRole = roles.find((role) => role.id === editForm.roleId);
        setUsers((current) => current.map((user) => user.id === editingUser.id ? { ...user, ...editableChanges, clearanceLevel: Number(changes.clearanceLevel), clinicIds: changes.clinicIds, role: selectedRole ? { id: selectedRole.id, key: selectedRole.key, name: selectedRole.name } : user.role } : user));
        setEvents((current) => [{ id: `demo-audit-${Date.now()}`, action: "admin.user_updated", entityType: "user", entityId: editingUser.id, reason: editForm.reason, createdAt: new Date().toISOString() }, ...current]);
      } else {
        await api(`/admin/users/${editingUser.id}`, { method: "PATCH", body: JSON.stringify({ ...changes, clearanceLevel: Number(changes.clearanceLevel), reason: editForm.reason }) });
        await load();
      }
      setEditingUser(null); setEditForm(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save the user changes."); }
    finally { setSavingUser(false); }
  };

  const changePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!passwordUser) return;
    if (passwordForm.password !== passwordForm.confirmPassword) { setError("The passwords do not match."); return; }
    setSavingPassword(true); setError(null);
    try {
      if (mockMode) {
        setEvents((current) => [{ id: `demo-audit-${Date.now()}`, action: "admin.user_password_changed", entityType: "user", entityId: passwordUser.id, reason: passwordForm.reason, createdAt: new Date().toISOString() }, ...current]);
      } else {
        await api(`/admin/users/${passwordUser.id}/password`, { method: "POST", body: JSON.stringify({ password: passwordForm.password, reason: passwordForm.reason }) });
        await load();
      }
      setPasswordUser(null); setPasswordForm(emptyPasswordForm);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not change the user password."); }
    finally { setSavingPassword(false); }
  };

  return <div className="space-y-6">
    <div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-brand">Clearance 100</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">Admin Control Center</h1><p className="mt-2 text-sm text-secondary">Manage accounts, business configuration, and the audit history.</p></div>
    <div className="grid gap-4 sm:grid-cols-3"><Card className="p-5"><UsersRound className="text-brand" size={20} /><p className="mt-3 text-2xl font-semibold">{users.length}</p><p className="text-sm text-muted">Managed users</p></Card><Card className="p-5"><Activity className="text-brand" size={20} /><p className="mt-3 text-2xl font-semibold">{events.length}</p><p className="text-sm text-muted">Recent audit events</p></Card><Card className="p-5"><ShieldAlert className="text-brand" size={20} /><p className="mt-3 text-2xl font-semibold">Immutable</p><p className="text-sm text-muted">Audit retention</p></Card></div>
    <div className="flex flex-wrap gap-2"><Button variant={section === "users" ? "primary" : "secondary"} onClick={() => setSection("users")}>Users</Button><Button variant={section === "bulk" ? "primary" : "secondary"} onClick={() => setSection("bulk")}>Bulk Actions</Button><Button variant={section === "escalations" ? "primary" : "secondary"} onClick={() => setSection("escalations")}>Escalations &amp; issues</Button><Button variant={section === "configure" ? "primary" : "secondary"} onClick={() => setSection("configure")}>Configure</Button><Button variant={section === "modules" ? "primary" : "secondary"} onClick={() => setSection("modules")}>Modules</Button><Button variant={section === "audit" ? "primary" : "secondary"} onClick={() => setSection("audit")}>Audit Center</Button></div>
    {error && <p role="alert" className="rounded-lg border border-error-border bg-error-soft p-3 text-sm text-error">{error}</p>}
    {section === "bulk" ? <AdminBulkActionsPanel roles={roles} clinics={clinics} mockMode={mockMode} /> : section === "escalations" ? <AdminEscalationsDashboard /> : section === "modules" ? <AdminModuleVisibilityPanel /> : <Card className="overflow-hidden">
      {section === "users" ? <>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-default p-4"><label className="relative block w-full max-w-md"><Search className="absolute left-3 top-3 text-muted" size={16} /><input aria-label="Search users" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people, roles, or employee IDs" className="min-h-11 w-full rounded-lg border border-input bg-input pl-10 pr-3 text-sm" /></label><Button onClick={() => { setCreateOpen((open) => !open); setEditingUser(null); setEditForm(null); setError(null); }} icon={createOpen ? <X size={16} /> : <Plus size={16} />}>{createOpen ? "Close" : "Create user"}</Button></div>
        {createOpen && <form onSubmit={(event) => void createUser(event)} className="grid gap-4 border-b border-default bg-subtle/30 p-4 sm:grid-cols-2 lg:grid-cols-3"><h2 className="text-lg font-semibold text-primary sm:col-span-2 lg:col-span-3">Create an account</h2><label className="text-sm font-medium">Employee ID<input required minLength={2} maxLength={80} value={newUser.employeeCode} onChange={(event) => setNewUser({ ...newUser, employeeCode: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm" /></label><label className="text-sm font-medium">Full name<input required minLength={2} maxLength={160} value={newUser.displayName} onChange={(event) => setNewUser({ ...newUser, displayName: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm" /></label><label className="text-sm font-medium">Work email<input required type="email" value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm" /></label><label className="text-sm font-medium">Initial password<input required type="password" minLength={14} value={newUser.password} onChange={(event) => setNewUser({ ...newUser, password: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm" /></label><label className="text-sm font-medium">Role<select required value={newUser.roleId} onChange={(event) => setNewUser({ ...newUser, roleId: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm"><option value="">Select role</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label><label className="text-sm font-medium">Department<input required minLength={2} value={newUser.department} onChange={(event) => setNewUser({ ...newUser, department: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm" /></label><label className="text-sm font-medium sm:col-span-2">Team / assignment<input required minLength={2} value={newUser.assignment} onChange={(event) => setNewUser({ ...newUser, assignment: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm" /></label><fieldset className="sm:col-span-2 lg:col-span-3"><legend className="text-sm font-medium">Clinic access</legend><div className="mt-2 flex flex-wrap gap-2">{clinics.map((clinic) => <label key={clinic.id} className="flex items-center gap-2 rounded-lg border border-default bg-surface px-3 py-2 text-sm"><input type="checkbox" checked={newUser.clinicIds.includes(clinic.id)} onChange={(event) => setNewUser({ ...newUser, clinicIds: event.target.checked ? [...newUser.clinicIds, clinic.id] : newUser.clinicIds.filter((id) => id !== clinic.id) })} />{clinic.name}</label>)}</div></fieldset><div className="flex justify-end sm:col-span-2 lg:col-span-3"><Button type="submit" disabled={creating || mockMode || !roles.length}>{creating ? "Creating…" : "Create account"}</Button></div></form>}
         {editingUser && editForm && <form onSubmit={(event) => void saveUser(event)} className="grid gap-4 border-b border-default bg-subtle/30 p-4 sm:grid-cols-2 lg:grid-cols-3"><div className="sm:col-span-2 lg:col-span-3"><h2 className="text-lg font-semibold text-primary">Edit user</h2><p className="mt-1 text-sm text-secondary">Changes are audited. The email must match the user’s Google account for Google sign-in.</p></div><label className="text-sm font-medium">Employee ID<input required value={editForm.employeeCode} onChange={(event) => setEditForm({ ...editForm, employeeCode: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm" /></label><label className="text-sm font-medium">Full name<input required value={editForm.displayName} onChange={(event) => setEditForm({ ...editForm, displayName: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm" /></label><label className="text-sm font-medium">Work email<input required type="email" value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm" /></label><label className="text-sm font-medium">Phone<input type="tel" value={editForm.contactPhone} onChange={(event) => setEditForm({ ...editForm, contactPhone: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm" /></label><label className="text-sm font-medium">Department<input required value={editForm.department} onChange={(event) => setEditForm({ ...editForm, department: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm" /></label><label className="text-sm font-medium">Team / assignment<input required value={editForm.assignment} onChange={(event) => setEditForm({ ...editForm, assignment: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm" /></label><label className="text-sm font-medium">Role<select disabled={editingUser.id === employee?.id} value={editForm.roleId} onChange={(event) => { const role = roles.find((candidate) => candidate.id === event.target.value); setEditForm({ ...editForm, roleId: event.target.value, clearanceLevel: role?.clearanceLevel ?? editForm.clearanceLevel }); }} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm"><option value="">Select role</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label><label className="text-sm font-medium">Clearance level<input type="number" min={1} max={employee?.role === "god" ? 100 : 89} disabled={editingUser.id === employee?.id} value={editForm.clearanceLevel} onChange={(event) => setEditForm({ ...editForm, clearanceLevel: Number(event.target.value) })} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm" /></label><label className="text-sm font-medium">Account status<select disabled={editingUser.id === employee?.id} value={editForm.accountStatus} onChange={(event) => setEditForm({ ...editForm, accountStatus: event.target.value as EditUserForm["accountStatus"] })} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm"><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select></label><label className="text-sm font-medium sm:col-span-2 lg:col-span-3">Profile notes<textarea maxLength={500} rows={2} value={editForm.profileBio} onChange={(event) => setEditForm({ ...editForm, profileBio: event.target.value })} className="mt-1.5 w-full rounded-lg border border-input bg-input px-3 py-2 text-sm" /></label><fieldset className="sm:col-span-2 lg:col-span-3"><legend className="text-sm font-medium">Clinic access</legend><div className="mt-2 flex flex-wrap gap-2">{allClinics.map((clinic) => <label key={clinic.id} className="flex items-center gap-2 rounded-lg border border-default bg-surface px-3 py-2 text-sm"><input type="checkbox" checked={editForm.clinicIds.includes(clinic.id)} onChange={(event) => setEditForm({ ...editForm, clinicIds: event.target.checked ? [...editForm.clinicIds, clinic.id] : editForm.clinicIds.filter((id) => id !== clinic.id) })} />{clinic.name}{clinic.active ? "" : " (inactive)"}</label>)}</div></fieldset><label className="text-sm font-medium sm:col-span-2 lg:col-span-3">Reason for change<input required minLength={3} value={editForm.reason} onChange={(event) => setEditForm({ ...editForm, reason: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm" /></label><div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-3"><Button type="button" variant="secondary" onClick={() => { setEditingUser(null); setEditForm(null); }}>Cancel</Button><Button type="submit" disabled={savingUser || !editForm.roleId}>{savingUser ? "Saving…" : "Save user"}</Button></div></form>}
         {passwordUser && <form onSubmit={(event) => void changePassword(event)} className="grid gap-4 border-b border-default bg-warning-soft/40 p-4 sm:grid-cols-2 lg:grid-cols-3"><div className="sm:col-span-2 lg:col-span-3"><h2 className="text-lg font-semibold text-primary">Change password · {passwordUser.displayName}</h2><p className="mt-1 text-sm text-secondary">Set a new password for this employee. Their active sessions will be signed out, and the password will not be shown again or included in audit logs.</p></div><label className="text-sm font-medium">New password<input required type="password" minLength={14} maxLength={1024} autoComplete="new-password" value={passwordForm.password} onChange={(event) => setPasswordForm({ ...passwordForm, password: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm" /></label><label className="text-sm font-medium">Confirm new password<input required type="password" minLength={14} maxLength={1024} autoComplete="new-password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm" /></label><label className="text-sm font-medium sm:col-span-2 lg:col-span-3">Reason for change<input required minLength={3} maxLength={1000} value={passwordForm.reason} onChange={(event) => setPasswordForm({ ...passwordForm, reason: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm" /></label><div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-3"><Button type="button" variant="secondary" onClick={() => { setPasswordUser(null); setPasswordForm(emptyPasswordForm); }}>Cancel</Button><Button type="submit" disabled={savingPassword}>{savingPassword ? "Changing…" : "Change password"}</Button></div></form>}
         <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-subtle text-xs uppercase text-muted"><tr><th className="p-4">User</th><th className="p-4">Role</th><th className="p-4">Clearance</th><th className="p-4">Status</th><th className="p-4">Actions</th></tr></thead><tbody>{visibleUsers.map((user) => <tr key={user.id} className="border-t border-default"><td className="p-4"><p className="font-semibold text-primary">{user.displayName}</p><p className="text-xs text-muted">{user.email}</p></td><td className="p-4">{user.role.name}</td><td className="p-4">{user.clearanceLevel}</td><td className="p-4 capitalize">{user.accountStatus}</td><td className="p-4"><div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={user.clearanceLevel >= (employee?.role === "god" ? 101 : 90)} onClick={() => beginEditUser(user)}>Edit</Button><Button variant="secondary" disabled={user.clearanceLevel >= (employee?.role === "god" ? 101 : 90)} onClick={() => { setError(null); setEditingUser(null); setEditForm(null); setPasswordUser(user); setPasswordForm(emptyPasswordForm); }}>{"Change password"}</Button><Button variant="secondary" disabled={user.clearanceLevel >= (employee?.role === "god" ? 101 : 90)} onClick={() => void suspend(user)}>{user.accountStatus === "suspended" ? "Reactivate" : "Suspend"}</Button></div></td></tr>)}</tbody></table></div>
      </> : section === "configure" ? <AdminConfigurationPanel /> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-subtle text-xs uppercase text-muted"><tr><th className="p-4">When</th><th className="p-4">Action</th><th className="p-4">Record</th><th className="p-4">Reason</th></tr></thead><tbody>{events.map((event) => <tr key={event.id} className="border-t border-default"><td className="p-4 whitespace-nowrap">{new Date(event.createdAt).toLocaleString()}</td><td className="p-4 font-medium">{event.action}</td><td className="p-4">{event.entityType}: {event.entityId}</td><td className="p-4 text-muted">{event.reason ?? "—"}</td></tr>)}</tbody></table></div>}
      {loading && section !== "configure" && <p className="p-6 text-sm text-muted">Loading control center…</p>}
    </Card>}
  </div>;
}
