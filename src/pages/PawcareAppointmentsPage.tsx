import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, Clock3, MapPin, PawPrint, Stethoscope, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";

interface Clinic { id: string; name: string }
interface Appointment { booking: { id: string; reference: string; status: string; startsAt: string; endsAt: string }; customer: { id: string; name: string; phone: string; petName: string | null }; clinic: Clinic; service: { id: string; name: string }; staff: { id: string | null; displayName: string | null; role: string | null } | null }
const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api";
const mockMode = import.meta.env.VITE_USE_MOCK_AUTH === "true";
const demoClinic: Clinic = { id: "demo-indiranagar", name: "Indiranagar Clinic" };

async function api<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, { credentials: "include" });
  const body = await response.json().catch(() => null) as { data?: T; error?: { message?: string } } | null;
  if (!response.ok) throw new Error(body?.error?.message ?? "Could not load appointments.");
  return body?.data as T;
}
function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function dateLabel(date: Date) { return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }); }
function demoAppointments(date: Date, clinic: Clinic): Appointment[] {
  const at = (hour: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, 30).toISOString();
  const dayOffset = date.getDate() - new Date().getDate();
  return dayOffset === 0 ? [
    { booking: { id: "demo-appt-1", reference: "APT-266584", status: "completed", startsAt: at(10), endsAt: at(11) }, customer: { id: "customer-1", name: "Ajay Nambiar", phone: "+919829394440", petName: "Nova" }, clinic, service: { id: "service-1", name: "General Consultation" }, staff: { id: "doctor-1", displayName: "Dr. Aishwarya", role: "Doctor" } },
    { booking: { id: "demo-appt-2", reference: "APT-266612", status: "no_show", startsAt: at(14), endsAt: at(15) }, customer: { id: "customer-2", name: "Riya Sharma", phone: "+919876543210", petName: "Milo" }, clinic, service: { id: "service-2", name: "Vaccination" }, staff: { id: "doctor-2", displayName: "Dr. Remya Nair", role: "Doctor" } },
    { booking: { id: "demo-appt-3", reference: "APT-266704", status: "confirmed", startsAt: at(16), endsAt: at(17) }, customer: { id: "customer-3", name: "Karan Mehta", phone: "+919900112233", petName: "Luna" }, clinic, service: { id: "service-3", name: "Grooming session" }, staff: { id: "groomer-1", displayName: "Saman M", role: "Groomer" } },
  ] : [];
}
function attendance(status: string, startsAt: string) {
  if (new Date(startsAt) > new Date()) return { label: "Upcoming", tone: "bg-info-soft text-info", icon: Clock3 };
  if (["completed", "consulted", "checked_out", "checked_in", "in_progress"].includes(status.toLowerCase())) return { label: "Showed up", tone: "bg-success-soft text-success", icon: CheckCircle2 };
  if (["no_show", "noshow"].includes(status.toLowerCase())) return { label: "Did not show", tone: "bg-error-soft text-error", icon: XCircle };
  if (["cancelled", "canceled"].includes(status.toLowerCase())) return { label: "Cancelled", tone: "bg-subtle text-muted", icon: XCircle };
  return { label: "Attendance not recorded", tone: "bg-warning-soft text-warning", icon: Clock3 };
}

