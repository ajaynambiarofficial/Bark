import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FlaskConical, Microscope, RefreshCw, ScanLine, Search, Stethoscope, Syringe, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { loadDiagnosticServices } from "../features/pawcare/diagnostics.service";
import type { DiagnosticCategory, DiagnosticServiceItem } from "../features/pawcare/diagnostics.service";

type CategoryFilter = "All services" | DiagnosticCategory;
const categories: DiagnosticCategory[] = ["Laboratory", "Diagnostic Imaging", "Procedures", "Vaccination"];
const categoryIcons: Record<DiagnosticCategory, LucideIcon> = {
  Laboratory: FlaskConical,
  "Diagnostic Imaging": ScanLine,
  Procedures: Stethoscope,
  Vaccination: Syringe,
};
const PAGE_SIZE = 24;

function currency(value: number | null) {
  return value === null ? "Price unavailable" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function itemMatches(item: DiagnosticServiceItem, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [item.name, item.category, item.sku, item.description, item.vendor, ...item.details.map((detail) => `${detail.label} ${detail.value}`)]
    .some((value) => value.toLowerCase().includes(needle));
}

function ItemDetails({ item }: { item: DiagnosticServiceItem }) {
  if (!item.details.length) return <span className="text-xs text-muted">—</span>;
  return <div className="flex flex-wrap gap-1.5">{item.details.map(({ label, value }) => <span key={`${label}-${value}`} className="rounded-full bg-subtle px-2 py-1 text-[10px] text-secondary"><span className="text-muted">{label}: </span>{value}</span>)}</div>;
}

function ServiceCard({ item }: { item: DiagnosticServiceItem }) {
  const Icon = categoryIcons[item.category];
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-strong"><Icon size={17} aria-hidden="true" /></span>
          <div className="min-w-0"><p className="font-semibold text-primary">{item.name}</p><p className="mt-1 text-[11px] text-muted">{item.sku || "SKU not listed"}</p></div>
        </div>
        <span className="shrink-0 text-sm font-bold text-primary">{currency(item.price)}</span>
      </div>
      {item.description && <p className="mt-3 text-xs leading-5 text-secondary">{item.description}</p>}
      <div className="mt-3"><ItemDetails item={item} /></div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-default pt-3 text-[11px] text-muted"><span>{item.vendor || item.category}</span>{item.productUrl && <a href={item.productUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 font-semibold text-brand-strong hover:underline">Product details <ExternalLink size={12} aria-hidden="true" /></a>}</div>
    </Card>
  );
}

