import { ArrowLeft, Bug, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../../auth/AuthContext";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { canCreateEscalation } from "./escalation.permissions";
import { escalationService } from "./escalation.service";
import type { EscalationCategory } from "./escalation.types";
import { fieldClass, labelClass } from "./EscalationUi";

export function ReportBugPage() {
  const { employee } = useAuth(); const navigate = useNavigate();
  const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [category, setCategory] = useState<EscalationCategory>("pawcare");
  const [pending, setPending] = useState(false); const [error, setError] = useState("");
  if (!employee) return null;
  const submit = async (event: FormEvent) => { event.preventDefault(); setPending(true); setError(""); try { const created = await escalationService.createEscalation({ issueType: "standard", referenceType: "internal", title: title.trim(), description: description.trim(), category, issueSubtype: "Bug Report", attachments: [] }, employee); navigate(`/escalations/${created.id}`); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not submit the bug report."); } finally { setPending(false); } };
  return <div className="mx-auto max-w-2xl space-y-5"><div><Link to="/escalations" className="inline-flex items-center gap-2 text-sm font-semibold text-secondary"><ArrowLeft size={16}/>Back to Team</Link><h1 className="mt-3 text-2xl font-semibold text-primary">Report a Bug</h1><p className="mt-1 text-sm text-secondary">Report a software or workflow issue for the team to review.</p></div><Card className="p-5 sm:p-6"><form onSubmit={(event) => void submit(event)} className="space-y-4"><div className="flex items-center gap-3 rounded-lg bg-error-soft p-3 text-sm text-error"><Bug size={18}/>Include what happened and what you expected to happen.</div><label className="block"><span className={labelClass}>Bug title</span><input required minLength={3} maxLength={220} value={title} onChange={(event) => setTitle(event.target.value)} className={fieldClass} placeholder="Short summary of the bug" /></label><label className="block"><span className={labelClass}>Team or product area</span><select value={category} onChange={(event) => setCategory(event.target.value as EscalationCategory)} className={fieldClass}><option value="pawcare">Pawcare</option><option value="nugget">Nugget</option><option value="ameyo">Ameyo</option><option value="ticket">Ticketing</option><option value="clinicops">Clinic operations</option></select></label><label className="block"><span className={labelClass}>What went wrong?</span><textarea required minLength={10} maxLength={10000} value={description} onChange={(event) => setDescription(event.target.value)} className={`${fieldClass} min-h-32 resize-y py-3`} placeholder="Steps to reproduce, what you saw, and what you expected." /></label>{error && <p role="alert" className="text-sm text-error">{error}</p>}<div className="flex justify-end"><Button type="submit" disabled={pending || !canCreateEscalation(employee)} icon={<Send size={15}/>}>{pending ? "Submitting…" : "Submit bug report"}</Button></div></form></Card></div>;
}
