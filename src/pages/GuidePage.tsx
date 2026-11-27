import { lazy, Suspense, useMemo, useState } from "react";
import { ArrowUpRight, BadgePercent, BookOpen, Check, Clock3, Mail, Map as MapIcon, MapPin, Package, Phone, Search, Stethoscope, X } from "lucide-react";
import { Card } from "../components/ui/Card";
import guideData from "../features/guide/guide-data.json";

const ClinicMap = lazy(() => import("../features/guide/ClinicMap").then((module) => ({ default: module.ClinicMap })));

type GuideTab = "packages" | "services" | "contacts" | "locations" | "map" | "discounts";
type PackageCategory = "all" | "wellness" | "grooming";
type ServiceCategory = "consultation" | "vaccination" | "grooming";

interface WellnessItem {
  name: string;
  sku: string;
  audience: string;
  price: number;
  mrp: number;
  off: string;
  inclusions: string[];
  perk?: string;
}
interface WellnessGroup { group: string; note: string; items: WellnessItem[] }
interface GroomingItem { name: string; audience: string; price: number }
interface GroomingGroup { group: string; note: string; bestseller?: boolean; items: GroomingItem[] }
interface SubscriptionTable { group: string; savings: string; columns: string[]; rows: string[][] }
interface ConsultationPrice { name: string; price: number; tag: string; desc: string }
interface VaccinationPrice { sku: string; name: string; route: string; dose: string; presentation: string; validity: string; price: number; desc: string }
interface GroomingGuideline { icon: string; title: string; points: string[] }
interface Clinic {
  clinic: string; lat: number; lng: number; number: string; manager: string; email: string; phone: string;
  zone: string; zonalHead: string; address: string | null; hours: string;
}
interface EscalationContact { level: string; role: string; name: string; email: string; phone: string }

const wellnessGroups = guideData.WELLNESS_PACKAGES as WellnessGroup[];
const groomingGroups = guideData.GROOMING_PACKAGE_CARDS as GroomingGroup[];
const subscriptionTables = guideData.SUBSCRIPTION_TABLES as SubscriptionTable[];
const consultations = guideData.CONSULTATION_PRICES as ConsultationPrice[];
const vaccinations = guideData.VACCINATION_PRICES as VaccinationPrice[];
const groomingGuidelines = guideData.GROOMING_GUIDELINES as GroomingGuideline[];
const clinics = guideData.CLINIC_POC as Clinic[];
const escalationChain = guideData.ESCALATION_CHAIN as EscalationContact[];
const sourceUrl = "https://lokeshkrishna1705-prog.github.io/Healthcare_Offer_Sheet/";

const mainTabs: { id: GuideTab; label: string; icon: typeof Package }[] = [
  { id: "packages", label: "Packages", icon: Package },
  { id: "services", label: "Services", icon: Stethoscope },
  { id: "contacts", label: "Clinic POC", icon: Phone },
  { id: "locations", label: "Clinic Location", icon: MapPin },
  { id: "map", label: "Find a Clinic", icon: MapIcon },
  { id: "discounts", label: "Discounts", icon: BadgePercent },
];

const serviceTabs: { id: ServiceCategory; label: string }[] = [
  { id: "consultation", label: "Consultation" },
  { id: "vaccination", label: "Vaccination" },
  { id: "grooming", label: "Grooming" },
];

const rupees = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
const matches = (query: string, ...values: (string | number | undefined)[]) => {
  const normalized = query.trim().toLowerCase();
  return !normalized || values.some((value) => String(value ?? "").toLowerCase().includes(normalized));
};

function SearchBox({ value, onChange, placeholder, label, onClear }: { value: string; onChange(value: string): void; placeholder: string; label: string; onClear(): void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <label className="relative min-w-[220px] flex-1">
        <span className="sr-only">{label}</span>
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-h-10 w-full rounded-[var(--radius-control)] border border-default bg-input pl-9 pr-3 text-sm text-primary placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" />
      </label>
      {value && <button type="button" onClick={onClear} className="inline-flex min-h-10 items-center gap-1.5 rounded-[var(--radius-control)] border border-default bg-elevated px-3 text-xs font-semibold text-secondary hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"><X size={14} aria-hidden="true" />Clear</button>}
    </div>
  );
}