function ServiceTable({ items }: { items: DiagnosticServiceItem[] }) {
  return (
    <Card className="hidden overflow-hidden lg:block">
      <div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <thead className="bg-subtle text-[11px] uppercase tracking-wide text-muted"><tr><th className="px-4 py-3 font-semibold">Service</th><th className="px-4 py-3 font-semibold">Category</th><th className="px-4 py-3 font-semibold">Details</th><th className="px-4 py-3 text-right font-semibold">Price</th><th className="px-4 py-3 font-semibold">Link</th></tr></thead>
        <tbody className="divide-y divide-default">{items.map((item) => {
          const Icon = categoryIcons[item.category];
          return <tr key={item.id} className="align-top hover:bg-hover/60"><td className="max-w-[330px] px-4 py-3"><div className="flex items-start gap-2.5"><span className="mt-0.5 text-brand-strong"><Icon size={16} aria-hidden="true" /></span><div><p className="font-semibold text-primary">{item.name}</p><p className="mt-1 text-[11px] text-muted">{item.sku || "SKU not listed"}</p>{item.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-secondary">{item.description}</p>}</div></div></td><td className="whitespace-nowrap px-4 py-3 text-xs text-secondary">{item.category}</td><td className="min-w-[250px] px-4 py-3"><ItemDetails item={item} /></td><td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-primary">{currency(item.price)}</td><td className="whitespace-nowrap px-4 py-3">{item.productUrl ? <a href={item.productUrl} target="_blank" rel="noreferrer" aria-label={`Open product details for ${item.name}`} className="inline-flex size-8 items-center justify-center rounded-full text-brand-strong hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"><ExternalLink size={15} /></a> : <span className="text-muted">—</span>}</td></tr>;
        })}</tbody>
      </table></div>
    </Card>
  );
}

export function DiagnosticsPage() {
  const [items, setItems] = useState<DiagnosticServiceItem[]>([]);
  const [failedSheets, setFailedSheets] = useState<DiagnosticCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("All services");
  const [processing, setProcessing] = useState("All sources");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void loadDiagnosticServices(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setItems(result.items);
      setFailedSheets(result.failedSheets);
      setLoadedAt(new Date());
      if (!result.items.length) setError("Diagnostic pricing data could not be loaded from the workbook.");
    }).catch((caught: unknown) => {
      if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Diagnostic pricing data could not be loaded.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refreshKey]);

  const counts = useMemo(() => Object.fromEntries(categories.map((itemCategory) => [itemCategory, items.filter((item) => item.category === itemCategory).length])) as Record<DiagnosticCategory, number>, [items]);
  const filtered = useMemo(() => {
    const result = items.filter((item) => (category === "All services" || item.category === category)
      && itemMatches(item, query)
      && (category !== "Laboratory" || processing === "All sources" || item.details.find((detail) => detail.label === "Processing")?.value === processing));
    return result.sort((a, b) => sort === "price-low" ? (a.price ?? Infinity) - (b.price ?? Infinity) : sort === "price-high" ? (b.price ?? -Infinity) - (a.price ?? -Infinity) : a.name.localeCompare(b.name));
  }, [items, category, query, processing, sort]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [query, category, processing, sort]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Pawcare" title="Diagnostics" description="Search lab tests, diagnostic imaging, procedures, and vaccination pricing from the Clinic Pricing workbook." action={<Button variant="secondary" icon={<RefreshCw size={15} className={loading ? "animate-spin" : ""} />} onClick={() => setRefreshKey((key) => key + 1)} disabled={loading}>Refresh data</Button>} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[{ label: "All services", count: items.length, icon: Microscope }, ...categories.map((itemCategory) => ({ label: itemCategory, count: counts[itemCategory], icon: categoryIcons[itemCategory] }))].map(({ label, count, icon: Icon }) => <Card key={label} className="flex items-center gap-3 px-4 py-3"><span className="grid size-9 place-items-center rounded-full bg-brand-soft text-brand-strong"><Icon size={17} aria-hidden="true" /></span><div><p className="text-xs text-muted">{label}</p><p className="mt-0.5 text-lg font-semibold tabular-nums text-primary">{loading ? "—" : count}</p></div></Card>)}
      </div>

      <Card className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter diagnostics by service type">
            {(["All services", ...categories] as CategoryFilter[]).map((itemCategory) => <button key={itemCategory} type="button" role="tab" aria-selected={category === itemCategory} onClick={() => setCategory(itemCategory)} className={`min-h-9 rounded-full px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${category === itemCategory ? "bg-brand text-on-brand" : "border border-default bg-elevated text-secondary hover:bg-hover"}`}>{itemCategory}{itemCategory === "All services" ? ` (${items.length})` : ` (${counts[itemCategory]})`}</button>)}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row xl:w-[min(100%,560px)]">
            <label className="relative min-w-0 flex-1"><span className="sr-only">Search diagnostics</span><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search test, service, SKU, sample…" className="min-h-10 w-full rounded-[var(--radius-control)] border border-default bg-input pl-9 pr-9 text-sm text-primary placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" />{query && <button type="button" onClick={() => setQuery("")} className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-hover hover:text-primary" aria-label="Clear search"><X size={14} /></button>}</label>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              {category === "Laboratory" && <><label className="sr-only" htmlFor="diagnostics-source">Processing source</label><select id="diagnostics-source" value={processing} onChange={(event) => setProcessing(event.target.value)} className="min-h-10 rounded-[var(--radius-control)] border border-default bg-input px-2 text-xs text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"><option>All sources</option><option>In-house</option><option>Outside</option></select></>}
              <label className="sr-only" htmlFor="diagnostics-sort">Sort services</label><select id="diagnostics-sort" value={sort} onChange={(event) => setSort(event.target.value)} className="min-h-10 rounded-[var(--radius-control)] border border-default bg-input px-2 text-xs text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"><option value="name">Name A–Z</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-default pt-3 text-xs text-muted"><span>{loading ? "Loading workbook data…" : `${filtered.length} service${filtered.length === 1 ? "" : "s"} found`}</span><span>{loadedAt ? `Synced ${loadedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Data source: Clinic Pricing V2"}</span></div>
      </Card>

      {error && <Card className="border-error-border bg-error-soft p-4"><p role="alert" className="text-sm font-medium text-error">{error}</p><p className="mt-1 text-xs text-error">Check the Google Sheet connection and try refreshing.</p></Card>}
      {failedSheets.length > 0 && failedSheets.length < categories.length && <p role="status" className="rounded-[var(--radius-control)] border border-warning/30 bg-warning-soft px-4 py-3 text-xs text-warning">Some workbook tabs are unavailable: {failedSheets.join(", ")}. Showing the available data.</p>}

      {!loading && !error && !filtered.length && <Card className="px-6 py-14 text-center"><Search size={24} className="mx-auto text-muted" aria-hidden="true" /><h2 className="mt-3 font-semibold text-primary">No matching diagnostics</h2><p className="mt-1 text-sm text-muted">Try a different search or change the selected filters.</p></Card>}
      {!loading && pageItems.length > 0 && <>
        <ServiceTable items={pageItems} />
        <div className="grid gap-3 lg:hidden">{pageItems.map((item) => <ServiceCard key={item.id} item={item} />)}</div>
        {pageCount > 1 && <div className="flex items-center justify-between gap-3"><p className="text-xs text-muted">Page {page} of {pageCount}</p><div className="flex gap-2"><Button variant="secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button><Button variant="secondary" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>Next</Button></div></div>}
      </>}
    </div>
  );
}
