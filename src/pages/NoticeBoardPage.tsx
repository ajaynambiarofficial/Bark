import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, CalendarClock, Check, ChevronDown, ChevronUp, CircleAlert, Clock3, Megaphone, MessageCircle, Plus, Send } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { dataSources } from "../config/data-sources";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";

type NoticeType = "general" | "important" | "reminder";
type Cadence = "once" | "daily" | "weekly";
interface Notice {
  id: string;
  title: string;
  body: string;
  type: NoticeType;
  cadence: Cadence;
  expiresAt: string;
  createdAt: string;
  createdBy: string;
  author: { id: string; displayName: string };
  acknowledgedByMe: boolean;
  acknowledgementCount: number;
  commentCount: number;
}
interface NoticeComment {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; displayName: string };
}
interface ApiResult<T> { data: T; error?: { message?: string } }

const apiBase = dataSources.internalApi.baseUrl;
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, { ...init, credentials: "include", headers: { "content-type": "application/json", ...init?.headers } });
  const result = await response.json().catch(() => null) as ApiResult<T> | null;
  if (!response.ok) throw new Error(result?.error?.message ?? "The notice board request failed.");
  return result?.data as T;
}

const typeStyles: Record<NoticeType, { label: string; badge: string; border: string; icon: string }> = {
  important: { label: "Important", badge: "bg-red-100 text-red-800", border: "border-l-red-500", icon: "text-red-600" },
  reminder: { label: "Reminder", badge: "bg-amber-100 text-amber-800", border: "border-l-amber-500", icon: "text-amber-700" },
  general: { label: "Update", badge: "bg-sky-100 text-sky-800", border: "border-l-sky-500", icon: "text-sky-700" },
};
const cadenceLabels: Record<Cadence, string> = { once: "One-time", daily: "Daily update", weekly: "Weekly update" };

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
function defaultExpiry() {
  return localDateTime(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
}
function localDateTime(date: Date) {
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export function NoticeBoardPage() {
  const { employee } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [canPublish, setCanPublish] = useState(false);
  const [comments, setComments] = useState<Record<string, NoticeComment[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [showComposer, setShowComposer] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<NoticeType>("general");
  const [cadence, setCadence] = useState<Cadence>("once");
  const [expiresAt, setExpiresAt] = useState(defaultExpiry);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [composerError, setComposerError] = useState("");

  const loadNotices = useCallback(async () => {
    setError("");
    try { const result = await api<{ notices: Notice[]; canPublish: boolean }>("/notices"); setNotices(result.notices); setCanPublish(result.canPublish); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load notices."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadNotices(); }, [loadNotices]);

  const orderedNotices = useMemo(() => [...notices].sort((a, b) => Number(b.type === "important") - Number(a.type === "important") || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [notices]);

  async function createNotice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setComposerError("");
    try {
      const notice = await api<Notice>("/notices", { method: "POST", body: JSON.stringify({ title, body, type, cadence, expiresAt: new Date(expiresAt).toISOString() }) });
      setNotices((current) => [notice, ...current]); setTitle(""); setBody(""); setType("general"); setCadence("once"); setExpiresAt(defaultExpiry()); setShowComposer(false);
    } catch (cause) { setComposerError(cause instanceof Error ? cause.message : "Could not publish the notice."); }
  }

  async function acknowledge(notice: Notice) {
    setBusyId(notice.id);
    try {
      const result = await api<{ acknowledged: boolean; acknowledgementCount: number }>(`/notices/${notice.id}/acknowledge`, { method: "POST", body: "{}" });
      setNotices((current) => current.map((item) => item.id === notice.id ? { ...item, acknowledgedByMe: true, acknowledgementCount: result.acknowledgementCount } : item));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not acknowledge this notice."); }
    finally { setBusyId(null); }
  }

  async function toggleComments(notice: Notice) {
    const opening = !expanded[notice.id];
    setExpanded((current) => ({ ...current, [notice.id]: opening }));
    if (opening && !comments[notice.id]) {
      try { const loaded = await api<NoticeComment[]>(`/notices/${notice.id}/comments`); setComments((current) => ({ ...current, [notice.id]: loaded })); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load comments."); }
    }
  }

  async function addComment(notice: Notice) {
    const text = (commentDrafts[notice.id] ?? "").trim();
    if (!text) return;
    setBusyId(notice.id);
    try {
      const comment = await api<NoticeComment>(`/notices/${notice.id}/comments`, { method: "POST", body: JSON.stringify({ body: text }) });
      setComments((current) => ({ ...current, [notice.id]: [...(current[notice.id] ?? []), comment] }));
      setNotices((current) => current.map((item) => item.id === notice.id ? { ...item, commentCount: item.commentCount + 1 } : item));
      setCommentDrafts((current) => ({ ...current, [notice.id]: "" }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not add the comment."); }
    finally { setBusyId(null); }
  }

  async function archive(notice: Notice) {
    if (!window.confirm(`Archive “${notice.title}”?`)) return;
    setBusyId(notice.id);
    try { await api(`/notices/${notice.id}/archive`, { method: "POST", body: "{}" }); setNotices((current) => current.filter((item) => item.id !== notice.id)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not archive this notice."); }
    finally { setBusyId(null); }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Team" title="Notice Board" description="Company-wide notices, updates, and team acknowledgements." />
      {canPublish && <div className="flex justify-end"><Button onClick={() => { setShowComposer((value) => !value); setComposerError(""); }} icon={<Plus size={17} />}>{showComposer ? "Close" : "New notice"}</Button></div>}
      {showComposer && canPublish && <Card className="p-5 sm:p-6">
        <form className="space-y-4" onSubmit={createNotice}>
          <div><h2 className="text-lg font-semibold text-primary">Create a notice</h2><p className="mt-1 text-sm text-secondary">Notices are visible to the whole team until they expire or are archived.</p></div>
          <label className="block text-sm font-medium text-primary">Title<input required minLength={3} maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1.5 min-h-10 w-full rounded-lg border border-default bg-app px-3 text-sm" placeholder="What does the team need to know?" /></label>
          <label className="block text-sm font-medium text-primary">Message<textarea required maxLength={10000} rows={4} value={body} onChange={(event) => setBody(event.target.value)} className="mt-1.5 w-full rounded-lg border border-default bg-app px-3 py-2 text-sm" placeholder="Add the details agents need." /></label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-sm font-medium text-primary">Type<select value={type} onChange={(event) => setType(event.target.value as NoticeType)} className="mt-1.5 min-h-10 w-full rounded-lg border border-default bg-app px-3 text-sm"><option value="general">Update · blue</option><option value="reminder">Reminder · amber</option><option value="important">Important · red</option></select></label>
            <label className="text-sm font-medium text-primary">Update schedule<select value={cadence} onChange={(event) => setCadence(event.target.value as Cadence)} className="mt-1.5 min-h-10 w-full rounded-lg border border-default bg-app px-3 text-sm"><option value="once">One-time</option><option value="daily">Daily update</option><option value="weekly">Weekly update</option></select></label>
            <label className="text-sm font-medium text-primary">Expires at<input type="datetime-local" required min={localDateTime(new Date())} value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} className="mt-1.5 min-h-10 w-full rounded-lg border border-default bg-app px-3 text-sm" /></label>
          </div>
          {composerError && <p role="alert" className="text-sm text-error">{composerError}</p>}
          <div className="flex justify-end"><Button type="submit" icon={<Send size={16} />}>Publish notice</Button></div>
        </form>
      </Card>}
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {loading ? <Card className="p-8 text-center text-sm text-secondary">Loading notices…</Card> : orderedNotices.length === 0 ? <Card className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-brand-soft text-brand-strong"><Megaphone size={22} aria-hidden="true" /></span>
        <h2 className="mt-4 text-base font-semibold text-primary">No active notices</h2>
        <p className="mt-1 max-w-md text-sm leading-6 text-secondary">New company announcements and team updates will appear here.</p>
      </Card> : <div className="space-y-4">{orderedNotices.map((notice) => {
        const style = typeStyles[notice.type];
        const mayArchive = canPublish || notice.createdBy === employee?.id;
        return <Card key={notice.id} id={notice.id} className={`overflow-hidden border-l-4 ${style.border}`}>
          <article className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${style.badge}`}>{notice.type === "important" && <CircleAlert className="mr-1 inline" size={13} />}{style.label}</span><span className="rounded-full bg-subtle px-2.5 py-1 text-xs font-medium text-secondary">{cadenceLabels[notice.cadence]}</span></div>
                <h2 className="text-lg font-semibold text-primary">{notice.title}</h2>
              </div>
              {mayArchive && <Button variant="ghost" disabled={busyId === notice.id} onClick={() => void archive(notice)} icon={<Archive size={16} />}>Archive</Button>}
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-primary">{notice.body}</p>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-secondary">
              <span className={`inline-flex items-center gap-1.5 font-medium ${style.icon}`}><Megaphone size={14} />Posted by {notice.author.displayName}</span>
              <span className="inline-flex items-center gap-1.5"><Clock3 size={14} />Posted {formatDate(notice.createdAt)}</span>
              <span className="inline-flex items-center gap-1.5"><CalendarClock size={14} />Expires {formatDate(notice.expiresAt)}</span>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-default pt-4">
              <Button variant={notice.acknowledgedByMe ? "secondary" : "primary"} disabled={notice.acknowledgedByMe || busyId === notice.id} onClick={() => void acknowledge(notice)} icon={<Check size={16} />}>{notice.acknowledgedByMe ? "Acknowledged" : "Acknowledge"}</Button>
              <span className="text-xs text-secondary">{notice.acknowledgementCount} acknowledged</span>
              <Button variant="ghost" className="ml-auto" onClick={() => void toggleComments(notice)} icon={<MessageCircle size={16} />}>{notice.commentCount} comments{expanded[notice.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</Button>
            </div>
            {expanded[notice.id] && <section className="mt-4 space-y-3 border-t border-default pt-4" aria-label={`Comments on ${notice.title}`}>
              {(comments[notice.id] ?? []).length === 0 ? <p className="text-sm text-secondary">No comments yet.</p> : <ul className="space-y-3">{(comments[notice.id] ?? []).map((comment) => <li key={comment.id} className="rounded-lg bg-app px-3 py-2.5"><p className="whitespace-pre-wrap text-sm text-primary">{comment.body}</p><p className="mt-1 text-xs text-secondary">{comment.author.displayName} · {formatDate(comment.createdAt)}</p></li>)}</ul>}
              <div className="flex gap-2"><input aria-label="Write a comment" maxLength={3000} value={commentDrafts[notice.id] ?? ""} onChange={(event) => setCommentDrafts((current) => ({ ...current, [notice.id]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void addComment(notice); } }} className="min-h-10 min-w-0 flex-1 rounded-lg border border-default bg-app px-3 text-sm" placeholder="Add a comment…" /><Button disabled={!commentDrafts[notice.id]?.trim() || busyId === notice.id} onClick={() => void addComment(notice)} icon={<Send size={15} />}>Comment</Button></div>
            </section>}
          </article>
        </Card>;
      })}</div>}
    </div>
  );
}
