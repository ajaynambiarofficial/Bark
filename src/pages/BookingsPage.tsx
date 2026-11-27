import { CalendarPlus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";

interface Clinic { id: string; name: string }
interface Service { id: string; name: string; durationMinutes: number }
interface BookingRow { booking: { id: string; reference: string; status: string; startsAt: string; cancellationReason?: string | null }; customer: { name: string; phone: string; petName: string | null }; clinic: Clinic; service: Service; staff: { displayName: string } | null; createdBy?: { id: string; displayName: string; email: string } | null; cancelledBy?: { id: string; displayName: string; email: string } | null }
const appointmentSections = [
  { title: "Completed", statuses: ["completed", "consulted", "checked_out"], tone: "text-success" },
  { title: "Upcoming", statuses: ["pending", "confirmed", "checked_in", "in_progress"], tone: "text-info" },
  { title: "Cancelled", statuses: ["cancelled", "canceled"], tone: "text-muted" },
  { title: "No-show", statuses: ["no_show", "noshow"], tone: "text-error" },
] as const;
function todayAt(hour: number, minute = 0): string { const date = new Date(); date.setHours(hour, minute, 0, 0); return date.toISOString(); }
const sampleBookings: BookingRow[] = [
  { booking: { id: "sample-completed", reference: "DEMO-1001", status: "completed", startsAt: todayAt(9) }, customer: { name: "Ananya Rao", phone: "+91 90000 10001", petName: "Milo" }, clinic: { id: "demo-clinic", name: "Indiranagar Clinic" }, service: { id: "demo-consult", name: "Doctor consultation", durationMinutes: 30 }, staff: { displayName: "Dr. Meera" } },
  { booking: { id: "sample-upcoming", reference: "DEMO-1002", status: "confirmed", startsAt: todayAt(15, 30) }, customer: { name: "Rahul Menon", phone: "+91 90000 10002", petName: "Coco" }, clinic: { id: "demo-clinic", name: "Indiranagar Clinic" }, service: { id: "demo-vaccine", name: "Vaccination", durationMinutes: 20 }, staff: { displayName: "Dr. Meera" } },
  { booking: { id: "sample-noshow", reference: "DEMO-1003", status: "no_show", startsAt: todayAt(11) }, customer: { name: "Pooja Shah", phone: "+91 90000 10003", petName: "Luna" }, clinic: { id: "demo-clinic", name: "Koramangala Clinic" }, service: { id: "demo-grooming", name: "Grooming", durationMinutes: 60 }, staff: { displayName: "Arun" } },
];
const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api";
async function api<T>(path: string, init?: RequestInit): Promise<T> { const response = await fetch(`${apiBase}${path}`, { ...init, credentials: "include", headers: { "content-type": "application/json", ...init?.headers } }); const body = await response.json().catch(() => null) as { data?: T; error?: { message?: string } } | null; if (!response.ok) throw new Error(body?.error?.message ?? "The booking request failed."); return body?.data as T; }

export function BookingsPage() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({ customerName: "", phone: "", petName: "", clinicId: "", serviceId: "", startsAt: "", notes: "" });
  const displayBookings = bookings.length ? bookings : sampleBookings;
  const load = async () => { const [bookingRows, clinicRows, serviceRows] = await Promise.all([api<BookingRow[]>("/bookings?limit=100"), api<Clinic[]>("/catalog/clinics"), api<Service[]>("/catalog/services?surface=booking")]); setBookings(bookingRows); setClinics(clinicRows); setServices(serviceRows); };
  useEffect(() => { void load().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load bookings.")); }, []);
  const visible = useMemo(() => { const term = search.trim().toLowerCase(); return term ? displayBookings.filter((row) => [row.booking.reference, row.customer.name, row.customer.phone, row.clinic.name, row.service.name].some((value) => value.toLowerCase().includes(term))) : displayBookings; }, [displayBookings, search]);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setPending(true); setError(null); try { const service = services.find((item) => item.id === form.serviceId); if (!service) throw new Error("Choose a service."); const startsAt = new Date(form.startsAt); const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000); await api("/bookings", { method: "POST", body: JSON.stringify({ customer: { name: form.customerName, phone: form.phone, ...(form.petName ? { petName: form.petName } : {}) }, clinicId: form.clinicId, serviceId: form.serviceId, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), notes: form.notes }) }); await load(); setFormOpen(false); setForm({ customerName: "", phone: "", petName: "", clinicId: "", serviceId: "", startsAt: "", notes: "" }); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not create booking."); } finally { setPending(false); } };
  const cancel = async (row: BookingRow) => { const reason = window.prompt(`Why are you cancelling appointment ${row.booking.reference}?`); if (!reason || reason.trim().length < 3) return; setPending(true); setError(null); try { await api(`/bookings/${row.booking.id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }); await load(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not cancel appointment."); } finally { setPending(false); } };

  return <div className="space-y-6">
    <PageHeader eyebrow="Team workspace" title="Bookings" description="Create and track clinic appointments from one operational queue." action={<Button icon={<CalendarPlus size={17} />} onClick={() => setFormOpen((value) => !value)}>{formOpen ? "Close form" : "New booking"}</Button>} />
    {error && <p role="alert" className="rounded-lg border border-error-border bg-error-soft p-3 text-sm text-error">{error}</p>}
    {formOpen && <Card className="p-5"><form onSubmit={(event) => void submit(event)} className="grid gap-4 md:grid-cols-2">
      <label className="text-sm font-medium">Customer name<input required value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3" /></label>
      <label className="text-sm font-medium">Phone<input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3" /></label>
      <label className="text-sm font-medium">Pet name<input value={form.petName} onChange={(e) => setForm({ ...form, petName: e.target.value })} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3" /></label>
      <label className="text-sm font-medium">Clinic<select required value={form.clinicId} onChange={(e) => setForm({ ...form, clinicId: e.target.value })} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3"><option value="">Select clinic</option>{clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}</select></label>
      <label className="text-sm font-medium">Service<select required value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3"><option value="">Select service</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name} · {service.durationMinutes} min</option>)}</select></label>
      <label className="text-sm font-medium">Start time<input required type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3" /></label>
      <label className="text-sm font-medium md:col-span-2">Notes<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1.5 w-full rounded-lg border border-input bg-input p-3" rows={3} /></label>
      <div className="md:col-span-2 flex justify-end"><Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create booking"}</Button></div>
    </form></Card>}
    <Card className="overflow-hidden">
      <div className="border-b border-default p-4">
        <label className="relative block max-w-md"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input aria-label="Search bookings" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer, clinic, service, or reference" className="min-h-11 w-full rounded-lg border border-input bg-input pl-10 pr-3 text-sm" /></label>
      </div>
      <div className="grid gap-3 border-b border-default p-4 md:grid-cols-2 xl:grid-cols-4">
        {appointmentSections.map((section) => {
          const appointments = visible.filter((row) => section.statuses.some((status) => status === row.booking.status.toLowerCase()));
          const count = appointments.length;
          return <section key={section.title} aria-label={`${section.title} appointments`} className="rounded-xl border border-default bg-elevated p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className={`text-sm font-semibold ${section.tone}`}>{section.title}</h2>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${section.tone} bg-subtle`}>{count}</span>
            </div>
            <div className="mt-3 space-y-2">
              {appointments.length ? appointments.map((row) => <div key={row.booking.id} className="rounded-lg border border-default bg-surface p-3">
                <div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold text-primary">{row.customer.name}</p><span className="shrink-0 text-[10px] font-medium text-muted">{row.booking.reference}</span></div>
                <p className="mt-1 text-xs text-secondary">{row.customer.petName ?? "Pet not listed"} · {row.service.name}</p>
                <p className="mt-1 text-xs text-muted">{new Date(row.booking.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · {row.clinic.name}</p>
              </div>) : <p className="rounded-lg bg-surface p-3 text-xs text-muted">No {section.title.toLowerCase()} appointments.</p>}
            </div>
          </section>;
        })}
      </div>
      {!bookings.length && <p className="border-b border-default px-4 py-2 text-xs text-muted">Sample appointments for preview. Live bookings will appear here when available.</p>}
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-subtle text-xs uppercase text-muted"><tr><th className="p-4">Reference</th><th className="p-4">Customer</th><th className="p-4">Appointment</th><th className="p-4">Clinic</th><th className="p-4">Created by</th><th className="p-4">Status / cancellation</th><th className="p-4">Action</th></tr></thead><tbody>{visible.map((row) => <tr key={row.booking.id} className="border-t border-default"><td className="p-4 font-semibold">{row.booking.reference}</td><td className="p-4"><p>{row.customer.name}</p><p className="text-xs text-muted">{row.customer.petName ?? row.customer.phone}</p></td><td className="p-4"><p>{row.service.name}</p><p className="text-xs text-muted">{new Date(row.booking.startsAt).toLocaleString()}</p></td><td className="p-4">{row.clinic.name}</td><td className="p-4">{row.createdBy?.displayName ?? "Unknown"}<p className="text-xs text-muted">{row.createdBy?.email}</p></td><td className="p-4 capitalize">{row.booking.status.replaceAll("_", " ")}{row.cancelledBy && <p className="mt-1 text-xs text-muted">Cancelled by {row.cancelledBy.displayName}{row.booking.cancellationReason ? ` · ${row.booking.cancellationReason}` : ""}</p>}</td><td className="p-4">{!bookings.length ? <span className="text-xs text-muted">Sample</span> : !["cancelled", "completed"].includes(row.booking.status) ? <Button variant="secondary" disabled={pending} onClick={() => void cancel(row)}>Cancel</Button> : <span className="text-xs text-muted">—</span>}</td></tr>)}</tbody></table>{!visible.length && <p className="p-8 text-center text-sm text-muted">No bookings found.</p>}</div>
    </Card>
  </div>;
}