export function PawcareAppointmentsPage() {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [clinicId, setClinicId] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const selectedClinic = clinics.find((clinic) => clinic.id === clinicId);
  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; role: string; appointments: Appointment[] }>();
    for (const appointment of appointments) {
      const name = appointment.staff?.displayName ?? "Unassigned";
      const role = appointment.staff?.role ?? "Provider";
      const current = map.get(name) ?? { name, role, appointments: [] };
      current.appointments.push(appointment);
      map.set(name, current);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [appointments]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true); setError(null);
      try {
        if (mockMode) { setClinics([demoClinic]); setClinicId((current) => current || demoClinic.id); if (active) setAppointments(demoAppointments(viewDate, demoClinic)); return; }
        const clinicRows = await api<Clinic[]>("/catalog/clinics");
        const start = new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate());
        const end = new Date(start); end.setDate(end.getDate() + 1);
        const query = new URLSearchParams({ from: start.toISOString(), to: end.toISOString(), limit: "100" });
        if (clinicId) query.set("clinicId", clinicId);
        const rows = await api<Appointment[]>(`/bookings?${query}`);
        if (active) { setClinics(clinicRows); setAppointments(rows); }
      } catch (caught) { if (active) setError(caught instanceof Error ? caught.message : "Could not load appointments."); }
      finally { if (active) setLoading(false); }
    };
    void load(); return () => { active = false; };
  }, [viewDate, clinicId]);

  const moveDate = (days: number) => setViewDate((current) => new Date(current.getFullYear(), current.getMonth(), current.getDate() + days));
  const today = new Date();
  return <div className="space-y-6">
    <PageHeader eyebrow="Pawcare" title="Appointments" description="View the day’s schedule across doctors and groomers, with attendance outcomes." action={<label className="flex min-h-10 items-center gap-2 rounded-lg border border-default bg-elevated px-3 text-sm text-primary"><MapPin size={15} className="text-brand" /><span className="sr-only">Select clinic</span><select value={clinicId} onChange={(event) => setClinicId(event.target.value)} className="max-w-[190px] bg-transparent font-semibold outline-none"><option value="">All clinics</option>{clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}</select></label>} />
    {error && <p role="alert" className="rounded-lg border border-error-border bg-error-soft p-3 text-sm text-error">{error}</p>}
    <Card className="p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Button variant="secondary" className="size-10 px-0" aria-label="Previous day" onClick={() => moveDate(-1)}><ArrowLeft size={17} /></Button><Button variant="secondary" className="size-10 px-0" aria-label="Next day" onClick={() => moveDate(1)}><ArrowRight size={17} /></Button><div className="ml-2"><p className="text-xs font-semibold uppercase tracking-wide text-brand-strong">Daily schedule</p><h2 className="text-lg font-semibold text-primary">{dateLabel(viewDate)}</h2></div></div><div className="flex items-center gap-2"><input type="date" value={dateKey(viewDate)} onChange={(event) => { const next = new Date(`${event.target.value}T12:00:00`); if (!Number.isNaN(next.getTime())) setViewDate(next); }} className="min-h-10 rounded-lg border border-input bg-input px-3 text-sm text-primary" /><Button variant="ghost" disabled={dateKey(today) === dateKey(viewDate)} onClick={() => setViewDate(today)}>Today</Button></div></div><div className="mt-4 flex flex-wrap items-center gap-3 border-t border-default pt-4 text-xs text-muted"><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-info" />Upcoming</span><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-success" />Showed up</span><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-error" />Did not show</span>{selectedClinic && <span className="ml-auto inline-flex items-center gap-1.5 font-medium text-secondary"><MapPin size={13} />{selectedClinic.name}</span>}</div></Card>
    {loading ? <div className="h-[520px] animate-pulse rounded-xl bg-subtle" /> : grouped.length ? <DailyTimeline providers={grouped} /> : <Card className="p-10 text-center"><CalendarDays size={28} className="mx-auto text-muted" /><p className="mt-3 text-sm font-semibold text-primary">No appointments for this day</p><p className="mt-1 text-xs text-muted">Try another date or switch clinics.</p></Card>}
    <Card className="overflow-hidden"><div className="flex items-center justify-between gap-3 border-b border-default px-5 py-4"><div><h2 className="text-base font-semibold text-primary">Daily appointment list</h2><p className="mt-1 text-xs text-muted">All providers in one place for {dateLabel(viewDate)}.</p></div><span className="text-xs font-semibold text-muted">{appointments.length} records</span></div>{appointments.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-subtle text-xs uppercase text-muted"><tr><th className="p-4">Time</th><th className="p-4">Provider</th><th className="p-4">Customer / Pet</th><th className="p-4">Service</th><th className="p-4">Attendance</th></tr></thead><tbody>{appointments.slice().sort((a, b) => a.booking.startsAt.localeCompare(b.booking.startsAt)).map((appointment) => <tr key={appointment.booking.id} className="border-t border-default"><td className="p-4 whitespace-nowrap">{new Date(appointment.booking.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td><td className="p-4"><p className="font-semibold text-primary">{appointment.staff?.displayName ?? "Unassigned"}</p><p className="text-xs text-muted">{appointment.staff?.role ?? "Provider"}</p></td><td className="p-4"><p>{appointment.customer.name}</p><p className="text-xs text-muted">{appointment.customer.petName ?? "Pet not recorded"}</p></td><td className="p-4">{appointment.service.name}</td><td className="p-4"><Attendance status={appointment.booking.status} startsAt={appointment.booking.startsAt} /></td></tr>)}</tbody></table></div> : <p className="p-8 text-center text-sm text-muted">No appointments found.</p>}</Card>
    <p className="text-xs leading-5 text-muted">Attendance is derived from booking status: completed, check-in, and in-progress records count as attended; no-show records count as did not show; unresolved past bookings remain unrecorded.</p>
  </div>;
}

