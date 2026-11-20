import { Building2, Check, CircleDollarSign, Plus, Search, Tag, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/ui/Button";

interface Clinic { id: string; code: string; name: string; address: string; timezone: string; phone: string | null; email: string | null; active: boolean }
interface ClinicServiceConfig { active: boolean; price: string | null; durationMinutes: number | null }
interface Service { id: string; sku: string; name: string; description: string; category: string; durationMinutes: number; basePrice: string; active: boolean; clinicSettings: Record<string, ClinicServiceConfig> }
interface Offer { id: string; code: string; name: string; description: string; discountType: "percent" | "amount"; discountValue: string; minimumSubtotal: string; clinicId: string | null; clinicName: string | null; startsAt: string | null; endsAt: string | null; active: boolean }
interface ApiEnvelope<T> { data: T; error?: { message?: string } }
type ConfigSection = "clinics" | "services" | "offers";
type ClinicDraft = Omit<Clinic, "id" | "code"> & { id: string; code: string; reason: string };
type ServiceDraft = { id: string | null; sku: string; name: string; description: string; category: string; durationMinutes: string; basePrice: string; active: boolean; clinicSettings: Record<string, ClinicServiceConfig>; reason: string };
type OfferDraft = { id: string | null; code: string; name: string; description: string; discountType: "percent" | "amount"; discountValue: string; minimumSubtotal: string; clinicId: string; startsAt: string; endsAt: string; active: boolean; reason: string };

const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api";
const inputClass = "mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm text-primary";
const labelClass = "text-sm font-medium text-primary";
const currency = (value: string | number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value) || 0);

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, { ...init, credentials: "include", headers: { "content-type": "application/json", ...init?.headers } });
  const body = await response.json().catch(() => null) as ApiEnvelope<T> | null;
  if (!response.ok) throw new Error(body?.error?.message ?? "Could not save configuration.");
  return body?.data as T;
}

function localDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function newServiceDraft(clinics: Clinic[]): ServiceDraft {
  return { id: null, sku: "", name: "", description: "", category: "", durationMinutes: "60", basePrice: "0", active: true, clinicSettings: Object.fromEntries(clinics.map((clinic) => [clinic.id, { active: false, price: null, durationMinutes: null }])), reason: "" };
}

function newOfferDraft(): OfferDraft {
  return { id: null, code: "", name: "", description: "", discountType: "percent", discountValue: "10", minimumSubtotal: "0", clinicId: "", startsAt: "", endsAt: "", active: true, reason: "" };
}

