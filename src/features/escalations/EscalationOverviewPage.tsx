import { AlertTriangle, ArrowDownUp, Clock3, Inbox, Plus, RotateCcw, Search, UserCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../auth/AuthContext";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { allStatuses, clinics, priorities } from "./escalation.config";
import { escalationService } from "./escalation.service";
import { canCreateEscalation, escalationRolePermissions } from "./escalation.permissions";
import type { Escalation, EscalationFilters, EscalationView } from "./escalation.types";
import { PriorityBadge, SlaIndicator, StatusBadge, TierBadge, fieldClass, getSlaState } from "./EscalationUi";

const initialFilters: EscalationFilters = { search: "", status: "", priority: "", tier: "", department: "", clinic: "", slaState: "" };
const views: { id: EscalationView; label: string }[] = [
  { id: "all", label: "All Escalations" }, { id: "raised", label: "Raised by Me" }, { id: "assigned", label: "Assigned to Me" },
  { id: "team", label: "My Team" }, { id: "action", label: "Awaiting My Action" },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function EscalationOverviewPage() {
  const { employee } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<EscalationView>("all");
  const [filters, setFilters] = useState(initialFilters);
  const [sortAscending, setSortAscending] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 8;

  useEffect(() => {
    if (!employee) return;
    let active = true;
    setLoading(true);
    void escalationService.listEscalations(employee).then((result) => { if (active) setItems(result); }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Could not load escalations."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [employee]);

  const visible = useMemo(() => {
    if (!employee) return [];
    const query = filters.search.trim().toLowerCase();
    const selected = items.filter((item) => {
      if (view === "raised" && item.reporter.id !== employee.id) return false;
      if (view === "assigned" && item.accountableOwner.id !== employee.id) return false;
      if (view === "team" && item.originatingDepartment !== employee.department && item.responsibleDepartment !== employee.department) return false;
      if (view === "action" && (item.accountableOwner.id !== employee.id || !["Assigned", "In Progress", "Reopened"].includes(item.status))) return false;
      if (query && ![item.reference, item.id, item.linkedTicketId, item.title].some((value) => value?.toLowerCase().includes(query))) return false;
      if (filters.status && item.status !== filters.status) return false;
      if (filters.priority && item.priority !== filters.priority) return false;
      if (filters.tier && item.tier !== filters.tier) return false;
      if (filters.department && item.responsibleDepartment !== filters.department) return false;
      if (filters.clinic && item.clinic !== filters.clinic) return false;
      if (filters.slaState && getSlaState(item) !== filters.slaState) return false;
      return true;
    });
    return selected.sort((a, b) => (sortAscending ? 1 : -1) * (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()));
  }, [employee, filters, items, sortAscending, view]);

  useEffect(() => setPage(1), [filters, view]);
  if (!employee) return null;
  const metrics = {
    open: items.filter((item) => !["Resolved", "Closed"].includes(item.status)).length,
    assigned: items.filter((item) => item.accountableOwner.id === employee.id && !["Resolved", "Closed"].includes(item.status)).length,
    awaiting: items.filter((item) => item.status === "Awaiting Response").length,
    breached: items.filter((item) => getSlaState(item) === "breached" && !["Resolved", "Closed"].includes(item.status)).length,
  };
  const departments = Array.from(new Set(items.map((item) => item.responsibleDepartment))).sort();
  const paged = visible.slice((page - 1) * pageSize, page * pageSize);
  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Operations" title="Escalations" description="Track, manage, and resolve operational issues across teams." action={canCreateEscalation(employee) ? <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => navigate("/escalations/new?mode=standard&kind=feature")}>Feature Request</Button><Button variant="secondary" onClick={() => navigate("/escalations/new?mode=standard&kind=bug")}>Report Bug</Button><Button icon={<Plus size={17} />} onClick={() => navigate("/escalations/new")}>New Escalation</Button></div> : undefined} />

      <section aria-label="Escalation summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Open", value: metrics.open, icon: Inbox, tone: "text-info bg-info-soft" },
          { label: "Assigned to Me", value: metrics.assigned, icon: UserCheck, tone: "text-brand-strong bg-brand-soft" },
          { label: "Awaiting Response", value: metrics.awaiting, icon: Clock3, tone: "text-warning bg-warning-soft" },
          { label: "SLA Breached", value: metrics.breached, icon: AlertTriangle, tone: "text-error bg-error-soft" },
        ].map(({ label, value, icon: Icon, tone }) => <Card key={label} className="flex items-center gap-4 p-4"><span className={`grid size-10 place-items-center rounded-[var(--radius-md)] ${tone}`}><Icon size={19} /></span><div><p className="text-2xl font-semibold tracking-tight text-primary">{value}</p><p className="text-xs font-medium text-muted">{label}</p></div></Card>)}
      </section>

      <Card className="overflow-hidden">
        <div className="border-b border-default px-4 pt-4 sm:px-5">
          <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Escalation views">
            {views.filter((item) => item.id !== "team" || escalationRolePermissions[employee.role].viewTeam).map((item) => <button key={item.id} type="button" role="tab" aria-selected={view === item.id} onClick={() => setView(item.id)} className={`min-h-10 shrink-0 border-b-2 px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${view === item.id ? "border-brand text-brand-strong" : "border-transparent text-muted hover:text-primary"}`}>{item.label}</button>)}
          </div>
        </div>

        <div className="space-y-3 border-b border-default bg-subtle/50 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row">
            <label className="relative flex-1"><span className="sr-only">Search escalations</span><Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className={`${fieldClass} pl-9`} type="search" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Search ID, ticket, or issue title" /></label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex">
              <select aria-label="Filter by status" className={fieldClass} value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value as EscalationFilters["status"] })}><option value="">All statuses</option>{allStatuses.map((status) => <option key={status}>{status}</option>)}</select>
              <select aria-label="Filter by priority" className={fieldClass} value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value as EscalationFilters["priority"] })}><option value="">All priorities</option>{priorities.map((priority) => <option key={priority}>{priority}</option>)}</select>
              <select aria-label="Filter by tier" className={fieldClass} value={filters.tier} onChange={(event) => setFilters({ ...filters, tier: event.target.value ? Number(event.target.value) as 1 | 2 | 3 : "" })}><option value="">All tiers</option><option value="1">Tier 1</option><option value="2">Tier 2</option><option value="3">Tier 3</option></select>
              <select aria-label="Filter by SLA state" className={fieldClass} value={filters.slaState} onChange={(event) => setFilters({ ...filters, slaState: event.target.value as EscalationFilters["slaState"] })}><option value="">All SLA states</option><option value="healthy">Healthy</option><option value="due-soon">Due soon</option><option value="breached">Breached</option><option value="met">Met</option></select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <select aria-label="Filter by department" className={`${fieldClass} max-w-[220px]`} value={filters.department} onChange={(event) => setFilters({ ...filters, department: event.target.value })}><option value="">All departments</option>{departments.map((department) => <option key={department}>{department}</option>)}</select>
            <select aria-label="Filter by clinic" className={`${fieldClass} max-w-[190px]`} value={filters.clinic} onChange={(event) => setFilters({ ...filters, clinic: event.target.value })}><option value="">All clinics</option>{clinics.map((clinic) => <option key={clinic}>{clinic}</option>)}</select>
            {hasFilters && <Button variant="ghost" icon={<RotateCcw size={15} />} onClick={() => setFilters(initialFilters)}>Clear filters</Button>}
          </div>
        </div>

        {error && <p role="alert" className="m-5 rounded-[var(--radius-md)] border border-error-border bg-error-soft p-4 text-sm text-error">{error}</p>}
        {loading ? <div className="space-y-2 p-5" aria-label="Loading escalations">{[1,2,3,4].map((row) => <div key={row} className="h-16 animate-pulse rounded-[var(--radius-md)] bg-subtle motion-reduce:animate-none" />)}</div> : paged.length === 0 ? <EmptyState icon={Search} title="No escalations found" description="Try another view or clear the current filters." /> : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
                <thead className="bg-subtle text-xs font-semibold text-muted"><tr>{["Escalation ID", "Issue / Category", "Raised By", "Clinic / Department", "Accountable Owner", "Tier", "Priority", "Status", "SLA Remaining"].map((header) => <th key={header} scope="col" className="px-4 py-3">{header}</th>)}<th scope="col" className="px-4 py-3"><button type="button" onClick={() => setSortAscending((current) => !current)} className="inline-flex items-center gap-1 hover:text-primary">Last Updated <ArrowDownUp size={13} /></button></th></tr></thead>
                <tbody className="divide-y divide-default">{paged.map((item) => <tr key={item.id} tabIndex={0} onClick={() => navigate(`/escalations/${item.id}`)} onKeyDown={(event) => { if (event.key === "Enter") navigate(`/escalations/${item.id}`); }} className="cursor-pointer bg-surface transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"><td className="px-4 py-3 font-semibold text-brand-strong">{item.reference ?? item.id}</td><td className="max-w-[230px] px-4 py-3"><p className="truncate font-semibold text-primary">{item.title}</p><p className="mt-0.5 text-xs text-muted">{categoryDefinitionsLabel(item.category)}</p></td><td className="px-4 py-3 text-secondary">{item.reporter.displayName}</td><td className="px-4 py-3 text-secondary">{item.clinic ?? item.responsibleDepartment}</td><td className="px-4 py-3 text-secondary">{item.accountableOwner.displayName}</td><td className="px-4 py-3"><TierBadge tier={item.tier} /></td><td className="px-4 py-3"><PriorityBadge priority={item.priority} /></td><td className="px-4 py-3"><StatusBadge status={item.status} /></td><td className="px-4 py-3"><SlaIndicator item={item} /></td><td className="whitespace-nowrap px-4 py-3 text-xs text-muted">{formatDate(item.updatedAt)}</td></tr>)}</tbody>
              </table>
            </div>
            <div className="divide-y divide-default lg:hidden">{paged.map((item) => <button key={item.id} type="button" onClick={() => navigate(`/escalations/${item.id}`)} className="block w-full p-4 text-left hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-brand-strong">{item.reference ?? item.id}</p><p className="mt-1 font-semibold text-primary">{item.title}</p></div><PriorityBadge priority={item.priority} /></div><div className="mt-3 flex flex-wrap items-center gap-2"><StatusBadge status={item.status} /><TierBadge tier={item.tier} /><SlaIndicator item={item} /></div><div className="mt-3 flex justify-between gap-3 text-xs text-muted"><span>{item.accountableOwner.displayName}</span><span>{formatDate(item.updatedAt)}</span></div></button>)}</div>
          </>
        )}
        <div className="flex flex-col gap-3 border-t border-default px-4 py-3 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-5"><div className="flex items-center gap-3"><span>{visible.length} record{visible.length === 1 ? "" : "s"}</span>{import.meta.env.VITE_USE_MOCK_AUTH === "true" && <button type="button" className="text-xs font-semibold text-muted underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" onClick={() => { if (window.confirm("Reset all local escalation demo records to the original fictional examples?")) { escalationService.resetDemoData(); void escalationService.listEscalations(employee).then(setItems); setFilters(initialFilters); setView("all"); } }}>Reset demo data</button>}</div><div className="flex items-center gap-2"><Button variant="secondary" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Previous</Button><span className="px-2">{page} / {pages}</span><Button variant="secondary" disabled={page === pages} onClick={() => setPage((current) => current + 1)}>Next</Button></div></div>
      </Card>
    </div>
  );
}

function categoryDefinitionsLabel(category: Escalation["category"]) {
  return category === "clinicops" ? "ClinicOps" : category === "pawcare" ? "PawCare" : category.charAt(0).toUpperCase() + category.slice(1);
}