function PackageCard({ item }: { item: WellnessItem }) {
  return (
    <article className="flex h-full flex-col rounded-[var(--radius-md)] border border-default bg-elevated p-4 transition-colors hover:border-input-hover">
      <div className="flex items-start justify-between gap-2"><h4 className="font-semibold text-primary">{item.name}</h4><span className="shrink-0 rounded-full bg-error-soft px-2 py-1 text-[10px] font-bold text-error">{item.off}</span></div>
      <p className="mt-1 text-xs text-secondary">{item.audience}</p>
      <div className="mt-3 flex items-baseline gap-2"><span className="text-lg font-bold text-primary">{rupees(item.price)}</span><span className="text-xs text-muted line-through">{rupees(item.mrp)}</span></div>
      <p className="mt-1 text-[11px] text-muted">SKU: {item.sku}</p>
      <div className="mt-3 border-t border-default pt-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Includes</p><ul className="mt-1.5 space-y-1">{item.inclusions.map((inclusion) => <li key={inclusion} className="flex gap-2 text-xs leading-5 text-secondary"><Check size={13} className="mt-1 shrink-0 text-success" aria-hidden="true" />{inclusion}</li>)}</ul></div>
      {item.perk && <p className="mt-3 rounded-[var(--radius-sm)] bg-brand-soft px-2.5 py-2 text-xs font-medium text-brand-strong">{item.perk}</p>}
    </article>
  );
}

