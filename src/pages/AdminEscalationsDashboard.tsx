import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, RefreshCw, Search, Trash2 } from "lucide-react";
import { Link } from "react-router";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

type IssueType = "standard" | "escalation";
interface Person { displayName: string; department: string; roleLabel: string }
interface AdminEscalation {
  id: string;
  reference: string;
  issueType: IssueType;
  title: string;
  description: string;
  category: string;
  issueSubtype: string;
  customIssue: string | null;
  linkedTicketId: string | null;
  originatingDepartment: string;
  responsibleDepartment: string;
  assignedTeam: string;
  tier: number;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  slaDueAt: string;
  resolvedAt: string | null;
}
interface EscalationRow { escalation: AdminEscalation; reporter: Person; owner: Person; clinic: { id: string; name: string } | null }
type RecordType = "escalation" | "feature" | "bug" | "other-issue";
type SortBy = "created-desc" | "created-asc" | "updated-desc" | "priority" | "status" | "type" | "sla";

const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api";
const statuses = ["New", "Assigned", "In Progress", "Awaiting Response", "Resolved", "Closed", "Reopened"];
const categories: Record<string, string> = { pawcare: "Pawcare", nugget: "Nugget", ameyo: "Ameyo", ticket: "Ticketing", clinicops: "Clinic operations" };
const priorities = ["P1", "P2", "P3", "Standard"];
const openStatuses = new Set(["New", "Assigned", "In Progress", "Awaiting Response", "Reopened"]);

