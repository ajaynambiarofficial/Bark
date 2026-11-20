import { useEffect, useMemo, useState } from "react";
import { FileText, Plus, Printer, Search, Trash2 } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";

interface Clinic { id: string; name: string }
interface Service { id: string; sku: string; name: string; category: string; durationMinutes: number; price: number }
interface QuoteOffer { id: string; code: string; name: string; description: string; discountType: "percent" | "amount"; discountValue: number | string; minimumSubtotal: number | string }
interface QuoteLine extends Service { quantity: number; unitPrice: number }
interface ApiBody<T> { data: T; error?: { message?: string } }
interface QuoteSnapshot {
  reference: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  clinicName: string;
  offerName: string;
  codeReference: string;
  discountType: "percent" | "amount";
  discountInput: number;
  lines: QuoteLine[];
}

const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api";
const inputClass = "min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm text-primary";
const labelClass = "text-sm font-medium text-primary";
const currency = (amount: number | string) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(amount) || 0);

async function api<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, { credentials: "include" });
  const body = await response.json().catch(() => null) as ApiBody<T> | null;
  if (!response.ok) throw new Error(body?.error?.message ?? "The clinic catalog could not be loaded.");
  return body?.data as T;
}

function QuoteTotals({ lines, type, value }: { lines: QuoteLine[]; type: "percent" | "amount"; value: number }) {
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const discount = Math.min(subtotal, type === "percent" ? subtotal * Math.min(Math.max(value, 0), 100) / 100 : Math.max(value, 0));
  return <dl className="ml-auto w-full max-w-sm space-y-2 text-sm"><div className="flex justify-between gap-4"><dt className="text-secondary">Subtotal</dt><dd className="font-semibold tabular-nums text-primary">{currency(subtotal)}</dd></div><div className="flex justify-between gap-4"><dt className="text-secondary">Discount</dt><dd className="font-semibold tabular-nums text-success">−{currency(discount)}</dd></div><div className="flex justify-between gap-4 border-t border-default pt-2 text-base"><dt className="font-semibold text-primary">Estimated total</dt><dd className="font-bold tabular-nums text-primary">{currency(Math.max(0, subtotal - discount))}</dd></div></dl>;
}

