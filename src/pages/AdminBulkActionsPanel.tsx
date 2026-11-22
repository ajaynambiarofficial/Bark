import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileUp, KeyRound, PackagePlus, UserPlus } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

interface AdminRole { id: string; key: string; name: string; clearanceLevel: number }
interface AdminClinic { id: string; name: string; active: boolean }
interface CsvRecord { line: number; fields: Record<string, string>; errors: string[] }
interface ImportResult { line: number; label: string; ok: boolean; message: string; password?: string }
type BulkKind = "agents" | "services";

const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api";
const inputClass = "min-h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-primary";

async function api<T>(path: string, value: unknown): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(value) });
  const body = await response.json().catch(() => null) as { data?: T; error?: { message?: string } } | null;
  if (!response.ok) throw new Error(body?.error?.message ?? "The row could not be imported.");
  return body?.data as T;
}

function parseCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!;
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') { cell += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else cell += character;
    } else if (character === '"' && cell.length === 0) quoted = true;
    else if (character === ",") { row.push(cell.trim()); cell = ""; }
    else if (character === "\n") { row.push(cell.trim().replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += character;
  }
  if (quoted) throw new Error("The CSV has an unclosed quoted field.");
  if (row.length || cell.length) { row.push(cell.trim().replace(/\r$/, "")); rows.push(row); }
  return rows.filter((values) => values.some((value) => value.trim().length));
}

function readCsv(source: string, requiredHeaders: string[]): CsvRecord[] {
  const matrix = parseCsv(source);
  if (!matrix.length) return [];
  const headers = matrix[0]!.map((header, index) => (index === 0 ? header.replace(/^\uFEFF/, "") : header).trim().toLowerCase());
  const missing = requiredHeaders.filter((header) => !headers.includes(header.toLowerCase()));
  if (missing.length) throw new Error(`Missing CSV column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`);
  if (headers.length > 30) throw new Error("The CSV has too many columns.");
  const records = matrix.slice(1).map((cells, index) => ({
    line: index + 2,
    fields: Object.fromEntries(headers.map((header, column) => [header, (cells[column] ?? "").trim()])),
    errors: [],
  }));
  if (records.length > 50) throw new Error("Import up to 50 rows at a time.");
  return records;
}

function markDuplicates(records: CsvRecord[], field: string, label: string) {
  const matches = new Map<string, CsvRecord[]>();
  for (const record of records) {
    const value = record.fields[field]?.trim().toLowerCase();
    if (value) matches.set(value, [...(matches.get(value) ?? []), record]);
  }
  for (const duplicateRows of matches.values()) {
    if (duplicateRows.length > 1) for (const record of duplicateRows) record.errors.push(`Duplicate ${label} in this file.`);
  }
}

