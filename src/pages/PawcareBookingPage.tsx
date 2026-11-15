import { ArrowLeft, CalendarDays, Check, CheckCircle2, Clock3, Copy, PawPrint, Phone, Plus, Search, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";

type Coat = "Short" | "Long" | "Unknown";
type Size = "Small" | "Medium" | "Large" | "Giant";
interface Customer { id: string; name: string; email: string | null; phone: string; petName: string | null; petSpecies: string | null }
interface Pet { id: string; name: string; species: string; breed: string | null; size: Size | null; coatType: Coat | null; sex: string | null; reproductiveStatus: string | null; birthDate?: string | null; age: string | null; status: string; vaccinationStatus: string }
interface Profile { customer: Customer; pets: Pet[]; appointments: Array<{ id: string; reference: string; startsAt: string; endsAt: string; status: string; clinic: { name: string }; service: { name: string }; notes: string }>; healthRecords: Array<{ id: string; type: string; title: string; status: string; date: string }>; orderHistory: Array<{ id: string; date: string; title: string; amount: string; status: string }> }
interface Clinic { id: string; name: string }
interface Service { id: string; sku: string; name: string; category: string; durationMinutes: number }
interface Slot { startsAt: string; endsAt: string }
interface ApiBody<T> { data: T; error?: { message?: string } }
interface BreedInfo { name: string; size: Size; coatType: Exclude<Coat, "Unknown"> }
interface BookingConfirmation {
  reference: string;
  startsAt: string;
  endsAt: string;
  service: string;
  clinic: string;
  notes: string;
  pet: Pet;
  customer: Customer;
  veterinarian: string;
}

const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api";
const servicesByGroup: Record<string, string[]> = {
  Consultation: ["CONSULT-GENERAL", "CONSULT-FOLLOWUP", "CONSULT-SURGERY", "CONSULT-IV"],
  Grooming: ["GROOM-LONG", "GROOM-SHORT", "BATH-DRY"],
  Vaccination: ["VACCINE"],
  "Other services": ["DEWORM", "FIT-TRAVEL"],
};
const breedCatalog: Record<string, BreedInfo[]> = {
  Dog: [
    { name: "Labrador Retriever", size: "Large", coatType: "Short" }, { name: "Golden Retriever", size: "Large", coatType: "Long" },
    { name: "Beagle", size: "Medium", coatType: "Short" }, { name: "Shih Tzu", size: "Small", coatType: "Long" },
    { name: "Pug", size: "Small", coatType: "Short" }, { name: "German Shepherd", size: "Large", coatType: "Long" },
    { name: "Indie / Indian Pariah", size: "Medium", coatType: "Short" }, { name: "Mixed / Unknown", size: "Medium", coatType: "Short" },
  ],
  Cat: [
    { name: "Domestic Shorthair", size: "Medium", coatType: "Short" }, { name: "Domestic Longhair", size: "Medium", coatType: "Long" },
    { name: "Persian", size: "Medium", coatType: "Long" }, { name: "Maine Coon", size: "Large", coatType: "Long" },
    { name: "Siamese", size: "Medium", coatType: "Short" }, { name: "Mixed / Unknown", size: "Medium", coatType: "Short" },
  ],
};
const inputClass = "mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm text-primary";
const labelClass = "text-sm font-medium text-primary";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, { ...init, credentials: "include", headers: { "content-type": "application/json", ...init?.headers } });
  const body = await response.json().catch(() => null) as ApiBody<T> | null;
  if (!response.ok) throw new Error(body?.error?.message ?? "The booking request could not be completed.");
  return body?.data as T;
}

function localDateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function timeLabel(iso: string) { return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }

function drawReceiptRow(context: CanvasRenderingContext2D, y: number, label: string, value: string) {
  context.font = "500 19px Arial, sans-serif";
  context.fillStyle = "#aeb5cc";
  context.textAlign = "left";
  context.fillText(label, 32, y);
  context.font = "600 19px Arial, sans-serif";
  context.fillStyle = "#c8cce0";
  context.textAlign = "right";
  let fitted = value || "—";
  while (context.measureText(fitted).width > 560 && fitted.length > 4) fitted = `${fitted.slice(0, -4)}…`;
  context.fillText(fitted, 868, y);
}

function drawReceiptDivider(context: CanvasRenderingContext2D, y: number) {
  context.strokeStyle = "#414761";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(32, y);
  context.lineTo(868, y);
  context.stroke();
}

