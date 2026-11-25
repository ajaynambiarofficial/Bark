import { AlertTriangle, ArrowRight, BarChart3, CalendarDays, CheckCircle2, ChevronRight, Home, LockKeyhole, Plus, ShieldCheck, Sparkles, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { Link } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { BarkLogo } from "../components/brand/BarkLogo";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

interface LoginLocationState { from?: string; message?: string }

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(options: { client_id: string; callback(response: { credential?: string }): void }): void;
          renderButton(parent: HTMLElement, options: Record<string, string | number>): void;
          cancel(): void;
        };
      };
    };
  }
}

export function LoginPage() {
  const { employee, signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDemoMode = import.meta.env.VITE_USE_MOCK_AUTH === "true";
  const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim();
  const googleButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!googleClientId || isDemoMode) return;
    let disposed = false;
    let initialized = false;
    const renderButton = () => {
      if (disposed || initialized || !window.google || !googleButtonRef.current) return;
      initialized = true;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => {
          if (!response.credential || disposed) return;
          setPending(true);
          setError(null);
          void signInWithGoogle(response.credential)
            .then(() => {
              const state = location.state as LoginLocationState | null;
              navigate(state?.from ?? "/welcome", { replace: true });
            })
            .catch((caughtError: unknown) => setError(caughtError instanceof Error ? caughtError.message : "Google sign-in failed. Please try again."))
            .finally(() => { if (!disposed) setPending(false); });
        },
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, { theme: "outline", size: "large", shape: "rectangular", text: "continue_with", width: 380 });
    };

    let script = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    if (window.google) renderButton();
    else if (script) script.addEventListener("load", renderButton, { once: true });
    else {
      script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.addEventListener("load", renderButton, { once: true });
      document.head.append(script);
    }
    return () => {
      disposed = true;
      window.google?.accounts.id.cancel();
    };
  }, [googleClientId, isDemoMode, location.state, navigate, signInWithGoogle]);

  if (employee) return <Navigate to="/welcome" replace />;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setPending(true); setError(null);
    try {
      await signIn(email, password, rememberMe);
      const state = location.state as LoginLocationState | null;
      navigate(state?.from ?? "/welcome", { replace: true });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Sign-in failed. Please try again.");
    } finally { setPending(false); }
  };

  return (
    <main className="min-h-dvh bg-app lg:grid lg:grid-cols-[minmax(360px,0.9fr)_minmax(520px,1.1fr)]">
      <section className="relative hidden min-h-dvh overflow-hidden bg-brand-deep px-10 py-10 text-white lg:block xl:px-16 xl:py-14">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="brand-pattern absolute inset-0 opacity-[0.06]" />
          <div className="absolute -right-40 -top-44 size-[34rem] rounded-full bg-lime-300/12 blur-3xl" />
          <div className="absolute -bottom-56 -left-36 size-[28rem] rounded-full bg-emerald-400/15 blur-3xl" />
          <div className="absolute right-[-16%] top-[32%] h-px w-[78%] rotate-[-28deg] bg-gradient-to-r from-transparent via-lime-200/40 to-transparent" />
        </div>
        <div className="relative z-10 flex items-center justify-between">
          <BarkLogo inverse />
          <span className="rounded-full border border-lime-200/30 bg-lime-200/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-lime-100">Operations OS</span>
        </div>
        <div className="relative z-10 mt-[15vh] max-w-[47%] pb-3 xl:mt-[16vh]">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3 py-1.5 text-xs font-medium text-white/80"><Sparkles size={14} className="text-lime-200" /> Supertails internal workspace</span>
          <p className="mt-6 max-w-lg text-[clamp(2.4rem,5vw,4.5rem)] font-semibold leading-[0.98] tracking-[-0.06em]">Calm operations.<br /><span className="text-lime-200">Clear ownership.</span></p>
          <p className="mt-5 max-w-md text-[15px] leading-7 text-white/65">One workspace for bookings, escalations, clinics, and the teams that keep every tail moving.</p>
          <div className="mt-7 flex flex-wrap gap-2.5 text-xs text-white/80">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/10 px-3 py-2"><CheckCircle2 size={14} className="text-lime-200" /> Role-aware</span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/10 px-3 py-2"><ShieldCheck size={14} className="text-lime-200" /> Company access</span>
          </div>
        </div>
        <div className="absolute bottom-24 right-3 z-10 w-[53%] max-w-[430px] xl:right-8" aria-label="Bark workspace preview">
          <div className="absolute -inset-5 rounded-[2rem] bg-lime-200/10 blur-2xl" />
          <div className="relative rotate-[2deg] rounded-[1.35rem] border border-lime-100/25 bg-[#0b2b20]/90 p-2 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <div className="rounded-[1rem] border border-white/10 bg-[#123b2b] p-3">
              <div className="flex items-center gap-2 border-b border-white/10 pb-3 text-[10px] text-white/65">
                <div className="grid size-5 place-items-center rounded-md bg-lime-300 text-[#123b2b]"><Home size={11} /></div>
                <span className="font-semibold text-white/90">Bark workspace</span>
                <span className="ml-auto rounded-full bg-white/10 px-2 py-1">Today</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-white/10 bg-white/[0.06] p-2"><CalendarDays size={13} className="text-lime-200" /><p className="mt-2 text-[9px] text-white/55">Bookings</p><p className="text-lg font-semibold">335</p></div>
                <div className="rounded-lg border border-white/10 bg-white/[0.06] p-2"><AlertTriangle size={13} className="text-orange-300" /><p className="mt-2 text-[9px] text-white/55">Escalations</p><p className="text-lg font-semibold">18</p></div>
                <div className="rounded-lg border border-white/10 bg-white/[0.06] p-2"><Users size={13} className="text-lime-200" /><p className="mt-2 text-[9px] text-white/55">Team online</p><p className="text-lg font-semibold">24</p></div>
              </div>
              <div className="mt-2 grid grid-cols-[1.4fr_0.8fr] gap-2">
                <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3"><div className="flex items-center justify-between"><p className="text-[10px] font-medium">Today's overview</p><BarChart3 size={13} className="text-lime-200" /></div><svg className="mt-2 h-16 w-full" viewBox="0 0 220 64" fill="none" aria-hidden="true"><path d="M2 55C25 48 29 39 49 44C70 49 74 25 96 31C119 37 120 17 143 22C165 27 167 11 188 18C200 22 207 14 218 7V64H2V55Z" fill="url(#chartFill)" /><path d="M2 55C25 48 29 39 49 44C70 49 74 25 96 31C119 37 120 17 143 22C165 27 167 11 188 18C200 22 207 14 218 7" stroke="#b9ff72" strokeWidth="2" strokeLinecap="round" /><defs><linearGradient id="chartFill" x1="110" y1="7" x2="110" y2="64" gradientUnits="userSpaceOnUse"><stop stopColor="#b9ff72" stopOpacity=".3" /><stop offset="1" stopColor="#b9ff72" stopOpacity="0" /></linearGradient></defs></svg></div>
                <div className="space-y-2"><button type="button" className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] p-2 text-left text-[10px] text-white/80"><Plus size={13} className="text-lime-200" /> New booking <ChevronRight size={12} className="ml-auto" /></button><button type="button" className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] p-2 text-left text-[10px] text-white/80"><AlertTriangle size={13} className="text-orange-300" /> Raise escalation <ChevronRight size={12} className="ml-auto" /></button></div>
              </div>
            </div>
          </div>
        </div>
        <p className="absolute bottom-10 left-10 z-10 text-xs text-white/40 xl:left-16">Built for the people who keep every tail moving.</p>
      </section>
      <section className="flex min-h-dvh items-center justify-center px-4 py-8 sm:px-8 lg:px-12">
        <div className="w-full max-w-[460px]">
          <div className="mb-8 lg:hidden"><BarkLogo /></div>
          <div className="mb-7"><p className="text-xs font-semibold tracking-[0.08em] text-brand uppercase">Welcome back</p><h1 className="mt-2 text-[clamp(1.9rem,5vw,2.35rem)] font-semibold tracking-[-0.045em] text-primary">Sign in to Bark</h1><p className="mt-3 text-[15px] leading-6 text-secondary">Your workspace for seamless clinic operations.</p></div>
          <Card className="p-5 sm:p-6">
            {(location.state as LoginLocationState | null)?.message && <p role="status" className="mb-4 rounded-lg bg-success-soft p-3 text-sm text-success">{(location.state as LoginLocationState).message}</p>}
            {googleClientId && !isDemoMode && <div className="mb-5">
              <div ref={googleButtonRef} className="flex min-h-10 justify-center" aria-label="Continue with Google" />
              <div className="mt-5 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-border" /><span>or sign in with email</span><span className="h-px flex-1 bg-border" /></div>
            </div>}
            <div className="mb-5 flex items-start gap-3 rounded-[var(--radius-md)] border border-info-border bg-info-soft p-3.5"><span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-info text-on-brand"><ShieldCheck size={15} /></span><div><p className="text-sm font-semibold text-primary">{isDemoMode ? "Development authentication" : "Secure company access"}</p><p className="mt-1 text-xs leading-5 text-secondary">{isDemoMode ? "Use a fictional employee email from the development dataset." : "Access is controlled by your assigned role, clearance, and clinic permissions."}</p></div></div>
            <form onSubmit={(event) => void handleSubmit(event)}>
              <label htmlFor="email" className="text-sm font-semibold text-primary">Work email</label>
              <input id="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={pending} className="mt-2 min-h-12 w-full rounded-[var(--radius-control)] border border-input bg-input px-3.5 text-sm text-primary outline-none transition-colors hover:border-input-hover focus:border-focus focus:ring-2 focus:ring-focus-soft disabled:opacity-60" />
              <label htmlFor="password" className="mt-4 block text-sm font-semibold text-primary">Password</label>
              <input id="password" type="password" autoComplete="current-password" required={!isDemoMode} value={password} onChange={(event) => setPassword(event.target.value)} disabled={pending} className="mt-2 min-h-12 w-full rounded-[var(--radius-control)] border border-input bg-input px-3.5 text-sm text-primary outline-none transition-colors hover:border-input-hover focus:border-focus focus:ring-2 focus:ring-focus-soft disabled:opacity-60" />
              <label className="mt-4 flex w-fit cursor-pointer items-center gap-2 text-sm text-secondary"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} disabled={pending} className="size-4 accent-brand" />Remember me <span className="text-xs text-muted">(30 days)</span></label>
              {!isDemoMode && <div className="mt-2 flex justify-end"><Link to="/forgot-password" className="text-sm font-medium text-brand-strong hover:underline">Forgot password?</Link></div>}
              {error && <p role="alert" className="mt-4 rounded-[var(--radius-sm)] border border-error-border bg-error-soft px-3 py-2.5 text-sm text-error">{error}</p>}
              <Button type="submit" fullWidth disabled={pending || !email || (!password && !isDemoMode)} className="mt-5 min-h-12" icon={pending ? <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" /> : <LockKeyhole size={17} />}>{pending ? "Signing in…" : "Sign in securely"}</Button>
            </form>
          </Card>
          <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-muted">Access is logged and protected by role-based permissions. <ArrowRight size={13} /></p>
        </div>
      </section>
    </main>
  );
}
