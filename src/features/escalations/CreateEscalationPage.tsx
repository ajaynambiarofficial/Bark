import { ArrowLeft, CheckCircle2, FileText, Info, Paperclip, ShieldCheck, Trash2, UploadCloud, UserRound } from "lucide-react";
import { useMemo, useRef, useState, useEffect, type DragEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../../auth/AuthContext";
import { mockEmployees } from "../../data/employees";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { acceptedAttachmentTypes, categoryDefinitions, clinics, formatSlaTarget, getSlaPolicy, MAX_ATTACHMENT_BYTES, routingOwnerIds } from "./escalation.config";
import { escalationService } from "./escalation.service";
import { canCreateEscalation } from "./escalation.permissions";
import type { AttachmentMetadata, CreateEscalationInput, EscalationCategory, IssueType, ReferenceType } from "./escalation.types";
import { fieldClass, labelClass } from "./EscalationUi";

interface FormState {
  issueType: IssueType;
  referenceType: ReferenceType;
  category: EscalationCategory | "";
  module: string;
  channel: string;
  clinic: string;
  service: string;
  issueSubtype: string;
  customIssue: string;
  title: string;
  description: string;
  linkedTicketId: string;
  customerPhone: string;
  appointmentId: string;
}

const emptyForm: FormState = { issueType: "escalation", referenceType: "customer", category: "", module: "", channel: "", clinic: "", service: "", issueSubtype: "", customIssue: "", title: "", description: "", linkedTicketId: "", customerPhone: "", appointmentId: "" };

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function CreateEscalationPage() {
  const { employee } = useAuth();
  const navigate = useNavigate();
  const draftKey = `bark.escalation-draft.v1.${employee?.id ?? "unknown"}`;
  const initialDraft = useMemo(() => {
    try { return JSON.parse(window.localStorage.getItem(draftKey) ?? "null") as Partial<FormState> | null; } catch { return null; }
  }, [draftKey]);
  const [form, setForm] = useState<FormState>(() => ({ ...emptyForm, ...initialDraft, customerPhone: "" }));
  const [attachments, setAttachments] = useState<AttachmentMetadata[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [attachmentError, setAttachmentError] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(Boolean(initialDraft));
  const [titleEdited, setTitleEdited] = useState(Boolean(initialDraft?.title));
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const safeDraft = { ...form, customerPhone: "" };
    const hasContent = Boolean(form.category || form.title || form.description || form.linkedTicketId || form.appointmentId);
    if (hasContent) window.localStorage.setItem(draftKey, JSON.stringify(safeDraft));
  }, [draftKey, form]);

  if (!employee) return null;
  const category = form.category ? categoryDefinitions[form.category] : null;
  const parentValue = form.category === "pawcare" ? form.module : form.category === "ticket" ? form.channel : form.category === "clinicops" ? form.service : "";
  const issueOptions = category?.issues ?? (parentValue ? category?.parents?.[parentValue] ?? [] : []);
  const selectedPolicy = form.category ? getSlaPolicy(form.issueType, form.category) : null;
  const selectedCategory = form.category;
  const routingOwner = selectedCategory ? mockEmployees.find((candidate) => candidate.id === routingOwnerIds[selectedCategory]) : undefined;
  const allowed = canCreateEscalation(employee);

  const setValue = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => { const next = { ...current }; delete next[key]; return next; });
  };

  const selectCategory = (nextCategory: EscalationCategory) => {
    setForm((current) => ({ ...current, category: nextCategory, module: "", channel: "", clinic: "", service: "", issueSubtype: "", customIssue: "", title: titleEdited ? current.title : "" }));
    setErrors({});
  };

  const selectParent = (value: string) => {
    setForm((current) => ({ ...current, module: current.category === "pawcare" ? value : "", channel: current.category === "ticket" ? value : "", service: current.category === "clinicops" ? value : "", issueSubtype: "", customIssue: "", title: titleEdited ? current.title : "" }));
  };

  const selectIssue = (value: string) => {
    setForm((current) => ({ ...current, issueSubtype: value, customIssue: value === "Other / Not Listed" ? current.customIssue : "", title: titleEdited ? current.title : value }));
    setErrors((current) => ({ ...current, issueSubtype: "" }));
  };

  const addFiles = (files: FileList | File[]) => {
    const next: AttachmentMetadata[] = [];
    for (const file of Array.from(files)) {
      if (!acceptedAttachmentTypes.includes(file.type)) { setAttachmentError(`${file.name} is not a supported image or document.`); continue; }
      if (file.size > MAX_ATTACHMENT_BYTES) { setAttachmentError(`${file.name} exceeds the ${formatBytes(MAX_ATTACHMENT_BYTES)} limit.`); continue; }
      next.push({ id: `${file.name}-${file.lastModified}`, name: file.name, size: file.size, type: file.type });
    }
    if (next.length) { setAttachments((current) => [...current.filter((item) => !next.some((added) => added.id === item.id)), ...next]); setAttachmentError(""); }
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.category) next.category = "Choose the tool or operational area.";
    if (form.category === "clinicops" && !form.clinic) next.clinic = "Choose the clinic involved.";
    if (category?.parents && !parentValue) next.parent = `Choose ${category.parentLabel?.toLowerCase()}.`;
    if (!form.issueSubtype) next.issueSubtype = "Choose the issue that best matches the problem.";
    if (form.issueSubtype === "Other / Not Listed" && !form.customIssue.trim()) next.customIssue = "Describe the issue that is not listed.";
    if (!form.title.trim()) next.title = "Enter a short issue title.";
    if (form.referenceType === "customer") {
      if (!/^[A-Z0-9-]{4,30}$/.test(form.linkedTicketId.replace(/\s+/g, "").toUpperCase())) next.linkedTicketId = "Enter a valid ticket ID using letters, numbers, or hyphens.";
      if (!/^\d{10}$/.test(form.customerPhone)) next.customerPhone = "Enter exactly 10 digits.";
    }
    if (form.issueType === "escalation" && form.description.trim().length < 10) next.description = "Describe what happened and the assistance required (at least 10 characters).";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validate() || !form.category || pending) return;
    setPending(true);
    try {
      const input: CreateEscalationInput = {
        issueType: form.issueType, referenceType: form.referenceType, title: form.title.trim(), description: form.description.trim(), category: form.category,
        issueSubtype: form.issueSubtype, attachments,
        ...(form.module ? { module: form.module } : {}), ...(form.channel ? { channel: form.channel } : {}),
        ...(form.clinic ? { clinic: form.clinic } : {}), ...(form.service ? { service: form.service } : {}),
        ...(form.customIssue ? { customIssue: form.customIssue.trim() } : {}), ...(form.linkedTicketId ? { linkedTicketId: form.linkedTicketId } : {}),
        ...(form.customerPhone ? { customerPhone: form.customerPhone } : {}), ...(form.appointmentId ? { appointmentId: form.appointmentId.trim().toUpperCase() } : {}),
      };
      const created = await escalationService.createEscalation(input, employee);
      window.localStorage.removeItem(draftKey);
      setSuccess(`${created.reference ?? created.id} created successfully. Opening the case…`);
      window.setTimeout(() => navigate(`/escalations/${created.id}`, { replace: true }), 650);
    } catch (caught) {
      setErrors({ submit: caught instanceof Error ? caught.message : "Could not create the escalation." });
    } finally { setPending(false); }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div><Link to="/escalations" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"><ArrowLeft size={17} />Back to Escalations</Link><h1 className="mt-3 text-[clamp(1.65rem,3vw,2rem)] font-semibold tracking-[-0.035em] text-primary">Create Escalation</h1><p className="mt-2 text-[15px] text-secondary">Record an operational issue and route it to one accountable owner.</p></div>
      {draftRestored && <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-info-border bg-info-soft p-4 text-sm text-info sm:flex-row sm:items-center sm:justify-between"><span><strong>Draft restored.</strong> Customer phone and attachments are never retained in drafts.</span><Button variant="ghost" onClick={() => { window.localStorage.removeItem(draftKey); setForm(emptyForm); setAttachments([]); setDraftRestored(false); setTitleEdited(false); }}>Discard draft</Button></div>}
      {!allowed && <div role="alert" className="rounded-[var(--radius-md)] border border-error-border bg-error-soft p-4 text-sm text-error">Your current demo role cannot create operational escalations.</div>}
      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5" noValidate>
        <Card className="p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-[var(--radius-md)] bg-brand-soft text-brand-strong"><UserRound size={19} /></span><div><h2 className="font-semibold text-primary">Reporter information</h2><p className="text-sm text-secondary">Populated from your signed-in profile</p></div></div>
          <dl className="grid gap-4 rounded-[var(--radius-md)] bg-subtle p-4 sm:grid-cols-2 lg:grid-cols-4">{[["Name", employee.displayName], ["Role", employee.roleLabel], ["Department", employee.department], ["Team or clinic", employee.assignment]].map(([term, value]) => <div key={term}><dt className="text-xs font-medium text-muted">{term}</dt><dd className="mt-1 text-sm font-semibold text-primary">{value}</dd></div>)}</dl>
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="font-semibold text-primary">Issue type</h2><p className="mt-1 text-sm text-secondary">Choose whether this is routine tracking or requires escalation ownership.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">{(["standard", "escalation"] as IssueType[]).map((type) => <button key={type} type="button" aria-pressed={form.issueType === type} onClick={() => setValue("issueType", type)} className={`rounded-[var(--radius-md)] border p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${form.issueType === type ? "border-brand bg-brand-soft" : "border-default bg-surface hover:bg-hover"}`}><span className="font-semibold text-primary">{type === "standard" ? "Standard Issue" : "Escalation"}</span><span className="mt-1 block text-sm text-secondary">{type === "standard" ? "Recorded for operational tracking with a 24-hour target." : "Requires routed ownership and an active response SLA."}</span></button>)}</div>
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="font-semibold text-primary">Reference information</h2>
          <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Reference type">{(["customer", "internal"] as ReferenceType[]).map((type) => <button key={type} type="button" role="radio" aria-checked={form.referenceType === type} onClick={() => setForm((current) => ({ ...current, referenceType: type, ...(type === "internal" ? { linkedTicketId: "", customerPhone: "" } : {}) }))} className={`min-h-10 rounded-full border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${form.referenceType === type ? "border-brand bg-brand-soft text-brand-strong" : "border-default text-secondary hover:bg-hover"}`}>{type === "customer" ? "Customer / Ticket Issue" : "Internal Issue"}</button>)}</div>
          {form.referenceType === "customer" ? <div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Linked Ticket ID" error={errors.linkedTicketId} required><input className={fieldClass} value={form.linkedTicketId} onChange={(event) => setValue("linkedTicketId", event.target.value.toUpperCase().replace(/\s+/g, ""))} placeholder="TKT-80421" aria-invalid={Boolean(errors.linkedTicketId)} /></Field><Field label="Customer phone number" error={errors.customerPhone} required hint="10-digit legacy Indian format. Masked in case views."><input className={fieldClass} inputMode="numeric" maxLength={10} value={form.customerPhone} onChange={(event) => setValue("customerPhone", event.target.value.replace(/\D/g, ""))} placeholder="9000000000" aria-invalid={Boolean(errors.customerPhone)} /></Field></div> : <p className="mt-4 flex items-start gap-2 rounded-[var(--radius-md)] bg-subtle p-3 text-sm text-secondary"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-brand" />No fictional customer information is required for internal operational issues.</p>}
          <div className="mt-4 max-w-md"><Field label="Appointment ID" hint="Optional"><input className={fieldClass} value={form.appointmentId} onChange={(event) => setValue("appointmentId", event.target.value)} placeholder="APT-2048" /></Field></div>
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="font-semibold text-primary">Tool or operational area <span className="text-error">*</span></h2><p className="mt-1 text-sm text-secondary">Your selection controls the issue fields, route, priority, and response target.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{Object.values(categoryDefinitions).map((option) => { const Icon = option.icon; return <button key={option.id} type="button" aria-pressed={form.category === option.id} onClick={() => selectCategory(option.id)} className={`min-h-28 rounded-[var(--radius-md)] border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${form.category === option.id ? "border-brand bg-brand-soft" : "border-default bg-surface hover:bg-hover"}`}><Icon size={20} className={form.category === option.id ? "text-brand-strong" : "text-muted"} /><span className="mt-3 block text-sm font-semibold text-primary">{option.name}</span><span className="mt-1 block text-xs leading-4 text-muted">{option.description}</span></button>; })}</div>
          {errors.category && <p role="alert" className="mt-2 text-sm text-error">{errors.category}</p>}

          {category && <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {form.category === "clinicops" && <Field label="Clinic" required error={errors.clinic}><select className={fieldClass} value={form.clinic} onChange={(event) => setValue("clinic", event.target.value)}><option value="">Select clinic</option>{clinics.map((clinic) => <option key={clinic}>{clinic}</option>)}</select></Field>}
            {category.parents && <Field label={category.parentLabel ?? "Area"} required error={errors.parent}><select className={fieldClass} value={parentValue} onChange={(event) => selectParent(event.target.value)}><option value="">Select {category.parentLabel?.toLowerCase()}</option>{Object.keys(category.parents).map((parent) => <option key={parent}>{parent}</option>)}</select></Field>}
            <Field label="Issue" required error={errors.issueSubtype}><select className={fieldClass} disabled={Boolean(category.parents && !parentValue)} value={form.issueSubtype} onChange={(event) => selectIssue(event.target.value)}><option value="">Select issue</option>{issueOptions.map((issue) => <option key={issue}>{issue}</option>)}{form.category === "clinicops" && <option>Other / Not Listed</option>}</select></Field>
            {form.issueSubtype === "Other / Not Listed" && <Field label="Custom issue description" required error={errors.customIssue}><input className={fieldClass} value={form.customIssue} onChange={(event) => setValue("customIssue", event.target.value)} /></Field>}
          </div>}
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="font-semibold text-primary">Issue details</h2>
          <div className="mt-4 space-y-4"><Field label="Issue title" required error={errors.title}><input className={fieldClass} value={form.title} onChange={(event) => { setTitleEdited(true); setValue("title", event.target.value); }} placeholder="Short, specific summary" /></Field><Field label="Description" required={form.issueType === "escalation"} error={errors.description} hint="Describe what happened, what was expected, and what assistance is required."><textarea className={`${fieldClass} min-h-32 resize-y py-3`} value={form.description} onChange={(event) => setValue("description", event.target.value)} /></Field></div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-[var(--radius-md)] bg-info-soft text-info"><Paperclip size={19} /></span><div><h2 className="font-semibold text-primary">Supporting attachments</h2><p className="text-sm text-secondary">Images, PDF, or text files up to {formatBytes(MAX_ATTACHMENT_BYTES)} each</p></div></div>
          <input ref={fileRef} type="file" multiple className="sr-only" accept={acceptedAttachmentTypes.join(",")} onChange={(event) => event.target.files && addFiles(event.target.files)} />
          <button type="button" onClick={() => fileRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event: DragEvent<HTMLButtonElement>) => { event.preventDefault(); addFiles(event.dataTransfer.files); }} className="mt-4 flex min-h-28 w-full flex-col items-center justify-center rounded-[var(--radius-md)] border border-dashed border-input-hover bg-subtle px-4 text-center hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"><UploadCloud size={22} className="text-brand" /><span className="mt-2 text-sm font-semibold text-primary">Choose files or drop them here</span><span className="mt-1 text-xs text-muted">Metadata is available only during this demo session; files are not uploaded.</span></button>
          {attachmentError && <p role="alert" className="mt-2 text-sm text-error">{attachmentError}</p>}
          {attachments.length > 0 && <ul className="mt-3 space-y-2">{attachments.map((file) => <li key={file.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-default p-3"><span className="flex min-w-0 items-center gap-3"><FileText size={18} className="shrink-0 text-muted" /><span className="min-w-0"><span className="block truncate text-sm font-semibold text-primary">{file.name}</span><span className="text-xs text-muted">{formatBytes(file.size)}</span></span></span><button type="button" onClick={() => setAttachments((current) => current.filter((item) => item.id !== file.id))} className="grid size-10 place-items-center rounded-lg text-muted hover:bg-hover hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" aria-label={`Remove ${file.name}`}><Trash2 size={17} /></button></li>)}</ul>}
        </Card>

        <Card className="overflow-hidden"><div className="border-b border-default p-5 sm:p-6"><h2 className="font-semibold text-primary">Routing and SLA preview</h2><p className="mt-1 text-sm text-secondary">Legacy defaults for this frontend demonstration.</p></div>{form.category && selectedPolicy && routingOwner ? <dl className="grid gap-px bg-default sm:grid-cols-3"><Preview term="Accountable owner" value={routingOwner.displayName} detail={`${categoryDefinitions[form.category].assignedTeam} · Tier 1`} /><Preview term="Priority" value={selectedPolicy.priority} detail={form.issueType === "standard" ? "Standard operational tracking" : "Based on selected category"} /><Preview term="Target response SLA" value={formatSlaTarget(selectedPolicy.minutes)} detail="Legacy default, not a resolution SLA" /></dl> : <p className="p-6 text-sm text-muted">Choose a tool or operational area to preview routing and SLA.</p>}</Card>

        {errors.submit && <p role="alert" className="rounded-[var(--radius-md)] border border-error-border bg-error-soft p-4 text-sm text-error">{errors.submit}</p>}
        {success && <p role="status" className="flex items-center gap-2 rounded-[var(--radius-md)] bg-success-soft p-4 text-sm font-semibold text-success"><CheckCircle2 size={18} />{success}</p>}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button variant="secondary" onClick={() => navigate("/escalations")}>Cancel</Button><Button type="submit" disabled={!allowed || pending} icon={pending ? <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" /> : <CheckCircle2 size={17} />}>{pending ? "Creating…" : `Create ${form.issueType === "standard" ? "Issue" : "Escalation"}`}</Button></div>
      </form>
      <p className="flex items-start gap-2 text-xs text-muted"><Info size={14} className="mt-0.5 shrink-0" />Frontend permissions and routing are demonstration behavior only. A future backend must independently enforce authorization and audit integrity.</p>
    </div>
  );
}

function Field({ label, required, error, hint, children }: { label: string; required?: boolean | undefined; error?: string | undefined; hint?: string | undefined; children: React.ReactNode }) {
  return <label className="block"><span className={labelClass}>{label}{required && <span className="text-error"> *</span>}</span>{children}{hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}{error && <span role="alert" className="mt-1 block text-sm text-error">{error}</span>}</label>;
}

function Preview({ term, value, detail }: { term: string; value: string; detail: string }) {
  return <div className="bg-surface p-5"><dt className="text-xs font-semibold uppercase tracking-wide text-muted">{term}</dt><dd className="mt-2 text-lg font-semibold text-primary">{value}</dd><p className="mt-1 text-xs text-secondary">{detail}</p></div>;
}
