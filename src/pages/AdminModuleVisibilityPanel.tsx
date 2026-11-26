import { Check, EyeOff, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { APP_MODULES } from "../../shared/app-modules";
import type { AppModuleKey } from "../../shared/app-modules";
import { Card } from "../components/ui/Card";

interface ModuleState { key: AppModuleKey; group: string; label: string; description: string; enabled: boolean }
const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api";
const mockMode = import.meta.env.VITE_USE_MOCK_AUTH === "true";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, { ...init, credentials: "include", headers: { "content-type": "application/json", ...init?.headers } });
  const payload = await response.json().catch(() => null) as { data?: T; error?: { message?: string } } | null;
  if (!response.ok) throw new Error(payload?.error?.message ?? "The module setting could not be saved.");
  return payload?.data as T;
}

export function AdminModuleVisibilityPanel() {
  const [modules, setModules] = useState<ModuleState[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<AppModuleKey | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try { setModules(await api<ModuleState[]>("/modules")); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load module visibility."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const grouped = useMemo(() => APP_MODULES.map((module) => ({
    group: module.group,
    modules: modules.filter((item) => item.group === module.group),
  })).filter((item, index, items) => items.findIndex((candidate) => candidate.group === item.group) === index), [modules]);

  const toggle = async (module: ModuleState) => {
    setSavingKey(module.key); setError(""); setSuccess("");
    const enabled = !module.enabled;
    const reason = `Admin set ${module.label} ${enabled ? "visible" : "hidden"} for staff roles.`;
    try {
      if (mockMode) {
        setModules((current) => current.map((item) => item.key === module.key ? { ...item, enabled } : item));
      } else {
        await api(`/admin/feature-flags/${encodeURIComponent(module.key)}`, { method: "PUT", body: JSON.stringify({ enabled, description: module.description, rules: {}, reason }) });
        setModules((current) => current.map((item) => item.key === module.key ? { ...item, enabled } : item));
        window.dispatchEvent(new Event("bark:module-visibility-changed"));
      }
      setSuccess(`${module.label} is now ${enabled ? "visible" : "hidden"} for staff.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save the module setting."); }
    finally { setSavingKey(null); }
  };

  return <div className="space-y-4">
    <div><h2 className="text-lg font-semibold text-primary">Section visibility</h2><p className="mt-1 text-sm text-secondary">Choose which app sections staff can see. Changes apply across the company and take effect on other users within 30 seconds or when they return to the app. Admin accounts keep access so they can configure and review every section.</p></div>
    <div className="flex items-start gap-2 rounded-lg border border-info-border bg-info-soft p-3 text-sm text-info"><EyeOff size={16} className="mt-0.5 shrink-0" /><p>Hidden sections disappear from staff navigation and direct links return them to an available section. Existing data is not deleted, and a toggle does not grant role permissions.</p></div>
    {error && <p role="alert" className="rounded-lg border border-error-border bg-error-soft p-3 text-sm text-error">{error}</p>}
    {success && <p role="status" className="flex items-center gap-2 rounded-lg border border-success/30 bg-success-soft p-3 text-sm text-success"><Check size={15} />{success}</p>}
    {loading ? <Card className="p-5 text-sm text-secondary">Loading app sections…</Card> : <div className="grid gap-4 lg:grid-cols-2">{grouped.map(({ group, modules: rows }) => <Card key={group} className="overflow-hidden"><div className="border-b border-default px-4 py-3"><h3 className="font-semibold text-primary">{group}</h3></div><ul className="divide-y divide-default">{rows.map((module) => <li key={module.key} className="flex items-center justify-between gap-4 p-4"><div className="min-w-0"><p className="font-medium text-primary">{module.label}</p><p className="mt-0.5 text-xs leading-5 text-secondary">{module.description}</p></div><button type="button" role="switch" aria-checked={module.enabled} aria-label={`${module.enabled ? "Hide" : "Show"} ${module.label} for staff`} disabled={savingKey !== null} onClick={() => void toggle(module)} className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-wait disabled:opacity-60 ${module.enabled ? "bg-brand" : "bg-subtle"}`}><span className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${module.enabled ? "translate-x-6" : "translate-x-1"}`} />{savingKey === module.key && <LoaderCircle size={12} className="absolute right-1 animate-spin text-primary" />}</button></li>)}</ul></Card>)}</div>}
  </div>;
}