function WellnessPackages({ query }: { query: string }) {
  const groups = wellnessGroups.map((group) => {
    const groupMatch = matches(query, group.group, group.note);
    const items = query && !groupMatch ? group.items.filter((item) => matches(query, item.name, item.sku, item.audience, item.off, item.inclusions.join(" "), item.perk)) : group.items;
    return { ...group, items };
  }).filter((group) => group.items.length > 0);
  if (!groups.length) return <EmptyState title="No packages match" description="Try another search term or clear the search." />;
  return <div className="space-y-5">{groups.map((group) => <section key={group.group} className="space-y-3"><div><h3 className="text-base font-semibold text-primary">{group.group}</h3><p className="mt-1 text-sm text-secondary">{group.note}</p></div><div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">{group.items.map((item) => <PackageCard key={item.sku} item={item} />)}</div></section>)}</div>;
}

function GroomingPackages({ query }: { query: string }) {
  const groups = groomingGroups.map((group) => {
    const groupMatch = matches(query, group.group, group.note);
    const items = query && !groupMatch ? group.items.filter((item) => matches(query, item.name, item.audience, item.price)) : group.items;
    return { ...group, items };
  }).filter((group) => group.items.length > 0);
  const tables = subscriptionTables.filter((table) => matches(query, table.group, table.savings, table.rows.flat().join(" ")));
  if (!groups.length && !tables.length) return <EmptyState title="No packages match" description="Try another search term or clear the search." />;
  return (
    <div className="space-y-5">
      {groups.map((group) => <section key={group.group} className="space-y-3"><div className="flex items-start justify-between gap-3"><div><h3 className="text-base font-semibold text-primary">{group.group}{group.bestseller && <span className="ml-2 rounded-full bg-warning-soft px-2 py-1 align-middle text-[10px] font-semibold text-warning">Bestseller</span>}</h3><p className="mt-1 text-sm text-secondary">{group.note}</p></div></div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{group.items.map((item, index) => <div key={`${item.name}-${item.audience}-${index}`} className="flex min-h-20 items-center justify-between gap-3 rounded-[var(--radius-md)] border border-default bg-elevated p-4"><div className="min-w-0"><p className="text-sm font-semibold text-primary">{item.name}</p><p className="mt-1 text-xs text-muted">{item.audience}</p></div><span className="shrink-0 text-sm font-bold text-primary">{rupees(item.price)}</span></div>)}</div></section>)}
      {!!tables.length && <section className="space-y-3"><div><h3 className="text-base font-semibold text-primary">Grooming subscriptions</h3><p className="mt-1 text-sm text-secondary">Session bundles are available for weekday and anyday appointments.</p></div><div className="grid gap-4 xl:grid-cols-2">{tables.map((table) => <Card key={table.group} className="overflow-hidden"><div className="flex items-center justify-between gap-2 border-b border-default p-4"><h4 className="text-sm font-semibold text-primary">{table.group}</h4><span className="shrink-0 rounded-full bg-success-soft px-2 py-1 text-[10px] font-semibold text-success">{table.savings}</span></div><div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-xs"><thead className="bg-subtle text-muted"><tr>{table.columns.map((column) => <th key={column} className="px-3 py-2 font-semibold">{column}</th>)}</tr></thead><tbody className="divide-y divide-default">{table.rows.map((row, index) => <tr key={index} className="text-secondary">{row.map((cell, cellIndex) => <td key={`${index}-${cellIndex}`} className={`px-3 py-2.5 ${cellIndex === 0 ? "font-semibold text-primary" : "whitespace-nowrap"}`}>{cell}</td>)}</tr>)}</tbody></table></div></Card>)}</div></section>}
    </div>
  );
}

function PackageSection() {
  const [category, setCategory] = useState<PackageCategory>("all");
  const [query, setQuery] = useState("");
  const categories: { id: PackageCategory; label: string }[] = [{ id: "all", label: "All packages" }, { id: "wellness", label: "Wellness" }, { id: "grooming", label: "Grooming" }];
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap gap-2" role="tablist" aria-label="Package category">{categories.map(({ id, label }) => <button key={id} type="button" role="tab" aria-selected={category === id} onClick={() => setCategory(id)} className={`min-h-9 rounded-full px-3.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${category === id ? "bg-brand text-on-brand" : "border border-default bg-elevated text-secondary hover:bg-hover"}`}>{label}</button>)}</div><div className="w-full sm:max-w-sm"><SearchBox value={query} onChange={setQuery} placeholder="Search packages, pet type, SKU…" label="Search packages" onClear={() => setQuery("")} /></div></div>
      {(category === "all" || category === "wellness") && <WellnessPackages query={query} />}
      {(category === "all" || category === "grooming") && <GroomingPackages query={query} />}
    </div>
  );
}

function ServiceSection() {
  const [category, setCategory] = useState<ServiceCategory>("consultation");
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Service category">{serviceTabs.map(({ id, label }) => <button key={id} type="button" role="tab" aria-selected={category === id} onClick={() => setCategory(id)} className={`min-h-9 rounded-full px-3.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${category === id ? "bg-brand text-on-brand" : "border border-default bg-elevated text-secondary hover:bg-hover"}`}>{label}</button>)}</div>
      {category === "consultation" && <section className="space-y-3"><div><h2 className="text-lg font-semibold text-primary">Consultation pricing</h2><p className="mt-1 text-sm text-secondary">In-clinic veterinary visit pricing.</p></div><div className="grid gap-3 md:grid-cols-2">{consultations.map((item) => <Card key={item.name} className="p-5"><div className="flex items-start justify-between gap-3"><div><span className="inline-flex rounded-full bg-info-soft px-2.5 py-1 text-[10px] font-semibold text-info">{item.tag}</span><h3 className="mt-3 font-semibold text-primary">{item.name}</h3></div><span className="text-lg font-bold text-primary">{rupees(item.price)}</span></div><p className="mt-2 text-sm leading-6 text-secondary">{item.desc}</p></Card>)}</div></section>}
      {category === "vaccination" && <section className="space-y-3"><div><h2 className="text-lg font-semibold text-primary">Vaccination pricing</h2><p className="mt-1 text-sm text-secondary">Vaccine route, dose, presentation, and validity information.</p></div><Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[920px] text-left text-sm"><thead className="bg-subtle text-xs text-muted"><tr>{["Vaccine", "Pet", "Route", "Dose", "Presentation", "Validity", "Price"].map((heading) => <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>)}</tr></thead><tbody className="divide-y divide-default">{vaccinations.map((item) => <tr key={item.sku} className="align-top"><td className="px-4 py-4"><p className="font-semibold text-primary">{item.name}</p><p className="mt-1 text-[11px] text-muted">SKU {item.sku}</p><p className="mt-2 max-w-sm text-xs leading-5 text-secondary">{item.desc}</p></td><td className="px-4 py-4 text-secondary">{item.name.includes("Canine and Feline") ? "Dog & Cat" : item.name.includes("Feline") ? "Cat" : "Dog"}</td><td className="px-4 py-4 text-secondary">{item.route}</td><td className="px-4 py-4 text-secondary">{item.dose}</td><td className="px-4 py-4 text-secondary">{item.presentation}</td><td className="px-4 py-4 text-secondary">{item.validity}</td><td className="whitespace-nowrap px-4 py-4 font-semibold text-primary">{rupees(item.price)}</td></tr>)}</tbody></table></div></Card></section>}
      {category === "grooming" && <section className="space-y-3"><div><h2 className="text-lg font-semibold text-primary">Grooming guidelines & eligibility</h2><p className="mt-1 text-sm text-secondary">Review these requirements before confirming a grooming appointment.</p></div><div className="grid gap-3 md:grid-cols-2">{groomingGuidelines.map((guideline) => <Card key={guideline.title} className="p-5"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-lg" aria-hidden="true">{guideline.icon}</span><div><h3 className="font-semibold text-primary">{guideline.title}</h3><ul className="mt-2 space-y-2">{guideline.points.map((point) => <li key={point} className="text-sm leading-6 text-secondary">{point}</li>)}</ul></div></div></Card>)}</div></section>}
    </div>
  );
}

function ClinicContactCard({ clinic }: { clinic: Clinic }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3"><div><span className="rounded-full bg-brand-soft px-2.5 py-1 text-[10px] font-semibold text-brand-strong">Level 1 · Clinic</span><h3 className="mt-3 text-base font-semibold text-primary">{clinic.clinic}</h3></div><a href={`tel:${clinic.number.replace(/\s/g, "")}`} aria-label={`Call ${clinic.clinic}`} className="grid size-9 shrink-0 place-items-center rounded-full bg-success-soft text-success hover:bg-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"><Phone size={16} /></a></div>
      <dl className="mt-3 space-y-2 text-xs"><div><dt className="inline text-muted">Clinic line: </dt><dd className="inline font-semibold text-primary">{clinic.number}</dd></div><div><dt className="inline text-muted">Central Manager: </dt><dd className="inline font-semibold text-primary">{clinic.manager}</dd></div><div className="flex items-start gap-1.5"><dt className="shrink-0 text-muted">Phone:</dt><dd><a className="text-secondary underline-offset-2 hover:text-brand-strong hover:underline" href={`tel:${clinic.phone}`}>{clinic.phone}</a></dd></div><div className="flex items-start gap-1.5"><dt className="mt-0.5 shrink-0 text-muted"><Mail size={13} /></dt><dd className="min-w-0"><a className="break-all text-secondary underline-offset-2 hover:text-brand-strong hover:underline" href={`mailto:${clinic.email}`}>{clinic.email}</a></dd></div></dl>
      <div className="mt-4 border-t border-default pt-3 text-xs text-secondary">{clinic.zone ? <>Zone: <strong className="text-primary">{clinic.zone}</strong><span className="text-muted"> · escalate to </span><strong className="text-primary">{clinic.zonalHead}</strong></> : <span className="italic text-muted">Zone not assigned — see escalation chain below.</span>}</div>
    </Card>
  );
}

function ClinicDirectory() {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => clinics.filter((clinic) => matches(query, clinic.clinic, clinic.manager, clinic.number, clinic.phone, clinic.email, clinic.zone)), [query]);
  return (
    <div className="space-y-6">
      <section className="space-y-4"><div><h2 className="text-lg font-semibold text-primary">Clinic directory</h2><p className="mt-1 text-sm text-secondary">Call the clinic directly, or contact the Central Manager if the clinic line doesn’t pick up.</p></div><SearchBox value={query} onChange={setQuery} placeholder="Search clinic, manager, phone, or email…" label="Search clinic contacts" onClear={() => setQuery("")} />
        {filtered.length ? <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">{filtered.map((clinic) => <ClinicContactCard key={clinic.clinic} clinic={clinic} />)}</div> : <EmptyState title="No clinics match" description="Try another search term." />}
      </section>
      {!query && <section className="space-y-3"><div><h2 className="text-lg font-semibold text-primary">Escalation chain</h2><p className="mt-1 text-sm leading-6 text-secondary">If Level 1 (clinic / central manager) is unreachable, escalate in order: Zonal Head → City Operations Head → HOD. Phone calls are only for the Clinic Manager (Level 1); escalation from Zonal Head upward should go by email, not a direct call.</p></div><div className="grid gap-3 md:grid-cols-2">{escalationChain.map((contact) => <Card key={contact.email} className="p-5"><span className="rounded-full bg-info-soft px-2.5 py-1 text-[10px] font-semibold text-info">{contact.level}</span><h3 className="mt-3 font-semibold text-primary">{contact.name}</h3><p className="mt-1 text-sm text-secondary">{contact.role}</p><p className="mt-3 text-xs text-muted">Email only — do not call directly.</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs"><a href={`tel:${contact.phone}`} className="inline-flex items-center gap-1.5 text-secondary hover:text-brand-strong"><Phone size={13} />{contact.phone}</a><a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1.5 break-all text-secondary hover:text-brand-strong"><Mail size={13} />{contact.email}</a></div></Card>)}</div></section>}
    </div>
  );
}

function ClinicLocations() {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => clinics.filter((clinic) => matches(query, clinic.clinic, clinic.address ?? "", clinic.hours)), [query]);
  return (
    <div className="space-y-4"><div><h2 className="text-lg font-semibold text-primary">All clinic locations</h2><p className="mt-1 text-sm text-secondary">Find an address and open directions in Google Maps.</p></div><SearchBox value={query} onChange={setQuery} placeholder="Search clinic or area…" label="Search clinic locations" onClear={() => setQuery("")} />
      {filtered.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map((clinic) => <Card key={clinic.clinic} className="p-5"><span className="rounded-full bg-info-soft px-2.5 py-1 text-[10px] font-semibold text-info">Clinic location</span><h3 className="mt-3 text-base font-semibold text-primary">{clinic.clinic}</h3>{clinic.address ? <p className="mt-2 flex items-start gap-2 text-sm leading-5 text-secondary"><MapPin size={15} className="mt-0.5 shrink-0 text-muted" />{clinic.address}</p> : <p className="mt-2 flex items-start gap-2 text-sm italic text-muted"><MapPin size={15} className="mt-0.5 shrink-0" />Address not confirmed yet</p>}<p className="mt-3 flex items-center gap-2 border-t border-default pt-3 text-xs font-medium text-secondary"><Clock3 size={14} className="text-muted" />{clinic.hours}</p><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${clinic.clinic} Supertails ${clinic.address ?? "Bengaluru"}`)}`} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-9 items-center gap-1.5 rounded-[var(--radius-control)] bg-brand-soft px-3 text-xs font-semibold text-brand-strong hover:bg-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">Get directions <ArrowUpRight size={14} /></a></Card>)}</div> : <EmptyState title="No clinics match" description="Try another search term." />}
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="rounded-[var(--radius-md)] border border-dashed border-default bg-subtle/50 px-6 py-12 text-center"><Search size={24} className="mx-auto text-muted" aria-hidden="true" /><h3 className="mt-3 font-semibold text-primary">{title}</h3><p className="mt-1 text-sm text-muted">{description}</p></div>;
}

export function GuidePage() {
  const [tab, setTab] = useState<GuideTab>("packages");
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-brand"><BookOpen size={14} aria-hidden="true" />Team reference</p>
          <h1 className="text-[clamp(1.65rem,3vw,2rem)] font-semibold tracking-[-0.035em] text-primary">Clinic Service Guide</h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-6 text-secondary">Packages, service details, clinic contacts, and locations in one searchable guide.</p>
        </div>
        <a href={sourceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-1.5 self-start text-xs font-semibold text-brand-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:self-auto">Open source guide <ArrowUpRight size={14} aria-hidden="true" /></a>
      </header>

      <nav aria-label="Guide sections" className="sticky top-[72px] z-20 -mx-4 border-y border-default bg-app/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Guide sections">{mainTabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-[var(--radius-control)] px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:px-4 sm:text-sm ${tab === id ? "bg-active text-brand-strong" : "text-secondary hover:bg-hover hover:text-primary"}`}><Icon size={16} aria-hidden="true" />{label}</button>)}</div>
      </nav>

      <section role="tabpanel" aria-label={`${mainTabs.find((item) => item.id === tab)?.label} section`}>
        {tab === "packages" && <PackageSection />}
        {tab === "services" && <ServiceSection />}
        {tab === "contacts" && <ClinicDirectory />}
        {tab === "locations" && <ClinicLocations />}
        {tab === "map" && <Suspense fallback={<Card className="p-8 text-center text-sm text-secondary">Loading the clinic map…</Card>}><ClinicMap /></Suspense>}
        {tab === "discounts" && <div aria-label="Discounts content" />}
      </section>
    </div>
  );
}
