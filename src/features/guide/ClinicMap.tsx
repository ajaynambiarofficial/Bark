import { useEffect, useMemo, useRef, useState } from "react";
import * as L from "leaflet";
import { ArrowUpRight, Clock3, LocateFixed, LoaderCircle, MapPin, Navigation, Search } from "lucide-react";
import { Card } from "../../components/ui/Card";
import guideData from "./guide-data.json";
import "leaflet/dist/leaflet.css";
import "./clinic-map.css";

interface Clinic { clinic: string; lat: number; lng: number; address: string | null; hours: string; phone: string }
interface Point { latitude: number; longitude: number; label: string }
interface GeocodeResponse { data?: { latitude: number; longitude: number; displayName: string }; error?: { message?: string } }

const clinics = guideData.CLINIC_POC as Clinic[];
const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api";
const tileUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

function distanceKm(from: Point, to: Clinic) {
  const radians = (degrees: number) => degrees * (Math.PI / 180);
  const dLat = radians(to.lat - from.latitude);
  const dLng = radians(to.lng - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(distance: number) {
  return distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`;
}

function clinicIcon(number: number, isNearest: boolean, isSelected: boolean) {
  const tone = isNearest ? "clinic-map-marker--nearest" : isSelected ? "clinic-map-marker--selected" : "";
  return L.divIcon({
    className: "clinic-map-marker-shell",
    html: `<span class="clinic-map-marker ${tone}">${number}</span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

export function ClinicMap() {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const [locationQuery, setLocationQuery] = useState("");
  const [origin, setOrigin] = useState<Point | null>(null);
  const [selectedClinic, setSelectedClinic] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [tileError, setTileError] = useState(false);

  const nearest = useMemo(() => origin
    ? clinics.map((clinic) => ({ clinic, distance: distanceKm(origin, clinic) })).sort((a, b) => a.distance - b.distance)
    : clinics.map((clinic) => ({ clinic, distance: null as number | null })), [origin]);
  const nearestClinic = nearest[0]?.clinic;

  useEffect(() => {
    if (!mapElement.current || mapRef.current) return;
    const map = L.map(mapElement.current, { scrollWheelZoom: false }).setView([12.9716, 77.5946], 11);
    const tiles = L.tileLayer(tileUrl, {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
    }).addTo(map);
    tiles.on("tileerror", () => setTileError(true));
    const markers = L.layerGroup().addTo(map);
    mapRef.current = map;
    markerLayerRef.current = markers;
    const bounds = L.latLngBounds(clinics.map((clinic) => [clinic.lat, clinic.lng] as L.LatLngTuple));
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 12 });
    const resizeFrame = window.requestAnimationFrame(() => map.invalidateSize());
    return () => {
      window.cancelAnimationFrame(resizeFrame);
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = markerLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    clinics.forEach((clinic, index) => {
      const isNearest = clinic.clinic === nearestClinic?.clinic && Boolean(origin);
      const marker = L.marker([clinic.lat, clinic.lng], {
        icon: clinicIcon(index + 1, isNearest, clinic.clinic === selectedClinic),
        title: clinic.clinic,
        alt: `Supertails clinic ${index + 1}: ${clinic.clinic}`,
        keyboard: true,
      });
      marker.bindTooltip(clinic.clinic, { direction: "top", offset: [0, -12] });
      marker.on("click", () => setSelectedClinic(clinic.clinic));
      marker.addTo(layer);
    });
    if (origin) {
      const userIcon = L.divIcon({ className: "clinic-map-origin-shell", html: '<span class="clinic-map-origin-dot"></span>', iconSize: [20, 20], iconAnchor: [10, 10] });
      L.marker([origin.latitude, origin.longitude], { icon: userIcon, title: "Your searched location", alt: "Your searched location" }).addTo(layer).bindTooltip("Your location");
      if (nearestClinic) {
        map.fitBounds([[origin.latitude, origin.longitude], [nearestClinic.lat, nearestClinic.lng]], { padding: [56, 56], maxZoom: 13 });
      }
    }
  }, [origin, nearestClinic, selectedClinic]);

  const searchLocation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = locationQuery.trim();
    if (query.length < 3) {
      setLocationError("Enter an area, landmark, or PIN code to search.");
      return;
    }
    setSearching(true);
    setLocationError("");
    try {
      const response = await fetch(`${apiBase}/clinic-map/search?q=${encodeURIComponent(query)}`, { credentials: "include" });
      const body = await response.json().catch(() => null) as GeocodeResponse | null;
      if (!response.ok || !body?.data) throw new Error(body?.error?.message ?? "Could not search that location.");
      setOrigin({ latitude: body.data.latitude, longitude: body.data.longitude, label: body.data.displayName });
      setSelectedClinic(null);
    } catch (cause) {
      setLocationError(cause instanceof Error ? cause.message : "Could not search that location.");
    } finally {
      setSearching(false);
    }
  };

  const useMyLocation = () => {
    setLocationError("");
    if (!navigator.geolocation) {
      setLocationError("Location access is not available in this browser.");
      return;
    }
    setSearching(true);
    navigator.geolocation.getCurrentPosition((position) => {
      setOrigin({ latitude: position.coords.latitude, longitude: position.coords.longitude, label: "Your current location" });
      setSelectedClinic(null);
      setSearching(false);
    }, () => {
      setLocationError("Could not access your location. Check browser permissions or search an area instead.");
      setSearching(false);
    }, { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 });
  };

  const focusClinic = (clinic: Clinic) => {
    setSelectedClinic(clinic.clinic);
    mapRef.current?.flyTo([clinic.lat, clinic.lng], 14, { duration: 0.5 });
  };

  return <div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold text-primary">Find the nearest clinic</h2><p className="mt-1 text-sm text-secondary">Search a Bengaluru area or use your current location to find the closest Supertails clinic.</p></div><span className="rounded-full bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand-strong">{clinics.length} verified Bengaluru clinics</span></div>
    <Card className="p-4 sm:p-5">
      <form onSubmit={(event) => void searchLocation(event)} className="flex flex-col gap-2 sm:flex-row">
        <label className="relative min-w-0 flex-1"><span className="sr-only">Search your location</span><MapPin size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" /><input type="search" value={locationQuery} onChange={(event) => setLocationQuery(event.target.value)} placeholder="Enter an area, landmark, or PIN code" className="min-h-11 w-full rounded-lg border border-input bg-input py-2 pl-10 pr-3 text-sm text-primary placeholder:text-muted focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus-soft" /></label>
        <button type="submit" disabled={searching} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-on-brand hover:bg-brand-strong disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"><Search size={16} />Find nearest</button>
        <button type="button" onClick={useMyLocation} disabled={searching} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-default bg-elevated px-4 text-sm font-semibold text-secondary hover:bg-hover disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"><LocateFixed size={16} />Use my location</button>
      </form>
      <p className="mt-2 text-xs text-muted">Location search sends the text you enter to OpenStreetMap to find its coordinates. Current-location access stays in this browser.</p>
      {locationError && <p role="alert" className="mt-3 rounded-lg border border-error-border bg-error-soft px-3 py-2 text-sm text-error">{locationError}</p>}
      {origin && nearestClinic && <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-success-border bg-success-soft px-3 py-2 text-sm"><Navigation size={16} className="shrink-0 text-success" /><span className="text-secondary">Nearest from <strong className="font-semibold text-primary">{origin.label}</strong>:</span><button type="button" onClick={() => focusClinic(nearestClinic)} className="font-semibold text-brand-strong underline-offset-2 hover:underline">{nearestClinic.clinic}</button><span className="font-semibold text-success">{formatDistance(distanceKm(origin, nearestClinic))} away</span></div>}
    </Card>

    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.8fr)]">
      <Card className="overflow-hidden">
        <div ref={mapElement} className="clinic-map h-[390px] w-full sm:h-[480px]" role="region" aria-label="Map showing Supertails clinic locations in Bengaluru" />
        {tileError && <p className="border-t border-default px-4 py-2 text-xs text-warning">Some map tiles could not load. Clinic addresses and directions are still available in the list.</p>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-default px-4 py-3 text-xs text-secondary"><span className="inline-flex items-center gap-2"><span className="clinic-map-legend-dot" />Clinic</span><span className="inline-flex items-center gap-2"><span className="clinic-map-legend-dot clinic-map-legend-dot--nearest" />Nearest clinic</span>{origin && <span className="inline-flex items-center gap-2"><span className="clinic-map-origin-dot" />Your searched location</span>}</div>
      </Card>
      <Card className="flex min-h-0 flex-col overflow-hidden">
        <div className="border-b border-default p-4"><h3 className="font-semibold text-primary">Clinic locations</h3><p className="mt-1 text-xs text-secondary">{origin ? "Sorted by straight-line distance" : "Select a clinic to view it on the map"}</p></div>
        <ol className="max-h-[480px] divide-y divide-default overflow-y-auto">
          {nearest.map(({ clinic, distance }, index) => {
            const isNearest = Boolean(origin) && index === 0;
            const isSelected = clinic.clinic === selectedClinic;
            const clinicNumber = clinics.indexOf(clinic) + 1;
            return <li key={clinic.clinic}>
              <button type="button" onClick={() => focusClinic(clinic)} aria-pressed={isSelected} className={`w-full p-3.5 text-left transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus ${isSelected ? "bg-active" : ""}`}>
                <span className="flex items-start gap-3"><span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${isNearest ? "bg-success text-white" : "bg-brand-soft text-brand-strong"}`}>{clinicNumber}</span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center justify-between gap-1"><span className="font-semibold text-primary">{clinic.clinic}</span>{distance !== null && <span className={`text-xs font-semibold ${isNearest ? "text-success" : "text-secondary"}`}>{formatDistance(distance)}</span>}</span><span className="mt-1 block text-xs leading-5 text-secondary">{clinic.address ?? "Address not confirmed"}</span><span className="mt-1 flex items-center gap-1.5 text-xs text-muted"><Clock3 size={12} />{clinic.hours}</span></span></span>
              </button>
              {isSelected && <div className="flex items-center justify-between gap-2 border-t border-default bg-subtle px-3.5 py-2.5 pl-[3.75rem]"><a href={`https://www.google.com/maps/dir/?api=1&destination=${clinic.lat},${clinic.lng}`} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center gap-1.5 text-xs font-semibold text-brand-strong hover:underline">Get directions <ArrowUpRight size={13} /></a><a href={`tel:${clinic.phone}`} className="text-xs font-medium text-secondary hover:text-brand-strong">Call {clinic.phone}</a></div>}
            </li>;
          })}
        </ol>
        {searching && <div className="flex items-center gap-2 border-t border-default p-3 text-xs text-secondary"><LoaderCircle size={14} className="animate-spin" />Finding your location…</div>}
      </Card>
    </div>
  </div>;
}
