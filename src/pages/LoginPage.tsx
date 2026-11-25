import { ArrowRight, CheckCircle2, LockKeyhole, ShieldCheck } from "lucide-react";
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
      <section className="relative hidden min-h-dvh overflow-hidden bg-brand-deep px-10 py-10 text-white lg:flex lg:flex-col xl:px-16 xl:py-14">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="brand-pattern absolute inset-0 opacity-[0.06]" />
          <div className="absolute -right-40 -top-44 size-[34rem] rounded-full bg-lime-300/12 blur-3xl" />
          <div className="absolute -bottom-56 -left-36 size-[28rem] rounded-full bg-emerald-400/15 blur-3xl" />
          <div className="absolute right-[-16%] top-[32%] h-px w-[78%] rotate-[-28deg] bg-gradient-to-r from-transparent via-lime-200/40 to-transparent" />
        </div>
        <div className="relative z-10 flex items-center gap-3">
          <BarkLogo inverse />
          <span className="h-5 w-px bg-white/20" aria-hidden="true" />
          <span className="text-xs font-medium tracking-wide text-white/55">Supertails</span>
        </div>
        <div className="relative z-10 flex flex-1 items-center">
          <div className="max-w-2xl pb-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-lime-200/80">Bark / Supertails</p>
            <div className="mt-7 h-px w-16 bg-lime-200/70" aria-hidden="true" />
            <p className="mt-7 max-w-xl text-[clamp(2.5rem,5vw,4.65rem)] font-semibold leading-[0.97] tracking-[-0.065em]">The Supertails<br /><span className="text-lime-200">SuperTool.</span></p>
            <p className="mt-6 max-w-md text-[15px] leading-7 text-white/65">Bookings, escalations, and team updates brought together for the people keeping every tail moving.</p>
            <div className="mt-9 grid max-w-md grid-cols-2 gap-x-7 gap-y-3 border-t border-white/15 pt-5 text-sm text-white/75">
              <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} className="text-lime-200" /> Role-aware access</span>
              <span className="inline-flex items-center gap-2"><ShieldCheck size={16} className="text-lime-200" /> Company workspace</span>
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