function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s]*[=+@\-\t]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, columns: string[], rows: unknown[][]) {
  const csv = [columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function newPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function AdminBulkActionsPanel({ roles, clinics, mockMode = false }: { roles: AdminRole[]; clinics: AdminClinic[]; mockMode?: boolean }) {
  const [kind, setKind] = useState<BulkKind>("agents");
  const [agentCsv, setAgentCsv] = useState("");
  const [serviceCsv, setServiceCsv] = useState("");
  const [agentRoleId, setAgentRoleId] = useState(() => roles.find((role) => role.key === "sales-agent")?.id ?? "");
  const [activeClinicIds, setActiveClinicIds] = useState<string[]>([]);
  const [serviceReason, setServiceReason] = useState("");
  const [agentResults, setAgentResults] = useState<ImportResult[]>([]);
  const [serviceResults, setServiceResults] = useState<ImportResult[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [agentFileError, setAgentFileError] = useState("");
  const [serviceFileError, setServiceFileError] = useState("");
  const agentInputRef = useRef<HTMLTextAreaElement>(null);
  const serviceInputRef = useRef<HTMLTextAreaElement>(null);
  const agentFileRef = useRef<HTMLInputElement>(null);
  const serviceFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!agentRoleId) setAgentRoleId(roles.find((role) => role.key === "sales-agent")?.id ?? "");
  }, [agentRoleId, roles]);

  const agentRecords = useMemo(() => {
    if (!agentCsv.trim()) return [];
    try {
      const rows = readCsv(agentCsv, ["employeeCode", "email", "displayName", "department", "assignment"]);
      markDuplicates(rows, "employeecode", "employee ID"); markDuplicates(rows, "email", "email address");
      for (const row of rows) {
        const f = row.fields;
        const employeeCode = f.employeecode ?? ""; const email = f.email ?? ""; const displayName = f.displayname ?? ""; const department = f.department ?? ""; const assignment = f.assignment ?? "";
        if (employeeCode.length < 2 || employeeCode.length > 80) row.errors.push("Employee ID must be 2–80 characters.");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) row.errors.push("Enter a valid email address.");
        if (displayName.length < 2 || displayName.length > 160) row.errors.push("Name must be 2–160 characters.");
        if (department.length < 2 || department.length > 120) row.errors.push("Department must be 2–120 characters.");
        if (assignment.length < 2 || assignment.length > 160) row.errors.push("Assignment must be 2–160 characters.");
      }
      return rows;
    } catch (cause) { return [{ line: 0, fields: {}, errors: [cause instanceof Error ? cause.message : "Invalid CSV."] }]; }
  }, [agentCsv]);

  const serviceRecords = useMemo(() => {
    if (!serviceCsv.trim()) return [];
    try {
      const rows = readCsv(serviceCsv, ["sku", "name", "category", "durationMinutes", "basePrice"]);
      markDuplicates(rows, "sku", "service code");
      for (const row of rows) {
        const f = row.fields; const sku = f.sku ?? ""; const name = f.name ?? ""; const category = f.category ?? ""; const duration = Number(f.durationminutes); const price = Number(f.baseprice);
        if (sku.length < 2 || sku.length > 80) row.errors.push("Service code must be 2–80 characters.");
        if (name.length < 2 || name.length > 200) row.errors.push("Service name must be 2–200 characters.");
        if (category.length < 2 || category.length > 80) row.errors.push("Category must be 2–80 characters.");
        if (!Number.isInteger(duration) || duration < 1 || duration > 1440) row.errors.push("Duration must be a whole number from 1 to 1440 minutes.");
        if (!Number.isFinite(price) || price < 0 || price > 1_000_000) row.errors.push("Price must be between ₹0 and ₹1,000,000.");
        if ((f.description ?? "").length > 2000) row.errors.push("Description must be under 2,000 characters.");
      }
      return rows;
    } catch (cause) { return [{ line: 0, fields: {}, errors: [cause instanceof Error ? cause.message : "Invalid CSV."] }]; }
  }, [serviceCsv]);

  const resetResults = (nextKind: BulkKind) => {
    const hasPasswords = agentResults.some((row) => row.password);
    if (nextKind !== kind && hasPasswords && !window.confirm("Generated passwords are only shown here. Export them before switching; switching will clear them.")) return false;
    setError(""); setAgentResults([]); setServiceResults([]); setKind(nextKind); return true;
  };

  const updateCsv = (nextKind: BulkKind, value: string) => {
    if (nextKind === "agents" && agentResults.some((row) => row.password) && !window.confirm("Changing this file will clear generated passwords. Export them before continuing.")) return;
    if (nextKind === "agents") { setAgentCsv(value); setAgentResults([]); setAgentFileError(""); }
    else { setServiceCsv(value); setServiceResults([]); setServiceFileError(""); }
    setError("");
  };

  const loadFile = async (file: File | undefined, nextKind: BulkKind) => {
    if (!file) return;
    if (nextKind === "agents" && agentResults.some((row) => row.password) && !window.confirm("Changing this file will clear generated passwords. Export them before continuing.")) return;
    const setFileError = nextKind === "agents" ? setAgentFileError : setServiceFileError;
    try {
      if (file.size > 1_000_000) throw new Error("Choose a CSV file smaller than 1 MB.");
      const text = await file.text();
      if (nextKind === "agents") { setAgentCsv(text); setAgentResults([]); }
      else { setServiceCsv(text); setServiceResults([]); }
      setFileError(""); setError("");
    } catch (cause) {
      setFileError(cause instanceof Error ? cause.message : "Could not read that CSV file.");
    }
  };

  const runAgentImport = async () => {
    if (agentResults.some((row) => row.password) && !window.confirm("Creating these accounts again will clear the currently generated passwords. Export them before continuing.")) return;
    setError(""); setAgentResults([]);
    const role = roles.find((candidate) => candidate.id === agentRoleId);
    if (!role || role.key !== "sales-agent") { setError("Select the Sales Agent role before importing accounts."); return; }
    const valid = agentRecords.filter((row) => row.line > 0 && !row.errors.length);
    if (!valid.length) { setError(agentRecords.length ? "Fix row errors before creating accounts." : "Import a CSV with agent rows first."); return; }
    setRunning(true);
    const results: ImportResult[] = [];
    for (const row of valid) {
      const f = row.fields; const password = newPassword(); const employeeCode = f.employeecode ?? ""; const email = f.email ?? "";
      try {
        await api("/admin/users", { employeeCode, email, displayName: f.displayname ?? "", department: f.department ?? "", assignment: f.assignment ?? "", password, roleId: role.id, clinicIds: [] });
        results.push({ line: row.line, label: `${employeeCode} · ${email}`, ok: true, message: "Account created", password });
      } catch (cause) {
        results.push({ line: row.line, label: `${employeeCode} · ${email}`, ok: false, message: cause instanceof Error ? cause.message : "Could not create account." });
      }
      setAgentResults([...results]);
    }
    setRunning(false);
  };

  const runServiceImport = async () => {
    setError(""); setServiceResults([]);
    if (!serviceReason.trim() || serviceReason.trim().length < 3) { setError("Enter a reason for creating these services."); return; }
    if (!activeClinicIds.length) { setError("Select at least one active clinic for the imported services."); return; }
    const valid = serviceRecords.filter((row) => row.line > 0 && !row.errors.length);
    if (!valid.length) { setError(serviceRecords.length ? "Fix row errors before creating services." : "Import a CSV with service rows first."); return; }
    setRunning(true);
    const clinicSettings = Object.fromEntries(activeClinicIds.map((id) => [id, { active: true, price: null, durationMinutes: null }]));
    const results: ImportResult[] = [];
    for (const row of valid) {
      const f = row.fields; const sku = f.sku ?? ""; const name = f.name ?? "";
      try {
        await api("/admin/configuration/services", { sku, name, category: f.category ?? "", durationMinutes: Number(f.durationminutes), basePrice: Number(f.baseprice), description: f.description ?? "", active: true, clinicSettings, reason: serviceReason.trim() });
        results.push({ line: row.line, label: `${sku.toUpperCase()} · ${name}`, ok: true, message: "Service created" });
      } catch (cause) {
        results.push({ line: row.line, label: `${sku.toUpperCase()} · ${name}`, ok: false, message: cause instanceof Error ? cause.message : "Could not create service." });
      }
      setServiceResults([...results]);
    }
    setRunning(false);
  };

  const downloadAgentTemplate = () => downloadCsv("bark-agent-import-template.csv", ["employeeCode", "email", "displayName", "department", "assignment"], [["AGENT-101", "agent@example.com", "Agent Name", "Sales", "Pawcare Operations"]]);
  const downloadServiceTemplate = () => downloadCsv("bark-service-import-template.csv", ["sku", "name", "category", "durationMinutes", "basePrice", "description"], [["GROOM-BATH", "Bath and Dry", "Grooming", "60", "500", "Bath, dry, and basic brushing"]]);
  const passwordResults = agentResults.filter((row) => row.ok && row.password);
  const preview = kind === "agents" ? agentRecords : serviceRecords;
  const validCount = preview.filter((row) => row.line > 0 && !row.errors.length).length;

  return <div className="space-y-5 p-4 sm:p-6">
    <div><p className="text-xs font-semibold uppercase tracking-wide text-brand">Admin tools</p><h2 className="mt-1 text-xl font-semibold text-primary">Bulk Actions</h2><p className="mt-1 max-w-3xl text-sm text-secondary">Import multiple agent accounts or clinic services from CSV. Each row uses the same validation and audit trail as a regular admin creation.</p></div>
    {mockMode && <p role="status" className="rounded-lg border border-info-border bg-info-soft p-3 text-sm text-info">Bulk creation requires the connected backend and is unavailable in mock mode.</p>}
    <div className="grid gap-3 sm:grid-cols-2" role="tablist" aria-label="Bulk action type">
      <button type="button" role="tab" aria-selected={kind === "agents"} onClick={() => resetResults("agents")} className={`flex min-h-16 items-center gap-3 rounded-xl border px-4 text-left ${kind === "agents" ? "border-brand bg-brand-soft" : "border-default bg-surface hover:bg-subtle"}`}><UserPlus className="text-brand" size={20} /><span><span className="block text-sm font-semibold text-primary">Agent accounts</span><span className="mt-0.5 block text-xs text-secondary">Create Sales Agent logins</span></span></button>
      <button type="button" role="tab" aria-selected={kind === "services"} onClick={() => resetResults("services")} className={`flex min-h-16 items-center gap-3 rounded-xl border px-4 text-left ${kind === "services" ? "border-brand bg-brand-soft" : "border-default bg-surface hover:bg-subtle"}`}><PackagePlus className="text-brand" size={20} /><span><span className="block text-sm font-semibold text-primary">Services</span><span className="mt-0.5 block text-xs text-secondary">Add services to selected clinics</span></span></button>
    </div>
    {error && <p role="alert" className="rounded-lg border border-error-border bg-error-soft p-3 text-sm text-error">{error}</p>}
    {kind === "agents" ? <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-primary">Create Sales Agent accounts</h3><p className="mt-1 text-sm text-secondary">Import employee details; unique initial passwords are generated for each account.</p></div><div className="flex gap-2"><Button variant="secondary" onClick={downloadAgentTemplate} icon={<Download size={15} />}>CSV template</Button><Button variant="secondary" onClick={() => agentFileRef.current?.click()} icon={<FileUp size={15} />}>Choose CSV</Button></div></div>
      <input ref={agentFileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => void loadFile(event.target.files?.[0], "agents")} />
      <div className="block text-sm font-medium text-primary">Account role<p className={`${inputClass} mt-1.5 flex items-center`}>{roles.find((role) => role.id === agentRoleId)?.name ?? "Sales Agent role unavailable"}</p>
        <textarea ref={agentInputRef} value={agentCsv} onChange={(event) => updateCsv("agents", event.target.value)} rows={6} spellCheck={false} placeholder={'employeeCode,email,displayName,department,assignment\nAGENT-101,agent@example.com,Agent Name,Sales,Pawcare Operations'} className="mt-2 w-full rounded-lg border border-input bg-input p-3 font-mono text-xs text-primary" />
      </div>
      {agentFileError && <p role="alert" className="text-sm text-error">{agentFileError}</p>}
      <p className="text-xs leading-5 text-secondary">Use the header row exactly as shown. Max 50 rows per import. Passwords stay in this page’s memory and are never saved to browser storage. Export the successful accounts’ credentials before leaving.</p>
      {agentRecords.length > 0 && <ImportPreview rows={agentRecords} kind="agents" />}
      <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-secondary">{validCount} valid row{validCount === 1 ? "" : "s"} ready; invalid rows will be skipped</span><Button onClick={() => void runAgentImport()} disabled={mockMode || running || validCount === 0 || !agentRoleId} icon={<UserPlus size={16} />}>{running && kind === "agents" ? "Creating accounts…" : `Create ${validCount} account${validCount === 1 ? "" : "s"}`}</Button></div>
      {agentResults.length > 0 && <ImportResults results={agentResults} />}
      {passwordResults.length > 0 && <div className="space-y-3 rounded-xl border border-warning/30 bg-warning-soft p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="flex items-center gap-2 text-sm font-semibold text-primary"><KeyRound size={16} />Generated initial passwords</h4><p className="mt-1 text-xs leading-5 text-secondary">Export these credentials now and share them securely. They are shown only in this page session.</p></div><Button variant="secondary" onClick={() => downloadCsv("bark-agent-initial-credentials.csv", ["employeeCode", "email", "initialPassword"], passwordResults.map((row) => [row.label.split(" · ")[0], row.label.split(" · ")[1], row.password]))} icon={<Download size={15} />}>Export credentials</Button></div><div className="max-h-64 overflow-auto rounded-lg border border-default bg-surface"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-subtle text-muted"><tr><th className="px-3 py-2">Agent account</th><th className="px-3 py-2">Initial password</th></tr></thead><tbody>{passwordResults.map((row) => <tr key={row.line} className="border-t border-default"><td className="px-3 py-2">{row.label}</td><td className="select-all px-3 py-2 font-mono">{row.password}</td></tr>)}</tbody></table></div></div>}
    </Card> : <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-primary">Add services in bulk</h3><p className="mt-1 text-sm text-secondary">Each imported service is activated at the clinics you select, using the base price and duration.</p></div><div className="flex gap-2"><Button variant="secondary" onClick={downloadServiceTemplate} icon={<Download size={15} />}>CSV template</Button><Button variant="secondary" onClick={() => serviceFileRef.current?.click()} icon={<FileUp size={15} />}>Choose CSV</Button></div></div>
      <input ref={serviceFileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => void loadFile(event.target.files?.[0], "services")} />
      <label className="block text-sm font-medium text-primary">Service CSV<textarea ref={serviceInputRef} value={serviceCsv} onChange={(event) => updateCsv("services", event.target.value)} rows={6} spellCheck={false} placeholder={'sku,name,category,durationMinutes,basePrice,description\nGROOM-BATH,Bath and Dry,Grooming,60,500,Bath and basic brushing'} className="mt-1.5 w-full rounded-lg border border-input bg-input p-3 font-mono text-xs text-primary" /></label>
      {serviceFileError && <p role="alert" className="text-sm text-error">{serviceFileError}</p>}
      <fieldset><legend className="text-sm font-medium text-primary">Offer these services at</legend><div className="mt-2 flex flex-wrap gap-2">{clinics.filter((clinic) => clinic.active).map((clinic) => <label key={clinic.id} className="flex items-center gap-2 rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary"><input type="checkbox" checked={activeClinicIds.includes(clinic.id)} onChange={(event) => setActiveClinicIds((current) => event.target.checked ? [...current, clinic.id] : current.filter((id) => id !== clinic.id))} />{clinic.name}</label>)}{!clinics.some((clinic) => clinic.active) && <p className="text-sm text-secondary">No active clinics are configured.</p>}</div></fieldset>
      <label className="block text-sm font-medium text-primary">Reason for creating these services<input value={serviceReason} onChange={(event) => setServiceReason(event.target.value)} required minLength={3} maxLength={1000} className={`${inputClass} mt-1.5`} placeholder="e.g. Add the new grooming menu" /></label>
      <p className="text-xs leading-5 text-secondary">Required columns: sku, name, category, durationMinutes, basePrice. Description is optional. Max 50 rows per import. Each successful row is recorded in the admin audit history.</p>
      {serviceRecords.length > 0 && <ImportPreview rows={serviceRecords} kind="services" />}
      <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-secondary">{validCount} valid row{validCount === 1 ? "" : "s"} ready</span><Button onClick={() => void runServiceImport()} disabled={mockMode || running || validCount === 0 || !serviceReason.trim() || !activeClinicIds.length} icon={<PackagePlus size={16} />}>{running && kind === "services" ? "Creating services…" : `Create ${validCount} service${validCount === 1 ? "" : "s"}`}</Button></div>
      {serviceResults.length > 0 && <ImportResults results={serviceResults} />}
    </Card>}
  </div>;
}

