import type { Employee, EmployeeRole } from "../../types/auth";

export const calendarEventTypes = ["Meetings", "Offers", "Feedback session", "Others"] as const;
export type CalendarEventType = (typeof calendarEventTypes)[number];
export interface TeamCalendarEvent { id: string; title: string; type: CalendarEventType; date: string; time: string; description: string; createdBy: string; updatedAt: string }
interface ApiEvent { id: string; title: string; eventType: CalendarEventType; startsAt: string; description: string; createdBy: string; updatedAt: string }

const editorRoles: readonly EmployeeRole[] = ["sales-team-lead", "sales-manager", "clinic-manager", "central-management", "god"];
const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api";
export function canManageCalendar(role: EmployeeRole) { return editorRoles.includes(role); }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, { ...init, credentials: "include", headers: { "content-type": "application/json", ...init?.headers } });
  const body = response.status === 204 ? null : await response.json().catch(() => null) as { data?: T; error?: { message?: string } } | null;
  if (!response.ok) throw new Error(body?.error?.message ?? "The calendar request failed.");
  return body?.data as T;
}

function localParts(value: string) {
  const date = new Date(value);
  return { date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`, time: `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}` };
}
function fromApi(event: ApiEvent): TeamCalendarEvent { return { id: event.id, title: event.title, type: event.eventType, ...localParts(event.startsAt), description: event.description, createdBy: event.createdBy, updatedAt: event.updatedAt }; }
function validateEvent(event: Omit<TeamCalendarEvent, "id" | "createdBy" | "updatedAt">) {
  if (!event.title.trim()) throw new Error("Enter an event title.");
  if (!calendarEventTypes.includes(event.type)) throw new Error("Choose a valid event type.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(event.time)) throw new Error("Choose a valid event date and time.");
}

export const calendarService = {
  async list(): Promise<TeamCalendarEvent[]> {
    const query = new URLSearchParams({ from: new Date("2020-01-01T00:00:00Z").toISOString(), to: new Date("2036-01-01T00:00:00Z").toISOString() });
    return (await request<ApiEvent[]>(`/calendar/events?${query}`)).map(fromApi);
  },
  async save(input: Omit<TeamCalendarEvent, "id" | "createdBy" | "updatedAt">, actor: Employee, id?: string): Promise<TeamCalendarEvent[]> {
    if (!canManageCalendar(actor.role)) throw new Error("Only team leads and managers can edit the calendar.");
    validateEvent(input);
    const payload = { title: input.title.trim(), eventType: input.type, startsAt: new Date(`${input.date}T${input.time}:00`).toISOString(), description: input.description.trim(), ...(id ? { reason: "Calendar event edited" } : {}) };
    await request<ApiEvent>(`/calendar/events${id ? `/${id}` : ""}`, { method: id ? "PATCH" : "POST", body: JSON.stringify(payload) });
    return this.list();
  },
  async remove(id: string, actor: Employee): Promise<TeamCalendarEvent[]> {
    if (!canManageCalendar(actor.role)) throw new Error("Only team leads and managers can edit the calendar.");
    await request<void>(`/calendar/events/${id}`, { method: "DELETE", body: JSON.stringify({ reason: "Calendar event deleted" }) });
    return this.list();
  },
};