export function AdminConfigurationPanel() {
  const [section, setSection] = useState<ConfigSection>("clinics");
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [clinicDraft, setClinicDraft] = useState<ClinicDraft | null>(null);
  const [serviceDraft, setServiceDraft] = useState<ServiceDraft | null>(null);
  const [offerDraft, setOfferDraft] = useState<OfferDraft | null>(null);
  const [serviceQuery, setServiceQuery] = useState("");
  const [clinicQuery, setClinicQuery] = useState("");
  const [offerQuery, setOfferQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [clinicRows, catalog, offerRows] = await Promise.all([
        api<Clinic[]>("/admin/clinics"),
        api<{ services: Service[] }>("/admin/configuration/catalog"),
        api<Offer[]>("/admin/configuration/offers"),
      ]);
      setClinics(clinicRows); setServices(catalog.services); setOffers(offerRows);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load configuration."); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const visibleClinics = useMemo(() => clinics.filter((clinic) => !clinicQuery.trim() || `${clinic.name} ${clinic.code} ${clinic.address}`.toLowerCase().includes(clinicQuery.trim().toLowerCase())), [clinicQuery, clinics]);
  const visibleServices = useMemo(() => services.filter((service) => !serviceQuery.trim() || `${service.name} ${service.category} ${service.sku}`.toLowerCase().includes(serviceQuery.trim().toLowerCase())), [serviceQuery, services]);
  const visibleOffers = useMemo(() => offers.filter((offer) => !offerQuery.trim() || `${offer.name} ${offer.code} ${offer.clinicName ?? "all clinics"}`.toLowerCase().includes(offerQuery.trim().toLowerCase())), [offerQuery, offers]);

  const editClinic = (clinic: Clinic) => {
    setClinicDraft({ ...clinic, address: clinic.address ?? "", timezone: clinic.timezone || "Asia/Calcutta", phone: clinic.phone ?? "", email: clinic.email ?? "", reason: "" });
    setServiceDraft(null); setOfferDraft(null); setError(null); setSuccess(null);
  };

  const saveClinic = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!clinicDraft) return;
    setSaving(true); setError(null); setSuccess(null);
    try {
      const { id, code: _code, reason, ...changes } = clinicDraft;
      await api(`/admin/configuration/clinics/${id}`, { method: "PUT", body: JSON.stringify({ ...changes, phone: changes.phone || null, email: changes.email || null, reason }) });
      await load(); setSuccess("Clinic settings saved."); setClinicDraft(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save clinic settings."); }
    finally { setSaving(false); }
  };

  const editService = (service: Service) => {
    setServiceDraft({ id: service.id, sku: service.sku, name: service.name, description: service.description ?? "", category: service.category, durationMinutes: String(service.durationMinutes), basePrice: String(service.basePrice), active: service.active, clinicSettings: Object.fromEntries(clinics.map((clinic) => [clinic.id, service.clinicSettings[clinic.id] ?? { active: false, price: null, durationMinutes: null }])), reason: "" });
    setClinicDraft(null); setOfferDraft(null); setError(null); setSuccess(null);
  };

  const saveService = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!serviceDraft) return;
    setSaving(true); setError(null); setSuccess(null);
    try {
      const { id, reason, ...draft } = serviceDraft;
      const payload = { ...draft, durationMinutes: Number(draft.durationMinutes), basePrice: Number(draft.basePrice), clinicSettings: Object.fromEntries(Object.entries(draft.clinicSettings).map(([clinicId, setting]) => [clinicId, { active: setting.active, price: setting.price === null || setting.price === "" ? null : Number(setting.price), durationMinutes: setting.durationMinutes === null || Number.isNaN(Number(setting.durationMinutes)) ? null : Number(setting.durationMinutes) }])), reason };
      await api(id ? `/admin/configuration/services/${id}` : "/admin/configuration/services", { method: id ? "PUT" : "POST", body: JSON.stringify(payload) });
      await load(); setSuccess(id ? "Service settings saved." : "Service created."); setServiceDraft(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save service settings."); }
    finally { setSaving(false); }
  };

  const editOffer = (offer: Offer) => {
    setOfferDraft({ id: offer.id, code: offer.code, name: offer.name, description: offer.description, discountType: offer.discountType, discountValue: String(offer.discountValue), minimumSubtotal: String(offer.minimumSubtotal), clinicId: offer.clinicId ?? "", startsAt: localDateTime(offer.startsAt), endsAt: localDateTime(offer.endsAt), active: offer.active, reason: "" });
    setClinicDraft(null); setServiceDraft(null); setError(null); setSuccess(null);
  };

  const saveOffer = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!offerDraft) return;
    setSaving(true); setError(null); setSuccess(null);
    try {
      const { id, reason, ...draft } = offerDraft;
      const payload = { ...draft, code: draft.code.trim().toUpperCase(), discountValue: Number(draft.discountValue), minimumSubtotal: Number(draft.minimumSubtotal), clinicId: draft.clinicId || null, startsAt: draft.startsAt ? new Date(draft.startsAt).toISOString() : null, endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : null, reason };
      await api(id ? `/admin/configuration/offers/${id}` : "/admin/configuration/offers", { method: id ? "PUT" : "POST", body: JSON.stringify(payload) });
      await load(); setSuccess(id ? "Offer saved." : "Offer created."); setOfferDraft(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save offer."); }
    finally { setSaving(false); }
  };

  const setClinicServiceSetting = (clinicId: string, changes: Partial<ClinicServiceConfig>) => {
    if (!serviceDraft) return;
    const current = serviceDraft.clinicSettings[clinicId] ?? { active: false, price: null, durationMinutes: null };
    setServiceDraft({ ...serviceDraft, clinicSettings: { ...serviceDraft.clinicSettings, [clinicId]: { ...current, ...changes } } });
  };

  const sections: { key: ConfigSection; label: string; description: string; count: number; icon: typeof Building2 }[] = [
    { key: "clinics", label: "Clinics", description: "Details and availability", count: clinics.length, icon: Building2 },
    { key: "services", label: "Services", description: "Catalog and clinic pricing", count: services.length, icon: CircleDollarSign },
    { key: "offers", label: "Offers", description: "Codes, discounts, validity", count: offers.length, icon: Tag },
  ];

  return <div className="space-y-5 p-4 sm:p-6">
    <div><p className="text-xs font-semibold uppercase tracking-wide text-brand">Configure</p><h2 className="mt-1 text-xl font-semibold text-primary">Business setup</h2><p className="mt-1 max-w-2xl text-sm text-secondary">Each area has its own list and edit flow. Changes are saved and added to the admin audit history.</p></div>
    <div className="grid gap-2 md:grid-cols-3" role="tablist" aria-label="Configuration areas">
      {sections.map(({ key, label, description, count, icon: Icon }) => <button key={key} type="button" role="tab" aria-selected={section === key} onClick={() => { setSection(key); setError(null); setSuccess(null); }} className={`flex min-h-[76px] items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-focus ${section === key ? "border-brand/40 bg-brand-soft" : "border-default bg-surface hover:bg-subtle"}`}>
        <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${section === key ? "bg-brand text-on-brand" : "bg-subtle text-secondary"}`}><Icon size={18} /></span><span className="min-w-0 flex-1"><span className="block font-semibold text-primary">{label}</span><span className="mt-0.5 block text-xs text-muted">{description}</span></span><span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-secondary">{count}</span>
      </button>)}
    </div>
    {error && <p role="alert" className="rounded-lg border border-error-border bg-error-soft p-3 text-sm text-error">{error}</p>}
    {success && <p role="status" className="flex items-center gap-2 rounded-lg border border-success/30 bg-success-soft p-3 text-sm text-success"><Check size={16} />{success}</p>}
    {loading ? <p className="rounded-xl border border-default p-8 text-center text-sm text-muted">Loading configuration…</p> : section === "clinics" ? <div className="grid gap-5 xl:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.5fr)]">
      <section className="min-w-0"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-primary">Clinic locations</h3><p className="text-xs text-muted">{clinics.filter((clinic) => clinic.active).length} active of {clinics.length}</p></div><label className="relative block w-full max-w-xs"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input aria-label="Search clinics" value={clinicQuery} onChange={(event) => setClinicQuery(event.target.value)} placeholder="Search clinics" className="min-h-10 w-full rounded-lg border border-input bg-input pl-9 pr-3 text-sm" /></label></div>
        <div className="divide-y divide-default overflow-hidden rounded-xl border border-default">{visibleClinics.length ? visibleClinics.map((clinic) => <button type="button" key={clinic.id} aria-pressed={clinicDraft?.id === clinic.id} onClick={() => editClinic(clinic)} className={`flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-subtle ${clinicDraft?.id === clinic.id ? "bg-brand-soft" : "bg-surface"}`}><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-primary">{clinic.name}</span><span className="mt-0.5 block text-xs text-muted">{clinic.code} · {clinic.address || "Address not set"}</span></span><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${clinic.active ? "bg-success-soft text-success" : "bg-subtle text-muted"}`}>{clinic.active ? "Active" : "Inactive"}</span></button>) : <p className="p-6 text-center text-sm text-muted">No matching clinics.</p>}</div>
      </section>
      <section className="min-w-0 rounded-xl border border-default bg-subtle/30 p-4 sm:p-5">{clinicDraft ? <form onSubmit={(event) => void saveClinic(event)} className="space-y-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-brand">{clinicDraft.code}</p><h3 className="mt-1 text-lg font-semibold text-primary">Edit clinic</h3></div><button type="button" onClick={() => setClinicDraft(null)} aria-label="Close clinic editor" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface hover:text-primary"><X size={17} /></button></div><div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>Clinic name<input required minLength={2} maxLength={160} value={clinicDraft.name} onChange={(event) => setClinicDraft({ ...clinicDraft, name: event.target.value })} className={inputClass} /></label><label className={labelClass}>Timezone<input required minLength={3} maxLength={80} value={clinicDraft.timezone} onChange={(event) => setClinicDraft({ ...clinicDraft, timezone: event.target.value })} className={inputClass} placeholder="Asia/Kolkata" /></label><label className={labelClass}>Phone<input type="tel" maxLength={30} value={clinicDraft.phone ?? ""} onChange={(event) => setClinicDraft({ ...clinicDraft, phone: event.target.value })} className={inputClass} /></label><label className={labelClass}>Email<input type="email" value={clinicDraft.email ?? ""} onChange={(event) => setClinicDraft({ ...clinicDraft, email: event.target.value })} className={inputClass} /></label><label className={`${labelClass} sm:col-span-2`}>Address<textarea maxLength={1000} rows={3} value={clinicDraft.address} onChange={(event) => setClinicDraft({ ...clinicDraft, address: event.target.value })} className={`${inputClass} py-2`} /></label><label className="flex min-h-10 items-center gap-2 text-sm text-primary sm:col-span-2"><input type="checkbox" checked={clinicDraft.active} onChange={(event) => setClinicDraft({ ...clinicDraft, active: event.target.checked })} />Clinic is active and bookable</label><label className={`${labelClass} sm:col-span-2`}>Reason for change<input required minLength={3} maxLength={1000} value={clinicDraft.reason} onChange={(event) => setClinicDraft({ ...clinicDraft, reason: event.target.value })} placeholder="Why are these clinic settings changing?" className={inputClass} /></label></div><div className="flex justify-end"><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save clinic"}</Button></div></form> : <div className="grid min-h-[260px] place-items-center text-center"><div><Building2 className="mx-auto text-muted" size={26} /><p className="mt-3 font-semibold text-primary">Select a clinic to configure</p><p className="mt-1 text-sm text-muted">Clinic details and status will appear here.</p></div></div>}</section>
    </div> : section === "services" ? <div className="grid gap-5 xl:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.5fr)]">
      <section className="min-w-0"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-primary">Service catalog</h3><p className="text-xs text-muted">{services.length} configured services</p></div><Button onClick={() => { setServiceDraft(newServiceDraft(clinics)); setClinicDraft(null); setOfferDraft(null); setError(null); setSuccess(null); }} icon={<Plus size={15} />}>New service</Button></div><label className="relative mb-3 block"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input aria-label="Search services" value={serviceQuery} onChange={(event) => setServiceQuery(event.target.value)} placeholder="Search name, category, or SKU" className="min-h-10 w-full rounded-lg border border-input bg-input pl-9 pr-3 text-sm" /></label><div className="divide-y divide-default overflow-hidden rounded-xl border border-default">{visibleServices.length ? visibleServices.map((service) => <button type="button" key={service.id} aria-pressed={serviceDraft?.id === service.id} onClick={() => editService(service)} className={`flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-subtle ${serviceDraft?.id === service.id ? "bg-brand-soft" : "bg-surface"}`}><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-primary">{service.name}</span><span className="mt-0.5 block text-xs text-muted">{service.sku} · {service.category} · {currency(service.basePrice)}</span></span><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${service.active ? "bg-success-soft text-success" : "bg-subtle text-muted"}`}>{service.active ? "Active" : "Inactive"}</span></button>) : <p className="p-6 text-center text-sm text-muted">No matching services. Create the first one.</p>}</div></section>
      <section className="min-w-0 rounded-xl border border-default bg-subtle/30 p-4 sm:p-5">{serviceDraft ? <form onSubmit={(event) => void saveService(event)} className="space-y-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-brand">{serviceDraft.id ? serviceDraft.sku : "New service"}</p><h3 className="mt-1 text-lg font-semibold text-primary">{serviceDraft.id ? "Edit service" : "Create service"}</h3></div><button type="button" onClick={() => setServiceDraft(null)} aria-label="Close service editor" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface hover:text-primary"><X size={17} /></button></div><div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>Service code<input required minLength={2} maxLength={80} disabled={Boolean(serviceDraft.id)} value={serviceDraft.sku} onChange={(event) => setServiceDraft({ ...serviceDraft, sku: event.target.value.toUpperCase() })} className={`${inputClass} disabled:opacity-60`} /></label><label className={labelClass}>Service name<input required minLength={2} maxLength={200} value={serviceDraft.name} onChange={(event) => setServiceDraft({ ...serviceDraft, name: event.target.value })} className={inputClass} /></label><label className={labelClass}>Category<input required minLength={2} maxLength={80} value={serviceDraft.category} onChange={(event) => setServiceDraft({ ...serviceDraft, category: event.target.value })} className={inputClass} /></label><label className={labelClass}>Default duration (minutes)<input required type="number" min={1} max={1440} value={serviceDraft.durationMinutes} onChange={(event) => setServiceDraft({ ...serviceDraft, durationMinutes: event.target.value })} className={inputClass} /></label><label className={labelClass}>Default price<input required type="number" min={0} max={1000000} step="0.01" value={serviceDraft.basePrice} onChange={(event) => setServiceDraft({ ...serviceDraft, basePrice: event.target.value })} className={inputClass} /></label><label className="flex min-h-11 items-end gap-2 pb-2 text-sm text-primary"><input type="checkbox" checked={serviceDraft.active} onChange={(event) => setServiceDraft({ ...serviceDraft, active: event.target.checked })} />Service active</label><label className={`${labelClass} sm:col-span-2`}>Description<textarea maxLength={2000} rows={2} value={serviceDraft.description} onChange={(event) => setServiceDraft({ ...serviceDraft, description: event.target.value })} className={`${inputClass} py-2`} /></label></div>
        <fieldset className="border-t border-default pt-4"><legend className="text-sm font-semibold text-primary">Clinic availability and overrides</legend><p className="mb-3 mt-1 text-xs text-muted">Turn a service on only where it is offered. Leave price or duration blank to use its default.</p><div className="space-y-2">{clinics.map((clinic) => { const setting = serviceDraft.clinicSettings[clinic.id] ?? { active: false, price: null, durationMinutes: null }; return <div key={clinic.id} className="grid gap-2 rounded-lg border border-default bg-surface p-3 sm:grid-cols-[minmax(130px,1fr)_90px_135px] sm:items-center"><label className={`flex items-center gap-2 text-sm font-medium ${clinic.active ? "text-primary" : "text-muted"}`}><input type="checkbox" checked={setting.active} disabled={!clinic.active && !setting.active} onChange={(event) => setClinicServiceSetting(clinic.id, { active: event.target.checked })} />{clinic.name}{clinic.active ? "" : " · inactive"}</label><label className="text-[11px] text-muted">Price override<input type="number" min={0} step="0.01" value={setting.price ?? ""} onChange={(event) => setClinicServiceSetting(clinic.id, { price: event.target.value === "" ? null : event.target.value })} placeholder={currency(serviceDraft.basePrice)} className="mt-1 min-h-9 w-full rounded-md border border-input bg-input px-2 text-xs text-primary" /></label><label className="text-[11px] text-muted">Duration override<input type="number" min={1} max={1440} value={setting.durationMinutes ?? ""} onChange={(event) => setClinicServiceSetting(clinic.id, { durationMinutes: event.target.value === "" ? null : Number(event.target.value) })} placeholder={`${serviceDraft.durationMinutes} min`} className="mt-1 min-h-9 w-full rounded-md border border-input bg-input px-2 text-xs text-primary" /></label></div>; })}</div></fieldset>
        <label className={labelClass}>Reason for change<input required minLength={3} maxLength={1000} value={serviceDraft.reason} onChange={(event) => setServiceDraft({ ...serviceDraft, reason: event.target.value })} placeholder="Why are these service settings changing?" className={inputClass} /></label><div className="flex justify-end"><Button type="submit" disabled={saving}>{saving ? "Saving…" : serviceDraft.id ? "Save service" : "Create service"}</Button></div></form> : <div className="grid min-h-[260px] place-items-center text-center"><div><CircleDollarSign className="mx-auto text-muted" size={26} /><p className="mt-3 font-semibold text-primary">Select a service to configure</p><p className="mt-1 text-sm text-muted">Manage its base rate and clinic-specific availability.</p></div></div>}</section>
    </div> : <div className="grid gap-5 xl:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.5fr)]">
      <section className="min-w-0"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-primary">Offers and discounts</h3><p className="text-xs text-muted">{offers.filter((offer) => offer.active).length} active of {offers.length}</p></div><Button onClick={() => { setOfferDraft(newOfferDraft()); setClinicDraft(null); setServiceDraft(null); setError(null); setSuccess(null); }} icon={<Plus size={15} />}>New offer</Button></div><label className="relative mb-3 block"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input aria-label="Search offers" value={offerQuery} onChange={(event) => setOfferQuery(event.target.value)} placeholder="Search offer or code" className="min-h-10 w-full rounded-lg border border-input bg-input pl-9 pr-3 text-sm" /></label><div className="divide-y divide-default overflow-hidden rounded-xl border border-default">{visibleOffers.length ? visibleOffers.map((offer) => <button type="button" key={offer.id} aria-pressed={offerDraft?.id === offer.id} onClick={() => editOffer(offer)} className={`flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-subtle ${offerDraft?.id === offer.id ? "bg-brand-soft" : "bg-surface"}`}><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-primary">{offer.name}</span><span className="mt-0.5 block text-xs text-muted">{offer.code} · {offer.discountType === "percent" ? `${offer.discountValue}% off` : `${currency(offer.discountValue)} off`} · {offer.clinicName ?? "All clinics"}</span></span><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${offer.active ? "bg-success-soft text-success" : "bg-subtle text-muted"}`}>{offer.active ? "Active" : "Inactive"}</span></button>) : <p className="p-6 text-center text-sm text-muted">No offers yet. Create an offer to make it available in quotes.</p>}</div></section>
      <section className="min-w-0 rounded-xl border border-default bg-subtle/30 p-4 sm:p-5">{offerDraft ? <form onSubmit={(event) => void saveOffer(event)} className="space-y-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-brand">{offerDraft.id ? offerDraft.code : "Promotions"}</p><h3 className="mt-1 text-lg font-semibold text-primary">{offerDraft.id ? "Edit offer" : "Create offer"}</h3></div><button type="button" onClick={() => setOfferDraft(null)} aria-label="Close offer editor" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface hover:text-primary"><X size={17} /></button></div><div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>Offer code<input required minLength={2} maxLength={64} pattern="[A-Za-z0-9][A-Za-z0-9_-]*" value={offerDraft.code} onChange={(event) => setOfferDraft({ ...offerDraft, code: event.target.value.toUpperCase() })} className={inputClass} placeholder="WELCOME10" /></label><label className={labelClass}>Offer name<input required minLength={2} maxLength={160} value={offerDraft.name} onChange={(event) => setOfferDraft({ ...offerDraft, name: event.target.value })} className={inputClass} /></label><label className={labelClass}>Discount type<select value={offerDraft.discountType} onChange={(event) => setOfferDraft({ ...offerDraft, discountType: event.target.value as OfferDraft["discountType"] })} className={inputClass}><option value="percent">Percentage</option><option value="amount">Fixed amount (₹)</option></select></label><label className={labelClass}>Discount value<input required type="number" min="0.01" max={offerDraft.discountType === "percent" ? 100 : 1000000} step="0.01" value={offerDraft.discountValue} onChange={(event) => setOfferDraft({ ...offerDraft, discountValue: event.target.value })} className={inputClass} /></label><label className={labelClass}>Minimum quote subtotal<input required type="number" min={0} step="0.01" value={offerDraft.minimumSubtotal} onChange={(event) => setOfferDraft({ ...offerDraft, minimumSubtotal: event.target.value })} className={inputClass} /></label><label className={labelClass}>Applies at<select value={offerDraft.clinicId} onChange={(event) => setOfferDraft({ ...offerDraft, clinicId: event.target.value })} className={inputClass}><option value="">All active clinics</option>{clinics.filter((clinic) => clinic.active).map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}</select></label><label className={labelClass}>Starts at<input type="datetime-local" value={offerDraft.startsAt} onChange={(event) => setOfferDraft({ ...offerDraft, startsAt: event.target.value })} className={inputClass} /></label><label className={labelClass}>Ends at<input type="datetime-local" min={offerDraft.startsAt || undefined} value={offerDraft.endsAt} onChange={(event) => setOfferDraft({ ...offerDraft, endsAt: event.target.value })} className={inputClass} /></label><label className="flex min-h-11 items-end gap-2 pb-2 text-sm text-primary"><input type="checkbox" checked={offerDraft.active} onChange={(event) => setOfferDraft({ ...offerDraft, active: event.target.checked })} />Offer active</label><label className={`${labelClass} sm:col-span-2`}>Description<textarea maxLength={1000} rows={2} value={offerDraft.description} onChange={(event) => setOfferDraft({ ...offerDraft, description: event.target.value })} className={`${inputClass} py-2`} /></label><label className={`${labelClass} sm:col-span-2`}>Reason for change<input required minLength={3} maxLength={1000} value={offerDraft.reason} onChange={(event) => setOfferDraft({ ...offerDraft, reason: event.target.value })} placeholder="Why is this offer being created or changed?" className={inputClass} /></label></div><p className="rounded-lg bg-info-soft p-3 text-xs leading-5 text-info">Active offers within their date window appear in the quote generator when the selected clinic matches.</p><div className="flex justify-end"><Button type="submit" disabled={saving}>{saving ? "Saving…" : offerDraft.id ? "Save offer" : "Create offer"}</Button></div></form> : <div className="grid min-h-[260px] place-items-center text-center"><div><Tag className="mx-auto text-muted" size={26} /><p className="mt-3 font-semibold text-primary">Select an offer to configure</p><p className="mt-1 text-sm text-muted">Choose its code, discount, clinic, and active dates.</p></div></div>}</section>
    </div>}
  </div>;
}