function Attendance({ status, startsAt }: { status: string; startsAt: string }) { const result = attendance(status, startsAt); const Icon = result.icon; return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${result.tone}`}><Icon size={13} />{result.label}</span>; }
function DailyTimeline({ providers }: { providers: Array<{ name: string; role: string; appointments: Appointment[] }> }) {
  const startHour = 8;
  const endHour = 20;
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index);
  const rowHeight = 72;
  return <Card className="overflow-hidden"><div className="overflow-x-auto"><div className="min-w-[760px]"><div className="grid border-b border-default bg-subtle/50" style={{ gridTemplateColumns: `72px repeat(${providers.length}, minmax(190px, 1fr))` }}><div className="border-r border-default p-3 text-[10px] font-semibold uppercase tracking-wide text-muted">Time</div>{providers.map((provider) => <div key={provider.name} className="border-r border-default p-3"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-full bg-brand-soft text-brand-strong">{provider.role.toLowerCase().includes("groom") ? <PawPrint size={15} /> : <Stethoscope size={15} />}</span><div className="min-w-0"><p className="truncate text-xs font-semibold text-primary">{provider.name}</p><p className="text-[10px] text-muted">{provider.role}</p></div></div></div>)}</div><div className="relative grid" style={{ gridTemplateColumns: `72px repeat(${providers.length}, minmax(190px, 1fr))` }}><div className="border-r border-default">{hours.map((hour) => <div key={hour} className="border-b border-default px-3 pt-2 text-[11px] font-medium tabular-nums text-muted" style={{ height: rowHeight }}>{`${String(hour).padStart(2, "0")}:00`}</div>)}</div>{providers.map((provider) => <div key={provider.name} className="relative border-r border-default">{hours.map((hour) => <div key={hour} className="border-b border-default" style={{ height: rowHeight }} />)}{provider.appointments.map((appointment) => <TimelineAppointment key={appointment.booking.id} appointment={appointment} startHour={startHour} rowHeight={rowHeight} />)}</div>)}</div></div></div><p className="border-t border-default px-4 py-3 text-xs text-muted">Daily provider view · Scroll horizontally to see all doctors and groomers.</p></Card>;
}
function TimelineAppointment({ appointment, startHour, rowHeight }: { appointment: Appointment; startHour: number; rowHeight: number }) {
  const start = new Date(appointment.booking.startsAt); const end = new Date(appointment.booking.endsAt); const top = Math.max(0, ((start.getHours() + start.getMinutes() / 60) - startHour) * rowHeight); const height = Math.max(48, ((end.getTime() - start.getTime()) / 3_600_000) * rowHeight - 8); const result = attendance(appointment.booking.status, appointment.booking.startsAt);
  return <div className="absolute left-1 right-1 overflow-hidden rounded-lg border border-info-border bg-info-soft p-2 shadow-sm" style={{ top, height }} title={`${appointment.customer.name} · ${appointment.service.name}`}><p className="truncate text-[11px] font-bold text-info">{start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {appointment.customer.name}</p><p className="mt-1 truncate text-[10px] text-secondary">{appointment.customer.petName ?? "Pet"} · {appointment.service.name}</p><span className={`mt-1 inline-flex rounded px-1.5 py-0.5 text-[9px] font-semibold ${result.tone}`}>{result.label}</span></div>;
}
