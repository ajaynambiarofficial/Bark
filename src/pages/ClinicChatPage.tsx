import { ArrowLeft, CheckCheck, MessageCircle, Paperclip, Search, Send, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";

interface ChatMessage { id: string; author: string; role: string; text: string; time: string; mine?: boolean }
interface ChatThread { id: string; name: string; type: "Clinic" | "Agents" | "Leadership"; subtitle: string; unread: number; messages: ChatMessage[] }

const initialThreads: ChatThread[] = [
  {
    id: "indiranagar",
    name: "Indiranagar Clinic",
    type: "Clinic",
    subtitle: "Bengaluru · Clinic team",
    unread: 2,
    messages: [
      { id: "i1", author: "Meera Nair", role: "Clinic Manager", text: "We have an IV case arriving around 3 PM. Can someone confirm the doctor and room are available?", time: "10:42 AM" },
      { id: "i2", author: "You", role: "Operations", text: "I’m checking the schedule now and will confirm shortly.", time: "10:48 AM", mine: true },
      { id: "i3", author: "Karan Shah", role: "City Operations Head", text: "Please keep the treatment room blocked for the full hour and update the booking notes.", time: "10:51 AM" },
    ],
  },
  {
    id: "koramangala",
    name: "Koramangala Clinic",
    type: "Clinic",
    subtitle: "Bengaluru · Clinic team",
    unread: 0,
    messages: [
      { id: "k1", author: "Anita Rao", role: "Front Desk", text: "The groomer is running about 15 minutes behind. We’ve informed the next customer.", time: "9:26 AM" },
      { id: "k2", author: "You", role: "Operations", text: "Thanks for the update. Please let us know if the next appointment needs to move.", time: "9:31 AM", mine: true },
    ],
  },
  {
    id: "pawcare-agents",
    name: "Pawcare Agents",
    type: "Agents",
    subtitle: "Pawcare operations team",
    unread: 0,
    messages: [
      { id: "a1", author: "Sana Iyer", role: "Booking Agent", text: "I’ve updated the afternoon appointment list. Two customers are still waiting for confirmation.", time: "10:16 AM" },
      { id: "a2", author: "You", role: "Operations", text: "I’ll follow up with the clinics and post an update here.", time: "10:23 AM", mine: true },
    ],
  },
  {
    id: "clinic-heads",
    name: "Clinic & Operations Heads",
    type: "Leadership",
    subtitle: "Clinic managers · City and zonal heads",
    unread: 1,
    messages: [
      { id: "h1", author: "Rohan Menon", role: "Zonal Head", text: "Please share the end-of-day clinic capacity update here once all teams have checked in.", time: "8:55 AM" },
    ],
  },
];

export function ClinicChatPage() {
  const [threads, setThreads] = useState(initialThreads);
  const [activeId, setActiveId] = useState(initialThreads[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const activeThread = threads.find((thread) => thread.id === activeId);
  const filteredThreads = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? threads.filter((thread) => `${thread.name} ${thread.subtitle}`.toLowerCase().includes(term)) : threads;
  }, [query, threads]);

  const sendMessage = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !activeThread) return;
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    setThreads((current) => current.map((thread) => thread.id === activeId
      ? { ...thread, messages: [...thread.messages, { id: `${thread.id}-${now.getTime()}`, author: "You", role: "Operations", text, time, mine: true }] }
      : thread));
    setDraft("");
  };

  return <div className="space-y-6">
    <PageHeader eyebrow="Pawcare" title="Clinic Chat" description="Message agents, clinic teams, and operations heads in one workspace." />
    <div className="overflow-hidden rounded-2xl border border-default bg-surface shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-4 border-b border-default px-5 py-3.5">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary"><MessageCircle size={17} className="text-brand" /> Agent, clinic, and leadership messages</div>
        <span className="rounded-full bg-info-soft px-2.5 py-1 text-[11px] font-semibold text-info">Preview</span>
      </div>
      <div className="grid min-h-[620px] md:grid-cols-[290px_minmax(0,1fr)]">
        <aside className={`${mobileThreadOpen ? "hidden md:block" : "block"} border-b border-default md:border-b-0 md:border-r`} aria-label="Conversations">
          <div className="p-3">
            <label className="relative block"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input aria-label="Search conversations" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search conversations" className="min-h-10 w-full rounded-lg border border-input bg-input pl-9 pr-3 text-xs text-primary" /></label>
          </div>
          <div className="space-y-1 px-2 pb-3">
            {filteredThreads.map((thread) => {
              const lastMessage = thread.messages[thread.messages.length - 1];
              return <button key={thread.id} type="button" onClick={() => { setActiveId(thread.id); setMobileThreadOpen(true); }} className={`w-full rounded-xl p-3 text-left transition-colors ${activeId === thread.id ? "bg-brand-soft" : "hover:bg-hover"}`} aria-current={activeId === thread.id ? "true" : undefined}>
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-subtle text-brand"><Users size={18} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold text-primary">{thread.name}</span>{thread.unread > 0 && <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand text-[10px] font-bold text-white">{thread.unread}</span>}</span>
                    <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wide text-muted">{thread.type}</span>
                    <span className="mt-1 block truncate text-xs text-secondary">{lastMessage?.text}</span>
                  </span>
                </div>
              </button>;
            })}
            {!filteredThreads.length && <p className="px-3 py-6 text-center text-xs text-muted">No conversations match your search.</p>}
          </div>
        </aside>

        <section className={`${mobileThreadOpen ? "flex" : "hidden md:flex"} min-w-0 flex-col`} aria-label={activeThread ? `${activeThread.name} conversation` : "Chat conversation"}>
          {activeThread ? <>
            <header className="flex items-center gap-3 border-b border-default px-4 py-3.5 sm:px-5">
              <button type="button" onClick={() => setMobileThreadOpen(false)} className="grid size-9 shrink-0 place-items-center rounded-lg text-secondary hover:bg-hover md:hidden" aria-label="Back to conversations"><ArrowLeft size={18} /></button>
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"><Users size={18} /></span>
              <div className="min-w-0"><h2 className="truncate text-sm font-semibold text-primary">{activeThread.name}</h2><p className="mt-0.5 truncate text-xs text-muted">{activeThread.subtitle}</p></div>
            </header>
            <div className="flex-1 space-y-4 overflow-y-auto bg-app/40 p-4 sm:p-6" aria-live="polite">
              <p className="mx-auto w-fit rounded-full bg-surface px-3 py-1 text-[10px] font-medium text-muted shadow-sm">Today</p>
              {activeThread.messages.map((message) => <article key={message.id} className={`flex ${message.mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] rounded-2xl px-4 py-3 sm:max-w-[75%] ${message.mine ? "rounded-br-md bg-brand text-white" : "rounded-bl-md border border-default bg-surface text-primary shadow-sm"}`}>
                  <div className={`mb-1 flex flex-wrap items-baseline gap-x-2 ${message.mine ? "text-white/75" : "text-muted"}`}><span className={`text-xs font-semibold ${message.mine ? "text-white" : "text-primary"}`}>{message.author}</span><span className="text-[10px]">{message.role}</span></div>
                  <p className="whitespace-pre-wrap text-sm leading-6">{message.text}</p>
                  <div className={`mt-1.5 flex items-center justify-end gap-1 text-[10px] ${message.mine ? "text-white/65" : "text-muted"}`}>{message.time}{message.mine && <CheckCheck size={13} />}</div>
                </div>
              </article>)}
            </div>
            <form onSubmit={sendMessage} className="border-t border-default bg-surface p-3 sm:p-4">
              <div className="flex items-end gap-2 rounded-xl border border-input bg-input p-2 focus-within:border-focus focus-within:ring-2 focus-within:ring-focus-soft">
                <button type="button" className="grid size-9 shrink-0 place-items-center rounded-lg text-muted" aria-label="Attach file (preview only)" title="Attachments will be available when chat is connected"><Paperclip size={18} /></button>
                <textarea aria-label="Message" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder={`Message ${activeThread.name}`} rows={1} className="max-h-32 min-h-9 flex-1 resize-y bg-transparent py-2 text-sm text-primary outline-none placeholder:text-muted" />
                <button type="submit" disabled={!draft.trim()} className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand text-white transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-45" aria-label="Send message"><Send size={16} /></button>
              </div>
              <p className="mt-2 px-1 text-[10px] text-muted">Preview only. Messages are kept in this page session and aren’t delivered to other users.</p>
            </form>
          </> : <div className="grid flex-1 place-items-center p-8 text-center"><div><MessageCircle size={28} className="mx-auto text-muted" /><p className="mt-3 text-sm font-semibold text-primary">Choose a conversation</p><p className="mt-1 text-xs text-muted">Select a clinic or leadership chat to view messages.</p></div></div>}
        </section>
      </div>
    </div>
  </div>;
}
