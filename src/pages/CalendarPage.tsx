import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { calendarEventTypes, calendarService, canManageCalendar } from "../features/calendar/calendar.service";
import type { CalendarEventType, TeamCalendarEvent } from "../features/calendar/calendar.service";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const eventTypeStyles: Record<CalendarEventType, string> = {
  Meetings: "bg-info-soft text-info",
  Offers: "bg-success-soft text-success",
  "Feedback session": "bg-warning-soft text-warning",
  Others: "bg-subtle text-secondary",
};

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getMonthDays(month: Date) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(firstDay.getFullYear(), firstDay.getMonth(), 1 - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index));
}

function blankForm(date: string) {
  return { title: "", type: "Meetings" as CalendarEventType, date, time: "09:00", description: "" };
}

export function CalendarPage() {
  const { employee } = useAuth();
  const [events, setEvents] = useState<TeamCalendarEvent[]>([]);
  const [viewMonth, setViewMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [form, setForm] = useState(() => blankForm(dateKey(new Date())));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState("");
  const canEdit = Boolean(employee && canManageCalendar(employee.role));
  const monthDays = useMemo(() => getMonthDays(viewMonth), [viewMonth]);
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, TeamCalendarEvent[]>();
    for (const event of events) grouped.set(event.date, [...(grouped.get(event.date) ?? []), event]);
    return grouped;
  }, [events]);
  const selectedEvents = eventsByDate.get(selectedDate) ?? [];
  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null;

  useEffect(() => { let active = true; void calendarService.list().then((result) => { if (active) setEvents(result); }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Could not load calendar events."); }); return () => { active = false; }; }, []);

  if (!employee) return null;

  const startNewEvent = () => {
    setForm(blankForm(selectedDate));
    setEditingId(null);
    setSelectedEventId(null);
    setError("");
    setFormOpen(true);
  };

  const startEditing = (event: TeamCalendarEvent) => {
    setForm({ title: event.title, type: event.type, date: event.date, time: event.time, description: event.description });
    setEditingId(event.id);
    setSelectedEventId(event.id);
    setSelectedDate(event.date);
    setError("");
    setFormOpen(true);
  };

  const saveEvent = async (submitEvent: React.FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    setError("");
    try {
      setEvents(await calendarService.save(form, employee, editingId ?? undefined));
      setSelectedDate(form.date);
      setSelectedEventId(null);
      setViewMonth(new Date(`${form.date}T12:00:00`));
      setFormOpen(false);
      setEditingId(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this calendar event.");
    }
  };

  const deleteEvent = async (event: TeamCalendarEvent) => {
    if (!window.confirm(`Delete “${event.title}” from the calendar?`)) return;
    try {
      setEvents(await calendarService.remove(event.id, employee));
      setSelectedEventId(null);
      setFormOpen(false);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete this calendar event.");
    }
  };

  const selectDate = (date: Date) => {
    setSelectedDate(dateKey(date));
    setSelectedEventId(null);
    if (date.getMonth() !== viewMonth.getMonth()) setViewMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  };

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Team workspace"
        title="Calendar"
        description="Keep team meetings, offers, feedback sessions, and other events in one shared view."
        action={canEdit ? <Button icon={<Plus size={17} />} onClick={startNewEvent}>Add event</Button> : undefined}
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.8fr)]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-default px-4 py-4 sm:px-5">
            <div className="flex items-center gap-2">
              <Button variant="secondary" className="size-10 px-0" aria-label="Previous month" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}><ChevronLeft size={18} /></Button>
              <Button variant="secondary" className="size-10 px-0" aria-label="Next month" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}><ChevronRight size={18} /></Button>
              <h2 className="ml-2 text-lg font-semibold text-primary">{viewMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>
            </div>
            <Button variant="ghost" className="min-h-9 px-3" onClick={() => { const today = new Date(); setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1)); selectDate(today); }}>Today</Button>
          </div>

          <div className="grid grid-cols-7 border-b border-default bg-subtle/50" role="row">
            {weekdays.map((day) => <div key={day} role="columnheader" className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">{day}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {monthDays.map((day) => {
              const key = dateKey(day);
              const dayEvents = eventsByDate.get(key) ?? [];
              const inMonth = day.getMonth() === viewMonth.getMonth();
              const isToday = key === dateKey(new Date());
              const isSelected = key === selectedDate;
              return (
                <div key={key} className={`min-h-[92px] border-b border-r border-default p-1.5 sm:min-h-[112px] sm:p-2 ${inMonth ? "bg-surface" : "bg-subtle/40"}`}>
                  <button type="button" onClick={() => selectDate(day)} aria-pressed={isSelected} aria-label={day.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} className={`grid size-7 place-items-center rounded-full text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${isSelected ? "bg-brand text-on-brand" : isToday ? "border border-brand text-brand-strong" : inMonth ? "text-primary hover:bg-hover" : "text-muted"}`}>
                    {day.getDate()}
                  </button>
                  <div className="mt-1 space-y-1">
                    {dayEvents.slice(0, 2).map((event) => (
                      <button key={event.id} type="button" onClick={() => { setSelectedDate(key); setSelectedEventId(event.id); setFormOpen(false); }} className={`block w-full truncate rounded px-1.5 py-1 text-left text-[10px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:text-xs ${eventTypeStyles[event.type]}`} title={`${event.time} · ${event.title}`}>
                        <span className="font-semibold">{event.time}</span> {event.title}
                      </button>
                    ))}
                    {dayEvents.length > 2 && <p className="px-1 text-[10px] text-muted">+{dayEvents.length - 2} more</p>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2 px-4 py-3 text-[11px] sm:px-5">
            {calendarEventTypes.map((type) => <span key={type} className="inline-flex items-center gap-1.5 text-secondary"><span className={`size-2 rounded-full ${type === "Meetings" ? "bg-info" : type === "Offers" ? "bg-success" : type === "Feedback session" ? "bg-warning" : "bg-muted"}`} />{type}</span>)}
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-strong">Selected day</p>
              <h2 className="mt-1 text-lg font-semibold text-primary">{new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</h2>
            </div>
            {canEdit && !formOpen && <Button variant="secondary" className="min-h-9 px-3" icon={<Plus size={15} />} onClick={startNewEvent}>Add</Button>}
          </div>

          {error && <p role="alert" className="mt-4 rounded-[var(--radius-control)] border border-error-border bg-error-soft px-3 py-2 text-sm text-error">{error}</p>}

          {formOpen ? (
            <form className="mt-5 space-y-4 border-t border-default pt-4" onSubmit={(event) => void saveEvent(event)}>
              <div className="flex items-center justify-between gap-2"><h3 className="font-semibold text-primary">{editingId ? "Edit event" : "New event"}</h3><button type="button" onClick={() => { setFormOpen(false); setEditingId(null); setError(""); }} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-hover hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" aria-label="Close event form"><X size={17} /></button></div>
              <label className="block text-xs font-medium text-secondary">Title<input required maxLength={100} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="mt-1.5 min-h-10 w-full rounded-[var(--radius-control)] border border-default bg-input px-3 text-sm text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" placeholder="e.g. Weekly sales sync" /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-medium text-secondary">Topic<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as CalendarEventType })} className="mt-1.5 min-h-10 w-full rounded-[var(--radius-control)] border border-default bg-input px-2 text-sm text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">{calendarEventTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
                <label className="block text-xs font-medium text-secondary">Time<input required type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} className="mt-1.5 min-h-10 w-full rounded-[var(--radius-control)] border border-default bg-input px-2 text-sm text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" /></label>
              </div>
              <label className="block text-xs font-medium text-secondary">Date<input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} className="mt-1.5 min-h-10 w-full rounded-[var(--radius-control)] border border-default bg-input px-3 text-sm text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" /></label>
              <label className="block text-xs font-medium text-secondary">Details <span className="font-normal text-muted">(optional)</span><textarea rows={3} maxLength={500} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="mt-1.5 w-full resize-y rounded-[var(--radius-control)] border border-default bg-input px-3 py-2 text-sm text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" placeholder="Add an agenda or other notes" /></label>
              <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => { setFormOpen(false); setEditingId(null); }}>Cancel</Button><Button type="submit">{editingId ? "Save changes" : "Create event"}</Button></div>
            </form>
          ) : selectedEvent ? (
            <div className="mt-5 border-t border-default pt-4">
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${eventTypeStyles[selectedEvent.type]}`}>{selectedEvent.type}</span>
              <h3 className="mt-3 text-base font-semibold text-primary">{selectedEvent.title}</h3>
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-secondary"><Clock3 size={15} aria-hidden="true" />{selectedEvent.time}</p>
              {selectedEvent.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-secondary">{selectedEvent.description}</p>}
              <p className="mt-4 text-xs text-muted">Added by {selectedEvent.createdBy}</p>
              {canEdit && <div className="mt-4 flex gap-2 border-t border-default pt-4"><Button variant="secondary" icon={<Pencil size={15} />} onClick={() => startEditing(selectedEvent)}>Edit</Button><Button variant="ghost" className="text-error hover:text-error" icon={<Trash2 size={15} />} onClick={() => void deleteEvent(selectedEvent)}>Delete</Button></div>}
            </div>
          ) : selectedEvents.length ? (
            <div className="mt-5 space-y-2 border-t border-default pt-4">
              {selectedEvents.map((event) => <button type="button" key={event.id} onClick={() => setSelectedEventId(event.id)} className="block w-full rounded-[var(--radius-control)] border border-default p-3 text-left transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"><div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold text-primary">{event.title}</span><span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${eventTypeStyles[event.type]}`}>{event.type}</span></div><p className="mt-1 inline-flex items-center gap-1 text-xs text-muted"><Clock3 size={13} aria-hidden="true" />{event.time}</p></button>)}
            </div>
          ) : (
            <div className="mt-5 rounded-[var(--radius-control)] bg-subtle p-4 text-center">
              <CalendarDays size={22} className="mx-auto text-muted" aria-hidden="true" />
              <p className="mt-2 text-sm font-medium text-primary">No events scheduled</p>
              <p className="mt-1 text-xs text-muted">{canEdit ? "Add an event for your team." : "Events added by your leads and managers will appear here."}</p>
            </div>
          )}

          {!canEdit && <p className="mt-5 border-t border-default pt-4 text-xs leading-5 text-muted">View access · Calendar edits are available to team leads and managers.</p>}
        </Card>
      </div>
    </div>
  );
}
