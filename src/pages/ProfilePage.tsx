import { Camera, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Avatar } from "../components/ui/Avatar";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

interface Profile {
  id: string;
  displayName: string;
  email: string;
  department: string;
  assignment: string;
  contactPhone: string | null;
  profileBio: string | null;
  avatarData: string | null;
}

const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, { ...init, credentials: "include", headers: { "content-type": "application/json", ...init?.headers } });
  const body = await response.json().catch(() => null) as { data?: T; error?: { message?: string } } | null;
  if (!response.ok) throw new Error(body?.error?.message ?? "The request could not be completed.");
  return body?.data as T;
}

async function prepareAvatar(file: File): Promise<string> {
  if (!file.type.match(/^image\/(?:png|jpeg|webp)$/)) throw new Error("Choose a PNG, JPEG, or WebP image.");
  const source = await createImageBitmap(file);
  const scale = Math.min(1, 512 / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  canvas.getContext("2d")?.drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close();
  const encoded = canvas.toDataURL("image/webp", 0.82);
  if (encoded.length > 1_500_000) throw new Error("That image is too large. Choose a smaller file.");
  return encoded;
}

export function ProfilePage() {
  const { employee, updateEmployee } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatarData, setAvatarData] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    void api<Profile>("/auth/profile").then((data) => {
      if (active) { setProfile(data); setAvatarData(data.avatarData); }
    }).catch((caught) => {
      if (active) setError(caught instanceof Error ? caught.message : "Could not load your profile.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    setSaving(true); setError(null); setSaved(false);
    try {
      const updated = await api<Omit<Profile, "avatarData"> & { avatarUrl: string }>("/auth/profile", { method: "PATCH", body: JSON.stringify({ displayName: profile.displayName, contactPhone: profile.contactPhone, profileBio: profile.profileBio, avatarData }) });
      setProfile((current) => current ? { ...current, ...updated, avatarData } : current);
      updateEmployee({ displayName: updated.displayName });
      setSaved(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save your profile."); }
    finally { setSaving(false); }
  };

  if (loading) return <p className="text-sm text-muted">Loading your profile…</p>;
  if (!profile) return <p role="alert" className="rounded-lg border border-error-border bg-error-soft p-3 text-sm text-error">{error ?? "Your profile could not be loaded."}</p>;

  return <div className="mx-auto max-w-3xl space-y-6">
    <div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-brand">Your account</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">Profile</h1><p className="mt-2 text-sm text-secondary">Update your contact details and profile picture. Your role and clinic access are managed by an administrator.</p></div>
    <Card className="p-5 sm:p-7">
      <form onSubmit={(event) => void save(event)} className="space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={profile.displayName} size="lg" src={avatarData} />
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-default px-3 text-sm font-medium text-secondary hover:bg-hover focus-within:ring-2 focus-within:ring-focus">
              <Camera size={16} aria-hidden="true" /> Choose picture
              <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Choose profile picture" onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (!file) return;
                void prepareAvatar(file).then(setAvatarData).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not read that image."));
              }} />
            </label>
            {avatarData && <Button type="button" variant="secondary" onClick={() => setAvatarData(null)}>Remove picture</Button>}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><label htmlFor="profile-name" className="text-sm font-medium text-primary">Display name</label><input id="profile-name" required minLength={2} maxLength={160} value={profile.displayName} onChange={(event) => setProfile({ ...profile, displayName: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm" /></div>
          <div><label htmlFor="profile-email" className="text-sm font-medium text-primary">Work email</label><input id="profile-email" value={profile.email} readOnly className="mt-1.5 min-h-11 w-full rounded-lg border border-default bg-subtle px-3 text-sm text-muted" /></div>
          <div><label htmlFor="profile-phone" className="text-sm font-medium text-primary">Contact phone</label><input id="profile-phone" type="tel" maxLength={40} value={profile.contactPhone ?? ""} onChange={(event) => setProfile({ ...profile, contactPhone: event.target.value || null })} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm" /></div>
          <div><label htmlFor="profile-role" className="text-sm font-medium text-primary">Team</label><input id="profile-role" value={employee?.roleLabel ?? ""} readOnly className="mt-1.5 min-h-11 w-full rounded-lg border border-default bg-subtle px-3 text-sm text-muted" /></div>
          <div><label htmlFor="profile-assignment" className="text-sm font-medium text-primary">Assignment</label><input id="profile-assignment" value={`${profile.department} · ${profile.assignment}`} readOnly className="mt-1.5 min-h-11 w-full rounded-lg border border-default bg-subtle px-3 text-sm text-muted" /></div>
          <div className="sm:col-span-2"><label htmlFor="profile-bio" className="text-sm font-medium text-primary">About</label><textarea id="profile-bio" rows={4} maxLength={500} value={profile.profileBio ?? ""} onChange={(event) => setProfile({ ...profile, profileBio: event.target.value || null })} className="mt-1.5 w-full rounded-lg border border-input bg-input px-3 py-2 text-sm" /></div>
        </div>
        {error && <p role="alert" className="rounded-lg border border-error-border bg-error-soft p-3 text-sm text-error">{error}</p>}
        {saved && <p role="status" className="text-sm text-brand-strong">Profile saved.</p>}
        <div className="flex justify-end"><Button type="submit" disabled={saving} icon={<Save size={16} />}>{saving ? "Saving…" : "Save profile"}</Button></div>
      </form>
    </Card>
  </div>;
}