export function QuoteGeneratorPage() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [clinicId, setClinicId] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const [offers, setOffers] = useState<QuoteOffer[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState("");
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [query, setQuery] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [codeReference, setCodeReference] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [discountInput, setDiscountInput] = useState(0);
  const [quote, setQuote] = useState<QuoteSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void api<Clinic[]>("/catalog/clinics").then((rows) => {
      if (!active) return;
      setClinics(rows);
      setClinicId(rows[0]?.id ?? "");
    }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Could not load clinics."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (!clinicId) { setServices([]); return; }
    setLoading(true);
    setError(null);
    void Promise.all([api<Service[]>(`/catalog/services?clinicId=${encodeURIComponent(clinicId)}`), api<QuoteOffer[]>(`/catalog/offers?clinicId=${encodeURIComponent(clinicId)}`)])
      .then(([serviceRows, offerRows]) => { if (active) { setServices(serviceRows); setOffers(offerRows); setSelectedOfferId(""); } })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Could not load the clinic catalog."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [clinicId]);

  const selectedClinic = clinics.find((clinic) => clinic.id === clinicId);
  const selectedOffer = offers.find((offer) => offer.id === selectedOfferId);
  const appliedDiscountType = selectedOffer?.discountType ?? discountType;
  const appliedDiscountValue = selectedOffer ? Number(selectedOffer.discountValue) : discountInput;
  const filteredServices = useMemo(() => {
    const term = query.trim().toLowerCase();
    return services.filter((service) => !term || [service.name, service.category, service.sku].some((value) => value.toLowerCase().includes(term)));
  }, [query, services]);
  const addService = (service: Service) => {
    setLines((current) => {
      const existing = current.find((line) => line.id === service.id);
      return existing
        ? current.map((line) => line.id === service.id ? { ...line, quantity: line.quantity + 1 } : line)
        : [...current, { ...service, quantity: 1, unitPrice: service.price > 0 ? service.price : 0 }];
    });
  };

  const updateLine = (id: string, changes: Partial<Pick<QuoteLine, "quantity" | "unitPrice">>) => {
    setLines((current) => current.map((line) => line.id === id ? { ...line, ...changes } : line));
    setQuote(null);
  };

  const generateQuote = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!lines.length || !selectedClinic) return;
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
    const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
    if (selectedOffer && subtotal < Number(selectedOffer.minimumSubtotal)) { setError(`This offer requires a minimum subtotal of ${currency(Number(selectedOffer.minimumSubtotal))}.`); return; }
    setError(null);
    setQuote({ reference: `Q-${stamp}`, createdAt: now.toISOString(), customerName, customerPhone, customerEmail, clinicName: selectedClinic.name, offerName: selectedOffer?.name ?? "", codeReference, discountType: appliedDiscountType, discountInput: appliedDiscountValue, lines: lines.map((line) => ({ ...line })) });
  };

  const quoteSubtotal = quote?.lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0) ?? 0;
  const quoteDiscount = quote ? Math.min(quoteSubtotal, quote.discountType === "percent" ? quoteSubtotal * Math.min(Math.max(quote.discountInput, 0), 100) / 100 : Math.max(quote.discountInput, 0)) : 0;

  return <div className="space-y-6">
    <PageHeader eyebrow="Pawcare" title="Quote generator" description="Build a clinic service estimate, apply an approved discount, and print or save the quote." action={quote ? <Button variant="secondary" icon={<Printer size={15} />} onClick={() => window.print()} className="print:hidden">Print / Save PDF</Button> : undefined} />
    {error && <p role="alert" className="rounded-lg border border-error-border bg-error-soft p-3 text-sm text-error">{error}</p>}

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)] print:block">
      <div className="space-y-5 print:hidden">
        <Card className="p-5">
          <h2 className="text-base font-semibold text-primary">Customer and clinic</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>Customer name<input required value={customerName} onChange={(event) => { setCustomerName(event.target.value); setQuote(null); }} className={inputClass} placeholder="Pet parent name" /></label>
            <label className={labelClass}>Phone<input required type="tel" value={customerPhone} onChange={(event) => { setCustomerPhone(event.target.value); setQuote(null); }} className={inputClass} placeholder="Contact number" /></label>
            <label className={labelClass}>Email (optional)<input type="email" value={customerEmail} onChange={(event) => { setCustomerEmail(event.target.value); setQuote(null); }} className={inputClass} placeholder="name@example.com" /></label>
            <label className={labelClass}>Clinic<select required value={clinicId} onChange={(event) => { setClinicId(event.target.value); setLines([]); setOffers([]); setSelectedOfferId(""); setCodeReference(""); setQuote(null); }} className={inputClass}><option value="">Choose clinic</option>{clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}</select></label>
          </div>
        </Card>

        <Card className="p-5">
          <div><h2 className="text-base font-semibold text-primary">Add clinic services</h2><p className="mt-1 text-sm text-secondary">Search the services offered at the selected clinic.</p></div>
          <label className="relative mt-4 block"><span className="sr-only">Search clinic services</span><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search service name or code" className={`${inputClass} pl-10`} /></label>
          {loading ? <p className="py-8 text-center text-sm text-muted">Loading clinic services…</p> : filteredServices.length ? <div className="mt-3 max-h-[430px] divide-y divide-default overflow-y-auto">{filteredServices.map((service) => <div key={service.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-primary">{service.name}</p><p className="mt-1 text-xs text-muted">{service.category} · {service.sku} · {service.durationMinutes} min</p></div><div className="flex shrink-0 items-center gap-3"><span className="text-sm font-semibold tabular-nums text-primary">{service.price > 0 ? currency(service.price) : "Set price"}</span><Button type="button" variant="secondary" className="size-9 min-h-9 px-0" aria-label={`Add ${service.name}`} onClick={() => addService(service)}><Plus size={16} /></Button></div></div>)}</div> : <p className="py-8 text-center text-sm text-muted">No matching services at this clinic.</p>}
          <p className="mt-3 rounded-lg bg-info-soft p-3 text-xs leading-5 text-info">Some clinic service prices are not configured yet. Enter the approved rate in the quote before generating it.</p>
        </Card>
      </div>

      <div className="space-y-5">
        {!quote ? <form onSubmit={generateQuote} className="space-y-5">
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-semibold text-primary">Quote items</h2><p className="mt-1 text-sm text-secondary">Adjust quantities and clinic-approved unit rates.</p></div><span className="rounded-full bg-subtle px-2.5 py-1 text-xs font-semibold text-secondary">{lines.length} item{lines.length === 1 ? "" : "s"}</span></div>
            {!lines.length ? <p className="mt-5 rounded-lg border border-dashed border-default p-8 text-center text-sm text-muted">Search and add one or more clinic services to start a quote.</p> : <div className="mt-4 divide-y divide-default">{lines.map((line) => <div key={line.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_90px_130px_32px] sm:items-end"><div className="min-w-0"><p className="truncate text-sm font-semibold text-primary">{line.name}</p><p className="mt-1 text-xs text-muted">{line.sku}</p></div><label className="text-xs font-medium text-secondary">Qty<input type="number" min="1" max="99" value={line.quantity} onChange={(event) => updateLine(line.id, { quantity: Math.max(1, Number(event.target.value) || 1) })} className="mt-1 min-h-10 w-full rounded-lg border border-input bg-input px-2 text-sm text-primary" /></label><label className="text-xs font-medium text-secondary">Unit price<input type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => updateLine(line.id, { unitPrice: Math.max(0, Number(event.target.value) || 0) })} className="mt-1 min-h-10 w-full rounded-lg border border-input bg-input px-2 text-sm text-primary" /></label><button type="button" onClick={() => { setLines((current) => current.filter((item) => item.id !== line.id)); setQuote(null); }} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-error-soft hover:text-error" aria-label={`Remove ${line.name}`}><Trash2 size={16} /></button></div>)}</div>}
          </Card>

          <Card className="space-y-4 p-5">
            <h2 className="text-base font-semibold text-primary">Discount</h2>
            <label className={labelClass}>Configured offer<select value={selectedOfferId} onChange={(event) => { const offer = offers.find((candidate) => candidate.id === event.target.value); setSelectedOfferId(event.target.value); setCodeReference(offer?.code ?? ""); setQuote(null); setError(null); }} className={inputClass}><option value="">Manual approved discount</option>{offers.map((offer) => <option key={offer.id} value={offer.id}>{offer.name} · {offer.discountType === "percent" ? `${offer.discountValue}% off` : `${currency(offer.discountValue)} off`} ({offer.code})</option>)}</select></label>
            {!selectedOffer && <label className={labelClass}>Discount code / approval reference<input value={codeReference} onChange={(event) => { setCodeReference(event.target.value); setQuote(null); }} className={inputClass} placeholder="Enter the approved code or reference" /></label>}
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr]"><label className={labelClass}>Discount type<select disabled={Boolean(selectedOffer)} value={appliedDiscountType} onChange={(event) => { setDiscountType(event.target.value as "percent" | "amount"); setQuote(null); }} className={`${inputClass} disabled:opacity-60`}><option value="percent">Percentage</option><option value="amount">Fixed amount (₹)</option></select></label><label className={labelClass}>Discount value<input disabled={Boolean(selectedOffer)} type="number" min="0" max={appliedDiscountType === "percent" ? 100 : undefined} step="0.01" value={appliedDiscountValue} onChange={(event) => { setDiscountInput(Math.max(0, Number(event.target.value) || 0)); setQuote(null); }} className={`${inputClass} disabled:opacity-60`} /></label></div>
            {selectedOffer ? <p className="text-xs leading-5 text-info">{selectedOffer.description || `${selectedOffer.name} is configured for this clinic.`} Minimum subtotal: {currency(Number(selectedOffer.minimumSubtotal))}.</p> : <p className="text-xs leading-5 text-muted">Use a configured offer or enter a discount approved for this customer. Manual discount values are recorded on the quote.</p>}
            <QuoteTotals lines={lines} type={appliedDiscountType} value={appliedDiscountValue} />
            <Button type="submit" disabled={!lines.length || !customerName.trim() || !customerPhone.trim() || !clinicId} fullWidth icon={<FileText size={16} />}>Generate quote</Button>
          </Card>
        </form> : <Card className="quote-print p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-default pb-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-brand">Pawcare service estimate</p><h2 className="mt-1 text-xl font-bold text-primary">Quote {quote.reference}</h2><p className="mt-1 text-xs text-muted">Created {new Date(quote.createdAt).toLocaleString("en-IN")}</p></div><span className="rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-strong">{quote.clinicName}</span></div>
          <div className="grid gap-2 border-b border-default py-4 text-sm sm:grid-cols-2"><p><span className="text-muted">Customer:</span> <strong className="text-primary">{quote.customerName}</strong></p><p><span className="text-muted">Phone:</span> <strong className="text-primary">{quote.customerPhone}</strong></p>{quote.customerEmail && <p className="sm:col-span-2"><span className="text-muted">Email:</span> <strong className="text-primary">{quote.customerEmail}</strong></p>}</div>
          <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-left text-sm"><thead><tr className="border-b border-default text-xs text-muted"><th className="py-3 pr-3 font-semibold">Service</th><th className="py-3 px-2 text-right font-semibold">Qty</th><th className="py-3 px-2 text-right font-semibold">Rate</th><th className="py-3 pl-2 text-right font-semibold">Amount</th></tr></thead><tbody className="divide-y divide-default">{quote.lines.map((line) => <tr key={line.id}><td className="py-3 pr-3 font-medium text-primary">{line.name}</td><td className="py-3 px-2 text-right tabular-nums">{line.quantity}</td><td className="py-3 px-2 text-right tabular-nums">{currency(line.unitPrice)}</td><td className="py-3 pl-2 text-right font-semibold tabular-nums">{currency(line.unitPrice * line.quantity)}</td></tr>)}</tbody></table></div>
          <dl className="ml-auto mt-4 w-full max-w-xs space-y-2 text-sm"><div className="flex justify-between gap-3"><dt className="text-secondary">Subtotal</dt><dd className="font-semibold tabular-nums text-primary">{currency(quoteSubtotal)}</dd></div><div className="flex justify-between gap-3"><dt className="text-secondary">Discount{quote.codeReference ? ` (${quote.codeReference})` : ""}</dt><dd className="font-semibold tabular-nums text-success">−{currency(quoteDiscount)}</dd></div>{quote.offerName && <div className="flex justify-between gap-3"><dt className="text-secondary">Offer</dt><dd className="font-medium text-primary">{quote.offerName}</dd></div>}<div className="flex justify-between gap-3 border-t border-default pt-2 text-base"><dt className="font-bold text-primary">Estimated total</dt><dd className="font-bold tabular-nums text-primary">{currency(Math.max(0, quoteSubtotal - quoteDiscount))}</dd></div></dl>
          <p className="mt-5 border-t border-default pt-4 text-xs leading-5 text-muted">This estimate is valid for 7 days. Final service availability and applicable taxes will be confirmed by the clinic.</p>
          <div className="mt-5 flex flex-wrap justify-between gap-2 print:hidden"><Button variant="secondary" onClick={() => setQuote(null)}>Edit quote</Button><Button variant="secondary" icon={<Printer size={15} />} onClick={() => window.print()}>Print / Save PDF</Button></div>
        </Card>}
      </div>
    </div>
    <style>{`@media print { body * { visibility: hidden !important; } .quote-print, .quote-print * { visibility: visible !important; } .quote-print { position: absolute !important; inset: 0 auto auto 0 !important; width: 100% !important; border: 0 !important; box-shadow: none !important; } }`}</style>
  </div>;
}
