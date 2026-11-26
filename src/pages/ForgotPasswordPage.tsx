import { ArrowLeft, CheckCircle2, KeyRound } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { BarkLogo } from "../components/brand/BarkLogo";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api";

async function post<T>(path: string, data: unknown): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
  const body = await response.json().catch(() => null) as { data?: T; error?: { message?: string } } | null;
  if (!response.ok) throw new Error(body?.error?.message ?? "The request could not be completed.");
  return body?.data as T;
}

export function ForgotPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  return token ? <ResetPassword token={token} /> : <RequestPasswordReset />;
}

function Frame({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-dvh items-center justify-center bg-app px-4 py-10"><div className="w-full max-w-md"><div className="mb-7"><BarkLogo /></div>{children}</div></main>;
}

function RequestPasswordReset() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [localResetUrl, setLocalResetUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setPending(true); setError(null); setMessage(null); setLocalResetUrl(null);
    try {
      const result = await post<{ message: string; localResetUrl?: string }>("/auth/forgot-password", { email });
      setMessage(result.message); setLocalResetUrl(result.localResetUrl ?? null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not request a reset link."); }
    finally { setPending(false); }
  };

  return <Frame><Card className="p-6 sm:p-7"><div className="mb-5 grid size-11 place-items-center rounded-xl bg-brand-soft text-brand"><KeyRound size={21} /></div><h1 className="text-2xl font-semibold text-primary">Reset your password</h1><p className="mt-2 text-sm leading-6 text-secondary">Enter your work email. If it matches an active account, we’ll send a secure reset link.</p>
    <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-4"><div><label htmlFor="reset-email" className="text-sm font-medium text-primary">Work email</label><input id="reset-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm" /></div>
      {message && <div role="status" className="rounded-lg border border-success-border bg-success-soft p-3 text-sm text-primary"><p className="flex items-center gap-2"><CheckCircle2 size={16} />{message}</p>{localResetUrl && <p className="mt-2 break-all"><a className="font-medium text-brand underline" href={localResetUrl}>Open local password reset link</a></p>}</div>}
      {error && <p role="alert" className="rounded-lg border border-error-border bg-error-soft p-3 text-sm text-error">{error}</p>}
      <Button type="submit" fullWidth disabled={pending || !email}>{pending ? "Preparing link…" : "Continue"}</Button>
    </form><Link to="/login" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-secondary hover:text-primary"><ArrowLeft size={15} />Back to sign in</Link>
  </Card></Frame>;
}

function ResetPassword({ token }: { token: string }) {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(null);
    if (password !== confirm) { setError("The passwords do not match."); return; }
    setPending(true);
    try { await post("/auth/reset-password", { token, password }); navigate("/login", { replace: true, state: { message: "Your password has been reset. Sign in with your new password." } }); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not reset your password."); }
    finally { setPending(false); }
  };

  return <Frame><Card className="p-6 sm:p-7"><div className="mb-5 grid size-11 place-items-center rounded-xl bg-brand-soft text-brand"><KeyRound size={21} /></div><h1 className="text-2xl font-semibold text-primary">Choose a new password</h1><p className="mt-2 text-sm text-secondary">Use at least 14 characters.</p>
    <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-4"><div><label htmlFor="new-password" className="text-sm font-medium text-primary">New password</label><input id="new-password" type="password" autoComplete="new-password" minLength={14} maxLength={1024} required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm" /></div><div><label htmlFor="confirm-password" className="text-sm font-medium text-primary">Confirm password</label><input id="confirm-password" type="password" autoComplete="new-password" minLength={14} maxLength={1024} required value={confirm} onChange={(event) => setConfirm(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-input px-3 text-sm" /></div>
      {error && <p role="alert" className="rounded-lg border border-error-border bg-error-soft p-3 text-sm text-error">{error}</p>}<Button type="submit" fullWidth disabled={pending || password.length < 14 || !confirm}>{pending ? "Updating…" : "Reset password"}</Button>
    </form></Card></Frame>;
}