function ImportPreview({ rows, kind }: { rows: CsvRecord[]; kind: BulkKind }) {
  return <section className="overflow-hidden rounded-xl border border-default" aria-label="Import preview"><div className="flex flex-wrap justify-between gap-2 bg-subtle px-3 py-2"><h4 className="text-sm font-semibold text-primary">Preview and validation</h4><span className="text-xs text-secondary">{rows.filter((row) => !row.errors.length && row.line > 0).length} valid · {rows.filter((row) => row.errors.length).length} with errors</span></div><div className="max-h-72 overflow-auto"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-surface text-muted"><tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">{kind === "agents" ? "Agent" : "Service"}</th><th className="px-3 py-2">Details</th></tr></thead><tbody>{rows.map((row) => <tr key={row.line} className="border-t border-default align-top"><td className="px-3 py-2 text-secondary">{row.line || "CSV"}</td><td className="px-3 py-2 font-medium text-primary">{kind === "agents" ? `${row.fields.employeecode ?? ""} · ${row.fields.displayname ?? ""}` : `${row.fields.sku ?? ""} · ${row.fields.name ?? ""}`}</td><td className={`px-3 py-2 ${row.errors.length ? "text-error" : "text-success"}`}>{row.errors.length ? row.errors.join(" ") : "Ready to create"}</td></tr>)}</tbody></table></div></section>;
}

function ImportResults({ results }: { results: ImportResult[] }) {
  const success = results.filter((row) => row.ok).length;
  return <section className="overflow-hidden rounded-xl border border-default" aria-live="polite"><div className="flex flex-wrap justify-between gap-2 bg-subtle px-3 py-2"><h4 className="text-sm font-semibold text-primary">Import results</h4><span className="text-xs text-secondary">{success} created · {results.length - success} failed</span></div><div className="max-h-64 overflow-auto"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-surface text-muted"><tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Record</th><th className="px-3 py-2">Result</th></tr></thead><tbody>{results.map((result) => <tr key={result.line} className="border-t border-default"><td className="px-3 py-2">{result.line}</td><td className="px-3 py-2 text-primary">{result.label}</td><td className={`px-3 py-2 ${result.ok ? "text-success" : "text-error"}`}>{result.message}</td></tr>)}</tbody></table></div></section>;
}
