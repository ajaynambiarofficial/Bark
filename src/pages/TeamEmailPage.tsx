import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router";
import { Check, Clock3, Mail, Plus, Save, Search, Send, Users } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { canSendTeamEmail } from "../auth/teamEmailAccess";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

interface Recipient { id: string; displayName: string; email: string; department: string; roleKey: string; roleName: string }
interface TeamEmail { id: string; subject: string; body: string; recipientUserIds: string[]; status: "draft" | "sending" | "sent" | "failed"; createdAt: string; updatedAt: string; sentAt: string | null }
interface TeamEmailData { recipients: Recipient[]; emailConfigured: boolean; replyToEmail: string | null; maxRecipients: number }

const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api";
const fieldClass = "mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, { ...init, credentials: "include", headers: { "content-type": "application/json", ...init?.headers } });
  const payload = await response.json().catch(() => null) as { data?: T; error?: { message?: string } } | null;
  if (!response.ok) throw new Error(payload?.error?.message ?? "The request could not be completed.");
  return payload?.data as T;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function TeamEmailPage() {
  const { employee } = useAuth();
  const [data, setData] = useState<TeamEmailData | null>(null);
  const [messages, setMessages] = useState<TeamEmail[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const canSend = canSendTeamEmail(employee?.role);
  const activeMessage = messages.find((message) => message.id === activeId);
  const readOnly = Boolean(activeMessage && activeMessage.status !== "draft");
  const visibleRecipients = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.recipients ?? []).filter((recipient) => !term || `${recipient.displayName} ${recipient.email} ${recipient.department} ${recipient.roleName}`.toLowerCase().includes(term));
  }, [data?.recipients, search]);
  const selectedRecipients = useMemo(() => (data?.recipients ?? []).filter((recipient) => recipientIds.includes(recipient.id)), [data?.recipients, recipientIds]);

  const load = async () => {
    setLoading(true); setError("");
    try {
      const [recipientsData, rows] = await Promise.all([api<TeamEmailData>("/team-emails/recipients"), api<TeamEmail[]>("/team-emails")]);
      setData(recipientsData); setMessages(rows);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load team email."); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (canSend) void load(); }, [canSend]);

  const openMessage = (message: TeamEmail) => {
    setActiveId(message.id); setSubject(message.subject); setBody(message.body); setRecipientIds(message.recipientUserIds); setError(""); setSuccess("");
  };

  const newDraft = () => {
    setActiveId(null); setSubject(""); setBody(""); setRecipientIds([]); setError(""); setSuccess("");
  };

  const toggleRecipient = (id: string) => setRecipientIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const applyGroup = (recipients: Recipient[]) => {
    const ids = recipients.map((recipient) => recipient.id);
    const allSelected = ids.length > 0 && ids.every((id) => recipientIds.includes(id));
    setRecipientIds((current) => allSelected ? current.filter((id) => !ids.includes(id)) : [...new Set([...current, ...ids])]);
  };

  const saveDraft = async () => {
    setPending(true); setError(""); setSuccess("");
    try {
      const payload = { subject, body, recipientUserIds: recipientIds };
      const saved = await api<TeamEmail>(activeId ? `/team-emails/${activeId}` : "/team-emails", { method: activeId ? "PUT" : "POST", body: JSON.stringify(payload) });
      setActiveId(saved.id); setMessages((current) => [saved, ...current.filter((message) => message.id !== saved.id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      setSuccess("Draft saved.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save this draft."); }
    finally { setPending(false); }
  };

  const sendMessage = async () => {
    if (!data?.emailConfigured) { setError("Email delivery is not configured. Your draft can still be saved."); return; }
    if (!subject.trim() || !body.trim() || !recipientIds.length) { setError("Add a subject, message, and at least one recipient before sending."); return; }
    if (recipientIds.length > (data?.maxRecipients ?? 200)) { setError(`Choose no more than ${data?.maxRecipients ?? 200} recipients.`); return; }
    const confirmed = window.confirm(`Send this email to ${recipientIds.length} team member${recipientIds.length === 1 ? "" : "s"}? Their addresses will be hidden from each other.`);
    if (!confirmed) return;
    setPending(true); setError(""); setSuccess("");
    try {
      const payload = { subject, body, recipientUserIds: recipientIds };
      const saved = await api<TeamEmail>(activeId ? `/team-emails/${activeId}` : "/team-emails", { method: activeId ? "PUT" : "POST", body: JSON.stringify(payload) });
      setActiveId(saved.id);
      const sent = await api<TeamEmail>(`/team-emails/${saved.id}/send`, { method: "POST", body: "{}" });
      setMessages((current) => [sent, ...current.filter((message) => message.id !== sent.id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      setSuccess(`Email sent to ${recipientIds.length} team member${recipientIds.length === 1 ? "" : "s"}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send this email.");
      try { setMessages(await api<TeamEmail[]>("/team-emails")); } catch { /* Keep the send error visible if history is temporarily unavailable. */ }
    }
    finally { setPending(false); }
  };

  if (!canSend) return <Navigate to="/welcome" replace />;

  const salesRecipients = (data?.recipients ?? []).filter((recipient) => recipient.roleKey.startsWith("sales-"));
  const allRecipients = data?.recipients ?? [];
  const selectedNames = selectedRecipients.map((recipient) => recipient.displayName).join(", ");

  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-brand">Team communications</p><h1 className="mt-1 text-2xl font-semibold text-primary">Team Email</h1><p className="mt-1 max-w-2xl text-sm text-secondary">Draft an update and send it to selected employees or the sales team.</p></div><Button variant="secondary" onClick={newDraft} icon={<Plus size={16} />}>New draft</Button></div>
    {error && <p role="alert" className="rounded-lg border border-error-border bg-error-soft p-3 text-sm text-error">{error}</p>}
    {success && <p role="status" className="rounded-lg border border-success/30 bg-success-soft p-3 text-sm text-success">{success}</p>}
    {!data?.emailConfigured && <p role="status" className="rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm text-primary">The shared mail account is not configured on this server. In Render, set SMTP_USER and EMAIL_FROM to the Bark Gmail address and SMTP_PASSWORD to its Google App Password, then restart the service. You can save drafts while sending is disabled.</p>}
    {loading ? <Card className="p-6 text-sm text-secondary">Loading team email…</Card> : <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-primary">{readOnly ? "Sent email" : "Compose message"}</h2><p className="mt-1 text-sm text-secondary">From Bark’s shared mailbox, with replies directed to your work email.</p></div>{activeMessage && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${activeMessage.status === "sent" ? "bg-success-soft text-success" : activeMessage.status === "failed" ? "bg-error-soft text-error" : "bg-subtle text-secondary"}`}>{activeMessage.status}</span>}</div>
        <div className="rounded-lg border border-default bg-subtle/50 p-3 text-sm"><span className="font-medium text-primary">From:</span> {employee?.displayName} via Bark <span className="text-secondary">· Reply-to {data?.replyToEmail ?? "Bark shared mailbox (once configured)"}</span></div>
        <label className="block text-sm font-medium text-primary">Subject<input value={subject} onChange={(event) => setSubject(event.target.value)} minLength={3} maxLength={200} required disabled={readOnly} className={fieldClass} placeholder="A clear subject for the team" /></label>
        <section className="space-y-3" aria-labelledby="team-email-recipients"><div className="flex flex-wrap items-center justify-between gap-2"><h3 id="team-email-recipients" className="text-sm font-semibold text-primary">Recipients <span className="font-normal text-secondary">({recipientIds.length} selected)</span></h3><span className="text-xs text-secondary">Up to {data?.maxRecipients ?? 200} per email</span></div>
          <div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" disabled={readOnly} onClick={() => applyGroup(allRecipients)} icon={<Users size={15} />}>All active employees</Button><Button type="button" variant="secondary" disabled={readOnly} onClick={() => applyGroup(salesRecipients)}>Sales team</Button><Button type="button" variant="ghost" disabled={readOnly || !recipientIds.length} onClick={() => setRecipientIds([])}>Clear</Button></div>
          <label className="relative block"><Search size={16} className="absolute left-3 top-3 text-muted" /><input value={search} onChange={(event) => setSearch(event.target.value)} className={`${fieldClass} pl-9`} placeholder="Find an employee" aria-label="Search recipients" /></label>
          <div className="max-h-56 overflow-auto rounded-lg border border-default">{visibleRecipients.map((recipient) => <label key={recipient.id} className="flex cursor-pointer items-start gap-3 border-b border-default px-3 py-2.5 last:border-b-0 hover:bg-hover"><input type="checkbox" className="mt-1" checked={recipientIds.includes(recipient.id)} onChange={() => toggleRecipient(recipient.id)} disabled={readOnly} /><span className="min-w-0"><span className="block truncate text-sm font-medium text-primary">{recipient.displayName}</span><span className="block truncate text-xs text-secondary">{recipient.roleName} · {recipient.email}</span></span></label>)}{visibleRecipients.length === 0 && <p className="p-4 text-sm text-secondary">No matching employees.</p>}</div>
          <p className="text-xs text-secondary">Recipients are added as BCC and cannot see each other’s email addresses.</p>
        </section>
        <label className="block text-sm font-medium text-primary">Message<textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={20_000} rows={9} required disabled={readOnly} className="mt-1.5 min-h-48 w-full resize-y rounded-lg border border-input bg-input px-3 py-2.5 text-sm text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" placeholder="Write your update…" /></label>
        <div className="rounded-xl border border-default bg-subtle/40 p-4"><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted"><Mail size={14} />Preview</div><p className="text-sm font-semibold text-primary">{subject || "Your subject will appear here"}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-secondary">{body || "Your message preview will appear here."}</p><p className="mt-3 text-xs text-muted">To {recipientIds.length} employee{recipientIds.length === 1 ? "" : "s"}{selectedNames ? `: ${selectedNames}` : ""}</p></div>
        {!readOnly && <div className="flex flex-wrap justify-end gap-2"><Button variant="secondary" disabled={pending} onClick={() => void saveDraft()} icon={<Save size={15} />}>{pending ? "Saving…" : "Save draft"}</Button><Button disabled={pending || !data?.emailConfigured || subject.trim().length < 3 || body.trim().length < 3 || !recipientIds.length} onClick={() => void sendMessage()} icon={<Send size={15} />}>{pending ? "Sending…" : "Send email"}</Button></div>}
        {readOnly && activeMessage?.sentAt && <p className="text-right text-xs text-secondary">Sent {formatDate(activeMessage.sentAt)}</p>}
      </Card>
      <Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-default p-4"><div><h2 className="font-semibold text-primary">Your messages</h2><p className="mt-1 text-xs text-secondary">Drafts and sent history</p></div><Clock3 size={18} className="text-muted" /></div>{messages.length === 0 ? <p className="p-4 text-sm text-secondary">No messages yet.</p> : <ul className="max-h-[640px] divide-y divide-default overflow-auto">{messages.map((message) => <li key={message.id}><button type="button" onClick={() => openMessage(message)} className={`w-full p-4 text-left hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${activeId === message.id ? "bg-brand-soft" : ""}`}><span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold text-primary">{message.subject || "Untitled draft"}</span>{message.status === "sent" ? <Check size={15} className="shrink-0 text-success" /> : <span className="shrink-0 text-[10px] font-semibold uppercase text-muted">{message.status}</span>}</span><span className="mt-1 block text-xs text-secondary">{message.recipientUserIds.length} recipient{message.recipientUserIds.length === 1 ? "" : "s"} · {formatDate(message.updatedAt)}</span></button></li>)}</ul>}</Card>
    </div>}
  </div>;
}