function recordType(row: AdminEscalation): RecordType {
  if (row.issueType === "escalation") return "escalation";
  const subtype = `${row.issueSubtype} ${row.title}`.toLowerCase();
  if (subtype.includes("feature request")) return "feature";
  if (subtype.includes("bug report") || subtype.startsWith("bug ")) return "bug";
  return "other-issue";
}
const typeLabels: Record<RecordType, string> = { escalation: "Escalation", feature: "Feature request", bug: "Bug report", "other-issue": "Other issue" };
function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
function dateKey(value: string | null | undefined) { return value ? new Date(value).getTime() : 0; }
function isOverdue(record: AdminEscalation) { return openStatuses.has(record.status) && dateKey(record.slaDueAt) < Date.now(); }
function csvCell(value: unknown) {
  let normalized = String(value ?? "").replace(/[\r\n]+/g, " ");
  if (/^[\s]*[=+@\-\t]/.test(normalized)) normalized = `'${normalized}`;
  return `"${normalized.replace(/"/g, '""')}"`;
}
function exportCsv(rows: EscalationRow[]) {
  const columns: Array<[string, (row: EscalationRow) => unknown]> = [
    ["Reference", (row) => row.escalation.reference],
    ["Type", (row) => typeLabels[recordType(row.escalation)]],
    ["Title", (row) => row.escalation.title],
    ["Description", (row) => row.escalation.description],
    ["Status", (row) => row.escalation.status],
    ["Priority", (row) => row.escalation.priority],
    ["Tier", (row) => row.escalation.tier],
    ["Product area", (row) => categories[row.escalation.category] ?? row.escalation.category],
    ["Issue", (row) => row.escalation.customIssue || row.escalation.issueSubtype],
    ["Reporter", (row) => row.reporter.displayName],
    ["Reporter department", (row) => row.escalation.originatingDepartment],
    ["Current owner", (row) => row.owner.displayName],
    ["Responsible department", (row) => row.escalation.responsibleDepartment],
    ["Assigned team", (row) => row.escalation.assignedTeam],
    ["Clinic", (row) => row.clinic?.name ?? ""],
    ["Linked ticket", (row) => row.escalation.linkedTicketId ?? ""],
    ["Created", (row) => row.escalation.createdAt],
    ["Last updated", (row) => row.escalation.updatedAt],
    ["SLA due", (row) => row.escalation.slaDueAt],
    ["SLA state", (row) => isOverdue(row.escalation) ? "Overdue" : "Within SLA / complete"],
    ["Resolved", (row) => row.escalation.resolvedAt ?? ""],
  ];
  const content = [columns.map(([label]) => csvCell(label)).join(","), ...rows.map((row) => columns.map(([, value]) => csvCell(value(row))).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `bark-admin-issues-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AdminEscalationsDashboard() {
  const [rows, setRows] = useState<EscalationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<RecordType | "">("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [category, setCategory] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("created-desc");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const all: EscalationRow[] = [];
      let offset = 0;
      while (true) {
        const response = await fetch(`${apiBase}/admin/escalation-dashboard?limit=100&offset=${offset}`, { credentials: "include" });
        const body = await response.json().catch(() => null) as { data?: EscalationRow[]; error?: { message?: string } } | null;
        if (!response.ok) throw new Error(body?.error?.message ?? "Could not load escalation records.");
        const batch = body?.data ?? [];
        all.push(...batch);
        if (batch.length < 100) break;
        offset += batch.length;
      }
      setRows(all);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load the admin dashboard."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const deleteEscalation = async (item: AdminEscalation) => {
    const confirmed = window.confirm(`Delete ${item.reference} — ${item.title}? It will be removed from the active escalation dashboard.`);
    if (!confirmed) return;
    setError("");
    setDeletingId(item.id);
    try {
      const response = await fetch(`${apiBase}/admin/escalation-dashboard/${item.id}`, { method: "DELETE", credentials: "include" });
      const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      if (!response.ok) throw new Error(body?.error?.message ?? "Could not delete this escalation.");
      setRows((current) => current.filter(({ escalation }) => escalation.id !== item.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete this escalation.");
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const start = from ? new Date(`${from}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
    const end = to ? new Date(`${to}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY;
    return rows.filter(({ escalation: item, reporter, owner, clinic }) => {
      const kind = recordType(item);
      const haystack = [item.reference, item.title, item.description, item.issueSubtype, item.customIssue, reporter.displayName, owner.displayName, item.linkedTicketId, clinic?.name].filter(Boolean).join(" ").toLowerCase();
      return (!term || haystack.includes(term)) && (!type || kind === type) && (!status || item.status === status) && (!priority || item.priority === priority) && (!category || item.category === category) && dateKey(item.createdAt) >= start && dateKey(item.createdAt) <= end;
    });
  }, [rows, search, type, status, priority, category, from, to]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const left = a.escalation; const right = b.escalation;
    if (sortBy === "created-asc") return dateKey(left.createdAt) - dateKey(right.createdAt);
    if (sortBy === "updated-desc") return dateKey(right.updatedAt) - dateKey(left.updatedAt);
    if (sortBy === "priority") return priorities.indexOf(left.priority) - priorities.indexOf(right.priority) || dateKey(right.createdAt) - dateKey(left.createdAt);
    if (sortBy === "status") return statuses.indexOf(left.status) - statuses.indexOf(right.status) || dateKey(right.createdAt) - dateKey(left.createdAt);
    if (sortBy === "type") return typeLabels[recordType(left)].localeCompare(typeLabels[recordType(right)]) || dateKey(right.createdAt) - dateKey(left.createdAt);
    if (sortBy === "sla") return dateKey(left.slaDueAt) - dateKey(right.slaDueAt);
    return dateKey(right.createdAt) - dateKey(left.createdAt);
  }), [filtered, sortBy]);

  const openCount = filtered.filter(({ escalation }) => openStatuses.has(escalation.status)).length;
  const overdueCount = filtered.filter(({ escalation }) => isOverdue(escalation)).length;
  const featureBugCount = filtered.filter(({ escalation }) => ["feature", "bug"].includes(recordType(escalation))).length;
  const inputClass = "min-h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-primary";

  return <div className="space-y-5 p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-xl font-semibold text-primary">Escalations &amp; issues</h2><p className="mt-1 text-sm text-secondary">Company-wide view of escalations, feature requests, and bug reports.</p></div>
      <div className="flex gap-2"><Button variant="secondary" onClick={() => void load()} disabled={loading} icon={<RefreshCw size={16} />}>Refresh</Button><Button onClick={() => exportCsv(sorted)} disabled={!sorted.length || loading} icon={<Download size={16} />}>Export CSV</Button></div>
    </div>
    {error && <p role="alert" className="rounded-lg border border-error-border bg-error-soft p-3 text-sm text-error">{error}</p>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card className="p-4"><p className="text-sm text-secondary">Matching records</p><p className="mt-1 text-2xl font-semibold text-primary">{filtered.length}</p><p className="mt-1 text-xs text-muted">of {rows.length} total</p></Card>
      <Card className="p-4"><p className="text-sm text-secondary">Open work</p><p className="mt-1 text-2xl font-semibold text-primary">{openCount}</p><p className="mt-1 text-xs text-muted">Requires follow-up</p></Card>
      <Card className="p-4"><p className="text-sm text-secondary">Feature requests &amp; bugs</p><p className="mt-1 text-2xl font-semibold text-primary">{featureBugCount}</p><p className="mt-1 text-xs text-muted">Product feedback records</p></Card>
      <Card className="p-4"><p className="text-sm text-secondary">Overdue SLA</p><p className={`mt-1 text-2xl font-semibold ${overdueCount ? "text-error" : "text-primary"}`}>{overdueCount}</p><p className="mt-1 text-xs text-muted">Open records past target</p></Card>
    </div>
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary"><span className="text-brand">Filters</span><span className="text-xs font-normal text-secondary">Export uses the current filtered and sorted results.</span></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="relative block sm:col-span-2 xl:col-span-1"><span className="sr-only">Search records</span><Search className="absolute left-3 top-3 text-muted" size={16} /><input aria-label="Search records" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, ID, reporter…" className={`${inputClass} pl-10`} /></label>
        <label><span className="sr-only">Record type</span><select aria-label="Record type" value={type} onChange={(event) => setType(event.target.value as RecordType | "")} className={inputClass}><option value="">All types</option>{Object.entries(typeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label><span className="sr-only">Status</span><select aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value)} className={inputClass}><option value="">All statuses</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span className="sr-only">Priority</span><select aria-label="Priority" value={priority} onChange={(event) => setPriority(event.target.value)} className={inputClass}><option value="">All priorities</option>{priorities.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span className="sr-only">Product area</span><select aria-label="Product area" value={category} onChange={(event) => setCategory(event.target.value)} className={inputClass}><option value="">All areas</option>{Object.entries(categories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label><span className="sr-only">Created from</span><input aria-label="Created from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className={inputClass} /></label>
        <label><span className="sr-only">Created through</span><input aria-label="Created through" type="date" value={to} onChange={(event) => setTo(event.target.value)} className={inputClass} /></label>
        <label><span className="sr-only">Sort results</span><select aria-label="Sort results" value={sortBy} onChange={(event) => setSortBy(event.target.value as SortBy)} className={inputClass}><option value="created-desc">Newest created</option><option value="created-asc">Oldest created</option><option value="updated-desc">Recently updated</option><option value="priority">Priority</option><option value="status">Status</option><option value="type">Type</option><option value="sla">SLA deadline</option></select></label>
      </div>
    </Card>
    <Card className="overflow-hidden">
      {loading ? <p className="p-8 text-center text-sm text-secondary">Loading all records…</p> : sorted.length === 0 ? <p className="p-8 text-center text-sm text-secondary">No records match these filters.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm">
        <thead className="bg-subtle text-xs uppercase text-muted"><tr>{["Record", "Type / area", "Status", "Priority", "Reporter", "Owner", "Created", "SLA", "Actions"].map((label, index) => <th key={`${label}-${index}`} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead>
        <tbody>{sorted.map(({ escalation: item, reporter, owner, clinic }) => {
          const kind = recordType(item);
          const late = isOverdue(item);
          return <tr key={item.id} className="border-t border-default align-top hover:bg-hover/50">
            <td className="max-w-[320px] px-4 py-3"><Link to={`/escalations/${item.id}`} className="font-semibold text-brand-strong hover:underline">{item.title}</Link><p className="mt-1 text-xs text-muted">{item.reference} · {item.issueSubtype}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-secondary">{item.description}</p></td>
            <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${kind === "escalation" ? "bg-red-100 text-red-800" : kind === "feature" ? "bg-sky-100 text-sky-800" : kind === "bug" ? "bg-amber-100 text-amber-800" : "bg-subtle text-secondary"}`}>{typeLabels[kind]}</span><p className="mt-2 text-xs text-secondary">{categories[item.category] ?? item.category}{clinic?.name ? ` · ${clinic.name}` : ""}</p></td>
            <td className="px-4 py-3"><span className="whitespace-nowrap">{item.status}</span><p className="mt-1 text-xs text-muted">Tier {item.tier}</p></td>
            <td className="px-4 py-3 whitespace-nowrap">{item.priority}</td>
            <td className="px-4 py-3">{reporter.displayName}<p className="mt-1 text-xs text-muted">{item.originatingDepartment}</p></td>
            <td className="px-4 py-3">{owner.displayName}<p className="mt-1 text-xs text-muted">{item.assignedTeam}</p></td>
            <td className="px-4 py-3 whitespace-nowrap">{formatDate(item.createdAt)}</td>
            <td className={`px-4 py-3 whitespace-nowrap ${late ? "font-semibold text-error" : "text-secondary"}`}>{late ? "Overdue · " : ""}{formatDate(item.slaDueAt)}</td>
            <td className="px-4 py-3"><div className="flex items-center gap-1"><Link to={`/escalations/${item.id}`} aria-label={`Open ${item.reference}`} title="Open record" className="inline-flex size-9 items-center justify-center rounded-lg text-secondary hover:bg-hover hover:text-primary"><ExternalLink size={16} /></Link><button type="button" onClick={() => void deleteEscalation(item)} disabled={deletingId === item.id} aria-label={`Delete ${item.reference}`} title="Delete record" className="inline-flex size-9 items-center justify-center rounded-lg text-error hover:bg-error-soft disabled:cursor-wait disabled:opacity-50"><Trash2 size={16} /></button></div></td>
          </tr>;
        })}</tbody>
      </table></div>}
      {!loading && <div className="border-t border-default px-4 py-3 text-xs text-secondary">Showing {sorted.length} record{sorted.length === 1 ? "" : "s"}. Exported CSV reflects these results.</div>}
    </Card>
  </div>;
}