async function makeBookingScreenshot(booking: BookingConfirmation): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 800;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not prepare the booking image.");

  context.fillStyle = "#1b203e";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#16c784";
  context.beginPath();
  context.arc(49, 48, 17, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#102d2b";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(40, 48);
  context.lineTo(47, 55);
  context.lineTo(59, 41);
  context.stroke();
  context.textAlign = "left";
  context.fillStyle = "#e0e3f0";
  context.font = "700 21px Arial, sans-serif";
  context.fillText("Appointment Booked Successfully!", 78, 55);

  context.fillStyle = "#aeb5cc";
  context.font = "600 17px Arial, sans-serif";
  context.fillText("Appointment ID", 32, 108);
  context.fillStyle = "#c8cce0";
  context.font = "700 20px Arial, sans-serif";
  context.fillText(booking.reference, 32, 137);
  drawReceiptDivider(context, 161);

  const dateLabel = new Date(booking.startsAt).toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeRange = `${timeLabel(booking.startsAt)} - ${timeLabel(booking.endsAt)}`;
  const pet = booking.pet;
  const owner = booking.customer;
  const sections: Array<{ title: string; rows: [string, string][] }> = [
    { title: "Appointment Details", rows: [["Date", dateLabel], ["Time", timeRange], ["Type", booking.service], ["Staff", booking.veterinarian], ["Clinic", booking.clinic], ["Remarks", booking.notes || booking.service]] },
    { title: "Pet Information", rows: [["Name", pet.name], ["Species", pet.species], ["Breed", pet.breed ?? "Not recorded"], ["Gender", pet.sex ?? "Unknown"]] },
    { title: "Owner Information", rows: [["Name", owner.name], ["Phone", owner.phone], ["Email", owner.email ?? "Not provided"]] },
    { title: "Veterinarian", rows: [[booking.veterinarian, ""]] },
  ];
  let y = 196;
  for (const [sectionIndex, section] of sections.entries()) {
    context.textAlign = "left";
    context.fillStyle = "#aeb5cc";
    context.font = "700 17px Arial, sans-serif";
    context.fillText(section.title, 32, y);
    y += 29;
    for (const [label, value] of section.rows) {
      if (value) drawReceiptRow(context, y, label, value);
      else {
        context.fillStyle = "#c8cce0";
        context.font = "600 19px Arial, sans-serif";
        context.fillText(label, 32, y);
      }
      y += 27;
    }
    if (sectionIndex < sections.length - 1) {
      drawReceiptDivider(context, y - 8);
      y += 19;
    }
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Your browser could not create the booking image.");
  return blob;
}

export function PawcareBookingPage() {
  const [phone, setPhone] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [clinicId, setClinicId] = useState("");
  const [serviceGroup, setServiceGroup] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(() => localDateKey(new Date()));
  const [slot, setSlot] = useState("");
  const [notes, setNotes] = useState("");
  const [newCustomer, setNewCustomer] = useState({ name: "", email: "" });
  const [petFormOpen, setPetFormOpen] = useState(false);
  const [petDraft, setPetDraft] = useState({ name: "", species: "Dog", breed: "", size: "Medium" as Size, coatType: "Short" as Coat, birthDate: "", sex: "Unknown", reproductiveStatus: "Unknown" });
  const [selectedPetId, setSelectedPetId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);
  const [copyingScreenshot, setCopyingScreenshot] = useState(false);
  const [screenshotMessage, setScreenshotMessage] = useState<string | null>(null);

  const selectedPet = profile?.pets.find((pet) => pet.id === selectedPetId);
  const selectedService = services.find((service) => service.id === serviceId);
  const selectedClinic = clinics.find((clinic) => clinic.id === clinicId);
  const visibleServices = useMemo(() => services.filter((service) => (servicesByGroup[serviceGroup] ?? []).includes(service.sku)), [services, serviceGroup]);
  const eligibleServices = useMemo(() => visibleServices.filter((service) => {
    if (!selectedPet) return false;
    if (service.sku === "GROOM-LONG") return selectedPet.coatType === "Long";
    if (service.sku === "GROOM-SHORT") return selectedPet.coatType === "Short";
    return true;
  }), [visibleServices, selectedPet]);

  const search = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setLoading(true); setError(null); setNotice(null); setCustomers([]); setProfile(null);
    if (phone.replace(/\D/g, "").length < 7) { setError("Enter at least 7 digits of the customer’s phone number."); setLoading(false); return; }
    try { setCustomers(await api<Customer[]>(`/customers/search?phone=${encodeURIComponent(phone)}`)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Customer search failed."); }
    finally { setLoading(false); }
  };

  const openCustomer = async (customer: Customer) => {
    setLoading(true); setError(null);
    try {
      const [nextProfile, clinicRows] = await Promise.all([api<Profile>(`/customers/${customer.id}/profile`), api<Clinic[]>("/catalog/clinics")]);
      setProfile(nextProfile); setClinics(clinicRows); setSelectedPetId(""); setClinicId(clinicRows[0]?.id ?? ""); setServiceGroup(""); setServiceId(""); setSlot("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not open the customer profile."); }
    finally { setLoading(false); }
  };

  const createCustomer = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setError(null);
    try {
      const customer = await api<Customer>("/customers", { method: "POST", body: JSON.stringify({ name: newCustomer.name, phone, ...(newCustomer.email ? { email: newCustomer.email } : {}) }) });
      const [nextProfile, clinicRows] = await Promise.all([api<Profile>(`/customers/${customer.id}/profile`), api<Clinic[]>("/catalog/clinics")]);
      setProfile(nextProfile); setClinics(clinicRows); setClinicId(clinicRows[0]?.id ?? ""); setNotice("Customer profile created. Add their pet to continue.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not create the customer."); }
    finally { setSaving(false); }
  };

  const updateSpecies = (species: string) => {
    const first = breedCatalog[species]?.[0];
    setPetDraft((current) => ({ ...current, species, breed: "", size: first?.size ?? "Medium", coatType: first?.coatType ?? "Short" }));
  };
  const updateBreed = (breed: string) => {
    const definition = breedCatalog[petDraft.species]?.find((entry) => entry.name === breed);
    setPetDraft((current) => ({ ...current, breed, ...(definition?.name === "Mixed / Unknown" ? {} : { size: definition?.size ?? current.size, coatType: definition?.coatType ?? current.coatType }) }));
  };

  const addPet = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!profile) return;
    setSaving(true); setError(null);
    try {
      const pet = await api<Pet>(`/customers/${profile.customer.id}/pets`, { method: "POST", body: JSON.stringify({ ...petDraft, ...(petDraft.birthDate ? { birthDate: new Date(`${petDraft.birthDate}T12:00:00`).toISOString() } : {}) }) });
      setProfile((current) => current ? { ...current, pets: [...current.pets, { ...pet, age: pet.birthDate ? `${Math.max(0, new Date().getFullYear() - new Date(pet.birthDate).getFullYear())} years old` : null, status: "active", vaccinationStatus: "Not recorded" }] } : current);
      setSelectedPetId(pet.id); setPetFormOpen(false); setPetDraft({ name: "", species: "Dog", breed: "", size: "Medium", coatType: "Short", birthDate: "", sex: "Unknown", reproductiveStatus: "Unknown" }); setNotice("Pet profile saved.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save the pet."); }
    finally { setSaving(false); }
  };

  useEffect(() => {
    let active = true;
    if (!clinicId) { setServices([]); return; }
    void api<Service[]>(`/catalog/services?clinicId=${encodeURIComponent(clinicId)}`).then((rows) => { if (active) setServices(rows); }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Could not load clinic services."); });
    return () => { active = false; };
  }, [clinicId]);

  useEffect(() => {
    let active = true;
    setSlots([]); setSlot("");
    if (!clinicId || !serviceId || !date) return;
    void api<{ durationMinutes: number; slots: Slot[] }>(`/bookings/availability?clinicId=${encodeURIComponent(clinicId)}&serviceId=${encodeURIComponent(serviceId)}&date=${encodeURIComponent(date)}`).then((result) => { if (active) setSlots(result.slots); }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Could not load available times."); });
    return () => { active = false; };
  }, [clinicId, serviceId, date]);

  useEffect(() => {
    if (!confirmation) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setConfirmation(null);
        setNotice(`Booking ${confirmation.reference} confirmed for ${confirmation.pet.name}.`);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [confirmation]);

  const confirmBooking = async () => {
    if (!profile || !selectedPet || !selectedClinic || !selectedService || !slot) return;
    setSaving(true); setError(null); setNotice(null);
    try {
      const booking = await api<{ id: string; reference: string; startsAt: string; endsAt: string }>("/bookings", { method: "POST", body: JSON.stringify({ customerId: profile.customer.id, petId: selectedPet.id, clinicId, serviceId, startsAt: slot, notes }) });
      setConfirmation({ reference: booking.reference, startsAt: booking.startsAt, endsAt: booking.endsAt, service: selectedService.name, clinic: selectedClinic.name, notes, pet: selectedPet, customer: profile.customer, veterinarian: "Unassigned" });
      setScreenshotMessage(null);
      setNotice(null); setSlot("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The booking could not be confirmed."); }
    finally { setSaving(false); }
  };

  const clearCustomer = () => { setProfile(null); setCustomers([]); setSelectedPetId(""); setError(null); setNotice(null); };

  const copyScreenshot = async () => {
    if (!confirmation) return;
    setCopyingScreenshot(true);
    try {
      const image = await makeBookingScreenshot(confirmation);
      if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": image })]);
        setScreenshotMessage("Screenshot copied. Paste it into the ticket.");
      } else {
        const url = URL.createObjectURL(image);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${confirmation.reference}-booking.png`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        setScreenshotMessage("Image copying is unavailable here, so the screenshot was downloaded.");
      }
    } catch (caught) {
      setScreenshotMessage(caught instanceof Error ? caught.message : "The booking screenshot could not be copied.");
    } finally {
      setCopyingScreenshot(false);
    }
  };

  return <div className="space-y-6">
    <PageHeader eyebrow="Pawcare" title="Booking" description="Find a customer by phone, select their pet and service, then book an available clinic slot." />
    {error && <p role="alert" className="rounded-lg border border-error-border bg-error-soft p-3 text-sm text-error">{error}</p>}
    {notice && <p role="status" className="rounded-lg border border-info-border bg-info-soft p-3 text-sm text-info">{notice}</p>}

    {!profile ? <>
      <Card className="p-5 sm:p-6"><h2 className="flex items-center gap-2 text-base font-semibold text-primary"><Search size={18} className="text-brand" />Find a customer</h2>
        <form onSubmit={(event) => void search(event)} className="mt-4 flex flex-col gap-3 sm:flex-row"><label className="relative flex-1"><span className="sr-only">Customer phone number</span><Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input required type="tel" value={phone} onChange={(event) => setPhone(event.target.value.replace(/[^\d+]/g, ""))} placeholder="Enter customer phone number" className={`${inputClass} mt-0 pl-10`} /></label><Button type="submit" disabled={loading} icon={<Search size={15} />}>{loading ? "Searching…" : "Search"}</Button></form>
      </Card>
      {customers.length > 0 && <Card className="overflow-hidden"><div className="border-b border-default px-5 py-4"><h2 className="font-semibold text-primary">Matching customer profiles</h2></div><div className="divide-y divide-default">{customers.map((customer) => <button key={customer.id} type="button" onClick={() => void openCustomer(customer)} className="flex min-h-16 w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-hover"><span><span className="block font-medium text-primary">{customer.name}</span><span className="text-xs text-muted">{customer.phone}{customer.email ? ` · ${customer.email}` : ""}</span></span><span className="text-sm font-semibold text-brand">Open profile →</span></button>)}</div></Card>}
      {customers.length === 0 && !loading && phone.replace(/\D/g, "").length >= 7 && <Card className="p-5 sm:p-6"><h2 className="flex items-center gap-2 text-base font-semibold text-primary"><UserRound size={18} className="text-brand" />Create customer profile</h2><p className="mt-1 text-sm text-secondary">No matching profile found for {phone}.</p><form onSubmit={(event) => void createCustomer(event)} className="mt-4 grid gap-3 sm:grid-cols-2"><label className={labelClass}>Customer name<input required minLength={2} value={newCustomer.name} onChange={(event) => setNewCustomer({ ...newCustomer, name: event.target.value })} className={inputClass} /></label><label className={labelClass}>Email (optional)<input type="email" value={newCustomer.email} onChange={(event) => setNewCustomer({ ...newCustomer, email: event.target.value })} className={inputClass} /></label><div className="sm:col-span-2"><Button type="submit" disabled={saving} icon={<Plus size={15} />}>{saving ? "Creating…" : "Create profile"}</Button></div></form></Card>}
    </> : <>
      <div className="flex flex-wrap items-center justify-between gap-3"><Button variant="secondary" icon={<ArrowLeft size={15} />} onClick={clearCustomer}>Search another customer</Button><Link to="/pawcare/appointments" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-default px-3 text-sm font-medium text-secondary hover:bg-hover"><CalendarDays size={15} />Open appointments</Link></div>
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5"><div><p className="text-xs font-semibold uppercase tracking-wide text-brand">Customer profile</p><h2 className="mt-1 text-lg font-semibold text-primary">{profile.customer.name}</h2><p className="mt-1 text-sm text-secondary">{profile.customer.phone}{profile.customer.email ? ` · ${profile.customer.email}` : ""}</p></div><div className="text-sm text-secondary"><span className="font-semibold text-primary">{profile.pets.length}</span> registered pet{profile.pets.length === 1 ? "" : "s"}</div></Card>

      <section aria-labelledby="pet-heading"><div className="mb-3 flex items-center justify-between gap-3"><h2 id="pet-heading" className="flex items-center gap-2 text-base font-semibold text-primary"><PawPrint size={18} className="text-brand" />1. Select a pet</h2><Button variant="secondary" icon={<Plus size={15} />} onClick={() => setPetFormOpen((open) => !open)}>{petFormOpen ? "Close" : "Add pet"}</Button></div>
        {profile.pets.length > 0 && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{profile.pets.filter((pet) => pet.status.toLowerCase() !== "deceased").map((pet) => <button key={pet.id} type="button" onClick={() => { setSelectedPetId(pet.id); setServiceId(""); setSlot(""); }} aria-pressed={selectedPetId === pet.id} className={`rounded-xl border p-4 text-left ${selectedPetId === pet.id ? "border-brand bg-brand-soft" : "border-default bg-surface hover:bg-hover"}`}><div className="flex items-center justify-between"><PawPrint size={18} className="text-brand" />{selectedPetId === pet.id && <Check size={17} className="text-brand" />}</div><p className="mt-3 font-semibold text-primary">{pet.name}</p><p className="mt-1 text-sm text-secondary">{pet.species} · {pet.breed ?? "Breed not recorded"}</p><p className="mt-1 text-xs text-muted">{pet.size ?? "Size unknown"} · {pet.coatType ?? "Coat unknown"} coat · {pet.age ?? "Age not recorded"}</p></button>)}</div>}
        {profile.pets.length === 0 && !petFormOpen && <Card className="p-5 text-sm text-secondary">This customer has no pets yet. Add a pet to continue with the booking.</Card>}
        {petFormOpen && <Card className="mt-3 p-5"><h3 className="font-semibold text-primary">Register a pet</h3><form onSubmit={(event) => void addPet(event)} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className={labelClass}>Pet name<input required value={petDraft.name} onChange={(event) => setPetDraft({ ...petDraft, name: event.target.value })} className={inputClass} /></label>
          <label className={labelClass}>Species<select value={petDraft.species} onChange={(event) => updateSpecies(event.target.value)} className={inputClass}><option>Dog</option><option>Cat</option></select></label>
          <label className={labelClass}>Breed<select required value={petDraft.breed} onChange={(event) => updateBreed(event.target.value)} className={inputClass}><option value="">Choose breed</option>{breedCatalog[petDraft.species]?.map((breed) => <option key={breed.name}>{breed.name}</option>)}</select></label>
          <label className={labelClass}>Size<select value={petDraft.size} disabled={petDraft.breed !== "Mixed / Unknown"} onChange={(event) => setPetDraft({ ...petDraft, size: event.target.value as Size })} className={inputClass}>{["Small", "Medium", "Large", "Giant"].map((size) => <option key={size}>{size}</option>)}</select></label>
          <label className={labelClass}>Coat type<select value={petDraft.coatType} disabled={petDraft.breed !== "Mixed / Unknown"} onChange={(event) => setPetDraft({ ...petDraft, coatType: event.target.value as Coat })} className={inputClass}><option>Short</option><option>Long</option><option>Unknown</option></select></label>
          <label className={labelClass}>Date of birth<input type="date" value={petDraft.birthDate} onChange={(event) => setPetDraft({ ...petDraft, birthDate: event.target.value })} className={inputClass} /></label>
          <label className={labelClass}>Sex<select value={petDraft.sex} onChange={(event) => setPetDraft({ ...petDraft, sex: event.target.value })} className={inputClass}><option>Unknown</option><option>Female</option><option>Male</option></select></label>
          <label className={labelClass}>Reproductive status<select value={petDraft.reproductiveStatus} onChange={(event) => setPetDraft({ ...petDraft, reproductiveStatus: event.target.value })} className={inputClass}><option>Unknown</option><option>Intact</option><option>Spayed / Neutered</option></select></label>
          <div className="flex items-end"><Button type="submit" disabled={saving || !petDraft.breed}>{saving ? "Saving…" : "Save pet"}</Button></div>
        </form></Card>}
      </section>

      {selectedPet && <section aria-labelledby="service-heading"><h2 id="service-heading" className="mb-3 text-base font-semibold text-primary">2. Choose service</h2><div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]"><Card className="p-2"><div className="grid gap-1">{Object.keys(servicesByGroup).map((group) => <button key={group} type="button" onClick={() => { setServiceGroup(group); setServiceId(""); setSlot(""); }} className={`min-h-10 rounded-lg px-3 text-left text-sm font-medium ${serviceGroup === group ? "bg-brand-soft text-brand-strong" : "text-secondary hover:bg-hover"}`}>{group}</button>)}</div></Card><div className="grid gap-3 sm:grid-cols-2">{eligibleServices.map((service) => <button key={service.id} type="button" aria-pressed={serviceId === service.id} onClick={() => { setServiceId(service.id); setSlot(""); }} className={`rounded-xl border p-4 text-left ${serviceId === service.id ? "border-brand bg-brand-soft" : "border-default bg-surface hover:bg-hover"}`}><span className="flex items-center justify-between gap-3"><span className="font-semibold text-primary">{service.name}</span>{serviceId === service.id && <Check size={16} className="text-brand" />}</span><span className="mt-2 flex items-center gap-1.5 text-xs text-secondary"><Clock3 size={13} />{service.durationMinutes} minutes</span></button>)}{serviceGroup && eligibleServices.length === 0 && <Card className="p-4 text-sm text-secondary">{serviceGroup === "Grooming" && selectedPet.coatType === "Unknown" ? "Set this pet’s coat type before choosing a coat-specific grooming routine." : "No services from this group are available at the selected clinic."}</Card>}</div></div></section>}

      {selectedService && <section aria-labelledby="slot-heading"><h2 id="slot-heading" className="mb-3 text-base font-semibold text-primary">3. Choose clinic and available slot</h2><Card className="p-5"><div className="grid gap-3 sm:grid-cols-2"><label className={labelClass}>Clinic<select value={clinicId} onChange={(event) => { setClinicId(event.target.value); setServiceId(""); setSlot(""); }} className={inputClass}>{clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}</select></label><label className={labelClass}>Date<input type="date" min={localDateKey(new Date())} value={date} onChange={(event) => setDate(event.target.value)} className={inputClass} /></label></div><p className="mt-4 text-sm text-secondary">{selectedClinic?.name} · {selectedService.durationMinutes} minutes · Slots shown 9:00 AM–6:00 PM</p><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">{slots.map((available) => <button key={available.startsAt} type="button" aria-pressed={slot === available.startsAt} onClick={() => setSlot(available.startsAt)} className={`min-h-10 rounded-lg border px-2 text-sm font-medium ${slot === available.startsAt ? "border-brand bg-brand text-on-brand" : "border-default text-secondary hover:bg-hover"}`}>{timeLabel(available.startsAt)}</button>)}</div>{slots.length === 0 && <p className="mt-3 text-sm text-muted">No available slots for this date. Try another date or service.</p>}</Card></section>}

      {selectedPet && selectedService && slot && <section aria-labelledby="confirm-heading"><h2 id="confirm-heading" className="mb-3 text-base font-semibold text-primary">4. Review and confirm</h2><Card className="p-5"><dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-muted">Customer</dt><dd className="mt-1 font-medium text-primary">{profile.customer.name} · {profile.customer.phone}</dd></div><div><dt className="text-xs text-muted">Pet</dt><dd className="mt-1 font-medium text-primary">{selectedPet.name} · {selectedPet.species} ({selectedPet.breed})</dd></div><div><dt className="text-xs text-muted">Service</dt><dd className="mt-1 font-medium text-primary">{selectedService.name} · {selectedService.durationMinutes} minutes</dd></div><div><dt className="text-xs text-muted">Clinic and time</dt><dd className="mt-1 font-medium text-primary">{selectedClinic?.name} · {new Date(slot).toLocaleString()}</dd></div></dl><label className={`${labelClass} mt-4 block`}>Notes (optional)<textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1.5 w-full rounded-lg border border-input bg-input px-3 py-2 text-sm" /></label><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted">The selected slot is checked again before the booking is saved.</p><Button disabled={saving} onClick={() => void confirmBooking()} icon={<CalendarDays size={15} />}>{saving ? "Booking…" : "Confirm booking"}</Button></div></Card></section>}
    </>}
    {confirmation && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) { setConfirmation(null); setNotice(`Booking ${confirmation.reference} confirmed for ${confirmation.pet.name}.`); } }}>
      <section role="dialog" aria-modal="true" aria-labelledby="booking-success-title" className="w-full max-w-[430px] overflow-hidden rounded-xl border border-[#303650] bg-[#1b203e] p-3 text-[#c8cce0] shadow-2xl">
        <div className="flex items-center gap-2.5"><CheckCircle2 size={18} className="shrink-0 text-[#16c784]" /><h2 id="booking-success-title" className="flex-1 text-sm font-bold text-[#e0e3f0]">Appointment Booked Successfully!</h2><button type="button" aria-label="Close booking confirmation" onClick={() => { setConfirmation(null); setNotice(`Booking ${confirmation.reference} confirmed for ${confirmation.pet.name}.`); }} className="rounded p-1 text-[#aeb5cc] hover:bg-white/10"><X size={17} /></button></div>
        <p className="mt-5 text-[11px] font-semibold text-[#aeb5cc]">Appointment ID</p><p className="mt-1 text-xs font-bold">{confirmation.reference}</p>
        <div className="my-2.5 border-t border-[#414761]" />
        <ReceiptSection title="Appointment Details" rows={[["Date", new Date(confirmation.startsAt).toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })], ["Time", `${timeLabel(confirmation.startsAt)} - ${timeLabel(confirmation.endsAt)}`], ["Type", confirmation.service], ["Staff", confirmation.veterinarian], ["Clinic", confirmation.clinic], ["Remarks", confirmation.notes || confirmation.service]]} />
        <ReceiptSection title="Pet Information" rows={[["Name", confirmation.pet.name], ["Species", confirmation.pet.species], ["Breed", confirmation.pet.breed ?? "Not recorded"], ["Gender", confirmation.pet.sex ?? "Unknown"]]} />
        <ReceiptSection title="Owner Information" rows={[["Name", confirmation.customer.name], ["Phone", confirmation.customer.phone], ["Email", confirmation.customer.email ?? "Not provided"]]} />
        <div className="border-b border-[#414761] pb-2"><p className="mb-2 text-[11px] font-bold text-[#aeb5cc]">Veterinarian</p><p className="text-xs font-semibold">{confirmation.veterinarian}</p></div>
        {screenshotMessage && <p role="status" className="mt-2 text-xs text-[#aeb5cc]">{screenshotMessage}</p>}
        <div className="mt-3 grid grid-cols-2 gap-2"><Button variant="secondary" className="border-[#414761] bg-transparent text-[#e0e3f0] hover:bg-white/10" onClick={() => void copyScreenshot()} disabled={copyingScreenshot} icon={<Copy size={14} />}>{copyingScreenshot ? "Copying…" : "Copy screenshot"}</Button><Button className="bg-[#2855f5] text-white hover:bg-[#1948e8]" onClick={() => { setConfirmation(null); setNotice(`Booking ${confirmation.reference} confirmed for ${confirmation.pet.name}.`); }}>Close</Button></div>
      </section>
    </div>}
  </div>;
}

function ReceiptSection({ title, rows }: { title: string; rows: [string, string][] }) {
  return <div className="border-b border-[#414761] py-2"><p className="mb-1.5 text-[11px] font-bold text-[#aeb5cc]">{title}</p><dl className="space-y-1">{rows.map(([label, value]) => <div key={label} className="flex items-start justify-between gap-3 text-[10px] leading-4"><dt className="shrink-0 font-medium text-[#aeb5cc]">{label}:</dt><dd className="min-w-0 text-right font-semibold text-[#c8cce0]">{value}</dd></div>)}</dl></div>;
}
