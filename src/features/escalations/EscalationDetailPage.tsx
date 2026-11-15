import { ArrowLeft, ArrowRightLeft, Bell, CheckCircle2, Clock3, FileText, MessageSquare, RotateCcw, ShieldAlert, TrendingUp, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { useAuth } from "../../auth/AuthContext";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { categoryDefinitions, statusTransitions } from "./escalation.config";
import { escalationService } from "./escalation.service";
import { canComment, canIncreaseTier, canTransfer, canTransitionStatus } from "./escalation.permissions";
import type { CommentVisibility, Escalation, EscalationActivity, EscalationStatus } from "./escalation.types";
import { maskCustomerPhone } from "./escalation.types";
import { Modal, PriorityBadge, SlaIndicator, StatusBadge, TierBadge, fieldClass, labelClass } from "./EscalationUi";

type DialogState = "comment" | "transfer" | "tier" | "resolve" | "reopen" | null;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

const activityLabels: Record<EscalationActivity["type"], string> = {
  created: "Escalation created", "owner-assigned": "Owner assigned", "owner-transferred": "Ownership transferred",
  "status-changed": "Status changed", "tier-increased": "Tier increased", "comment-added": "Comment added",
  "resolution-submitted": "Resolution submitted", reopened: "Case reopened", "notification-created": "Mock notification recorded",
};

export function EscalationDetailPage() {
  const { escalationId = "" } = useParams();
  const { employee } = useAuth();
  const [item, setItem] = useState<Escalation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [visibility, setVisibility] = useState<CommentVisibility>("internal");
  const [ownerId, setOwnerId] = useState("");

  useEffect(() => {
    if (!employee) return;
    let active = true;
    setLoading(true);
    void escalationService.getEscalationById(escalationId, employee).then((result) => { if (active) setItem(result); }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Could not load this escalation."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [employee, escalationId]);

  const [owners, setOwners] = useState<import("../../types/auth").Employee[]>([]);
  useEffect(() => { let active = true; void Promise.resolve(escalationService.getEligibleOwners()).then((rows) => { if (active) setOwners(rows); }).catch(() => undefined); return () => { active = false; }; }, []);
  if (!employee) return null;
  if (loading) return <div className="space-y-4" aria-label="Loading escalation"><div className="h-24 animate-pulse rounded-[var(--radius-lg)] bg-subtle motion-reduce:animate-none" /><div className="h-80 animate-pulse rounded-[var(--radius-lg)] bg-subtle motion-reduce:animate-none" /></div>;
  if (error || !item) return <Card className="mx-auto max-w-2xl p-8 text-center"><ShieldAlert size={32} className="mx-auto text-error" /><h1 className="mt-4 text-xl font-semibold text-primary">Escalation unavailable</h1><p className="mt-2 text-sm text-secondary">{error ?? "This escalation could not be found."}</p><Link to="/escalations" className="mt-5 inline-flex min-h-10 items-center justify-center rounded-[var(--radius-control)] border border-default bg-elevated px-4 text-sm font-semibold text-primary hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">Return to Escalations</Link></Card>;

  const refresh = (updated: Escalation) => { setItem(updated); setActionError(null); setDialog(null); setReason(""); setComment(""); setOwnerId(""); };
  const runStatus = async (target: EscalationStatus, note?: string) => {
    setPending(true); setActionError(null);
    try { refresh(await escalationService.updateEscalationStatus(item.id, target, employee, note)); }
    catch (caught) { setActionError(caught instanceof Error ? caught.message : "The status could not be updated."); }
    finally { setPending(false); }
  };
  const submitDialog = async () => {
    setPending(true); setActionError(null);
    try {
      if (dialog === "comment") refresh(await escalationService.addEscalationComment(item.id, comment, visibility, employee));
      if (dialog === "transfer") refresh(await escalationService.transferEscalationOwnership(item.id, ownerId, reason, employee));
      if (dialog === "tier" && item.tier < 3) refresh(await escalationService.escalateTier(item.id, (item.tier + 1) as 2 | 3, reason, employee));
      if (dialog === "resolve") await runStatus("Resolved", reason);
      if (dialog === "reopen") await runStatus("Reopened", reason);
    } catch (caught) { setActionError(caught instanceof Error ? caught.message : "The action could not be completed."); }
    finally { setPending(false); }
  };

  const nextStatuses = statusTransitions[item.status];
  return (
    <div className="space-y-6">
      <Link to="/escalations" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"><ArrowLeft size={17} />Back to Escalations</Link>
      <header className="flex flex-col gap-5 rounded-[var(--radius-lg)] border border-default bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0"><p className="text-xs font-semibold tracking-wide text-brand uppercase">{item.reference ?? item.id}</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-primary sm:text-3xl">{item.title}</h1><div className="mt-4 flex flex-wrap gap-2"><StatusBadge status={item.status} /><PriorityBadge priority={item.priority} /><TierBadge tier={item.tier} /><span className="inline-flex items-center rounded-full border border-default px-2.5 py-1"><SlaIndicator item={item} /></span></div></div>
        <div className="flex max-w-xl flex-wrap gap-2">
          {canComment(employee, item) && <Button variant="secondary" icon={<MessageSquare size={16} />} onClick={() => setDialog("comment")}>Add Comment</Button>}
          {canTransfer(employee, item) && <Button variant="secondary" icon={<ArrowRightLeft size={16} />} onClick={() => setDialog("transfer")}>Transfer Ownership</Button>}
          {item.tier < 3 && canIncreaseTier(employee, item, (item.tier + 1) as 2 | 3) && <Button variant="secondary" icon={<TrendingUp size={16} />} onClick={() => setDialog("tier")}>Escalate Tier</Button>}
          {nextStatuses.includes("In Progress") && canTransitionStatus(employee, item, "In Progress") && <Button onClick={() => void runStatus("In Progress")} disabled={pending}>{item.status === "Awaiting Response" ? "Resume Work" : "Start Working"}</Button>}
          {nextStatuses.includes("Awaiting Response") && canTransitionStatus(employee, item, "Awaiting Response") && <Button variant="secondary" icon={<Clock3 size={16} />} onClick={() => void runStatus("Awaiting Response")} disabled={pending}>Mark Awaiting Response</Button>}
          {nextStatuses.includes("Resolved") && canTransitionStatus(employee, item, "Resolved") && <Button icon={<CheckCircle2 size={16} />} onClick={() => setDialog("resolve")}>Resolve</Button>}
          {nextStatuses.includes("Closed") && canTransitionStatus(employee, item, "Closed") && <Button onClick={() => void runStatus("Closed")} disabled={pending}>Close</Button>}
          {nextStatuses.includes("Reopened") && canTransitionStatus(employee, item, "Reopened") && <Button variant="secondary" icon={<RotateCcw size={16} />} onClick={() => setDialog("reopen")}>Reopen</Button>}
        </div>
      </header>
      {actionError && <p role="alert" className="rounded-[var(--radius-md)] border border-error-border bg-error-soft p-4 text-sm text-error">{actionError}</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
        <div className="space-y-6">
          <Card className="p-5 sm:p-6"><h2 className="font-semibold text-primary">Issue information</h2><dl className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            <Info term="Reporter" value={item.reporter.displayName} detail={item.reporter.roleLabel} /><Info term="Originating department" value={item.originatingDepartment} /><Info term="Assigned clinic" value={item.clinic ?? "Not applicable"} /><Info term="Responsible department" value={item.responsibleDepartment} /><Info term="Assigned team" value={item.assignedTeam} /><Info term="Accountable owner" value={item.accountableOwner.displayName} detail={item.accountableOwner.roleLabel} /><Info term="Linked ticket ID" value={item.linkedTicketId ?? "Internal issue"} /><Info term="Appointment ID" value={item.appointmentId ?? "Not provided"} /><Info term="Customer phone" value={maskCustomerPhone(item.customerPhone) ?? "Not applicable"} /><Info term="Category" value={categoryDefinitions[item.category].name} /><Info term="Channel / Service" value={item.channel ?? item.service ?? item.module ?? "Direct issue"} /><Info term="Issue subtype" value={item.customIssue || item.issueSubtype} /><Info term="Created" value={formatDate(item.createdAt)} /><Info term="Last updated" value={formatDate(item.updatedAt)} /></dl></Card>
          <Card className="p-5 sm:p-6"><h2 className="font-semibold text-primary">Description</h2><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-secondary">{item.description || "No additional description was supplied."}</p></Card>
          <Card className="p-5 sm:p-6"><h2 className="font-semibold text-primary">Attachments</h2>{item.attachments.length ? <ul className="mt-4 space-y-2">{item.attachments.map((attachment) => <li key={attachment.id} className="flex items-center gap-3 rounded-[var(--radius-md)] border border-default p-3"><FileText size={18} className="text-muted" /><div><p className="text-sm font-semibold text-primary">{attachment.name}</p><p className="text-xs text-muted">{Math.ceil(attachment.size / 1024)} KB · metadata only, file not stored</p></div></li>)}</ul> : <p className="mt-3 text-sm text-muted">No attachment metadata is recorded.</p>}</Card>
          <Card className="p-5 sm:p-6"><h2 className="font-semibold text-primary">Comments</h2>{item.comments.length ? <ul className="mt-4 space-y-4">{item.comments.map((entry) => <li key={entry.id} className="flex gap-3"><Avatar name={entry.author.displayName} size="sm" /><div className="min-w-0 flex-1 rounded-[var(--radius-md)] bg-subtle p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-primary">{entry.author.displayName}</p><span className="text-xs text-muted">{entry.visibility === "internal" ? "Internal" : "Shared with involved teams"} · {formatDate(entry.createdAt)}</span></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-secondary">{entry.body}</p></div></li>)}</ul> : <p className="mt-3 text-sm text-muted">No comments yet.</p>}</Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5"><h2 className="font-semibold text-primary">Ownership</h2><div className="mt-4 flex items-center gap-3"><Avatar name={item.accountableOwner.displayName} /><div><p className="font-semibold text-primary">{item.accountableOwner.displayName}</p><p className="text-sm text-secondary">{item.accountableOwner.roleLabel}</p></div></div>{item.requiresAssignment && <p className="mt-4 rounded-[var(--radius-md)] bg-warning-soft p-3 text-sm text-warning">Assigned to the intake custodian and requires review.</p>}<p className="mt-4 text-xs leading-5 text-muted">The owner remains singular. Earlier owners stay visible in the audit history.</p></Card>
          <Card className="p-5"><div className="flex items-center justify-between gap-3"><h2 className="font-semibold text-primary">Activity timeline</h2><span className="text-xs text-muted">{item.activity.length} events</span></div><ol className="mt-5 space-y-0">{item.activity.map((event, index) => <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">{index < item.activity.length - 1 && <span className="absolute left-[15px] top-8 h-[calc(100%-1.25rem)] w-px bg-default" />}<span className={`relative z-10 grid size-8 shrink-0 place-items-center rounded-full ${event.type === "notification-created" ? "bg-info-soft text-info" : "bg-brand-soft text-brand-strong"}`}>{event.type === "notification-created" ? <Bell size={14} /> : <UserRound size={14} />}</span><div className="min-w-0 pt-0.5"><p className="text-sm font-semibold text-primary">{activityLabels[event.type]}</p><p className="mt-0.5 text-xs text-muted">{event.actorName} · {formatDate(event.timestamp)}</p>{(event.previousValue || event.newValue) && <p className="mt-1 text-xs text-secondary">{event.previousValue && <>{event.previousValue} → </>}{event.newValue}</p>}{event.reason && <p className="mt-1 text-xs leading-5 text-secondary">{event.reason}</p>}</div></li>)}</ol></Card>
        </div>
      </div>

      <Modal open={dialog === "comment"} title="Add comment" description="Comments become part of the mock activity history." onClose={() => setDialog(null)} footer={<><Button variant="secondary" onClick={() => setDialog(null)}>Cancel</Button><Button onClick={() => void submitDialog()} disabled={pending || !comment.trim()}>{pending ? "Posting…" : "Post Comment"}</Button></>}><label><span className={labelClass}>Visibility</span><select className={fieldClass} value={visibility} onChange={(event) => setVisibility(event.target.value as CommentVisibility)}><option value="internal">Internal</option><option value="shared">Shared with involved operational teams</option></select></label><label className="mt-4 block"><span className={labelClass}>Comment</span><textarea className={`${fieldClass} min-h-28 py-3`} value={comment} onChange={(event) => setComment(event.target.value)} /></label></Modal>
      <Modal open={dialog === "transfer"} title="Transfer ownership" description="The previous owner remains in the history and as a collaborator." onClose={() => setDialog(null)} footer={<><Button variant="secondary" onClick={() => setDialog(null)}>Cancel</Button><Button onClick={() => void submitDialog()} disabled={pending || !ownerId || !reason.trim()}>{pending ? "Transferring…" : "Confirm Transfer"}</Button></>}><label><span className={labelClass}>New accountable owner</span><select className={fieldClass} value={ownerId} onChange={(event) => setOwnerId(event.target.value)}><option value="">Select eligible owner</option>{owners.filter((owner) => owner.id !== item.accountableOwner.id).map((owner) => <option key={owner.id} value={owner.id}>{owner.displayName} — {owner.roleLabel}</option>)}</select></label><ReasonField value={reason} onChange={setReason} label="Transfer reason" /></Modal>
      <Modal open={dialog === "tier"} title={`Escalate to Tier ${item.tier + 1}`} description="Increasing the tier adds oversight without removing the current owner." onClose={() => setDialog(null)} footer={<><Button variant="secondary" onClick={() => setDialog(null)}>Cancel</Button><Button onClick={() => void submitDialog()} disabled={pending || !reason.trim()}>{pending ? "Escalating…" : "Confirm Tier Increase"}</Button></>}><ReasonField value={reason} onChange={setReason} label="Escalation reason" /></Modal>
      <Modal open={dialog === "resolve"} title="Resolve escalation" description="A resolution note is required and will be added to the audit history." onClose={() => setDialog(null)} footer={<><Button variant="secondary" onClick={() => setDialog(null)}>Cancel</Button><Button onClick={() => void submitDialog()} disabled={pending || !reason.trim()}>{pending ? "Resolving…" : "Resolve"}</Button></>}><ReasonField value={reason} onChange={setReason} label="Resolution note" /></Modal>
      <Modal open={dialog === "reopen"} title="Reopen escalation" description="Explain why additional work is required." onClose={() => setDialog(null)} footer={<><Button variant="secondary" onClick={() => setDialog(null)}>Cancel</Button><Button onClick={() => void submitDialog()} disabled={pending || !reason.trim()}>{pending ? "Reopening…" : "Reopen"}</Button></>}><ReasonField value={reason} onChange={setReason} label="Reopening reason" /></Modal>
    </div>
  );
}

function Info({ term, value, detail }: { term: string; value: string; detail?: string | undefined }) {
  return <div><dt className="text-xs font-medium text-muted">{term}</dt><dd className="mt-1 text-sm font-semibold text-primary">{value}</dd>{detail && <p className="mt-0.5 text-xs text-secondary">{detail}</p>}</div>;
}

function ReasonField({ value, onChange, label }: { value: string; onChange(value: string): void; label: string }) {
  return <label className="block"><span className={labelClass}>{label} <span className="text-error">*</span></span><textarea className={`${fieldClass} min-h-28 py-3`} value={value} onChange={(event) => onChange(event.target.value)} placeholder="Provide a clear operational reason" /></label>;
}
