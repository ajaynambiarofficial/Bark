import { ArrowRight, CheckCircle2, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { Link } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { BarkLogo } from "../components/brand/BarkLogo";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

interface LoginLocationState { from?: string; message?: string }

export function LoginPage() {
  const { employee, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDemoMode = import.meta.env.VITE_USE_MOCK_AUTH === "true";

  if (employee) return <Navigate to="/welcome" replace />;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setPending(true); setError(null);
    try {
      await signIn(email, password);
      const state = location.state as LoginLocationState | null;
      navigate(state?.from ?? "/welcome", { replace: true });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Sign-in failed. Please try again.");
    } finally { setPending(false); }
  };

  return (
    <main className="min-h-dvh bg-app lg:grid lg:grid-cols-[minmax(360px,0.9fr)_minmax(520px,1.1fr)]">
      <section className="relative hidden min-h-dvh overflow-hidden bg-brand-deep px-10 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-16 xl:py-14">
        <div className="absolute inset-0 opacity-[0.07]" aria-hidden="true"><div className="brand-pattern h-full w-full" /></div>
        <div className="relative z-10"><BarkLogo inverse /></div>
        <div className="relative z-10 max-w-xl pb-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/8 px-3 py-1.5 text-xs font-medium text-white/82"><Sparkles size={14} /> Supertails internal workspace</span>
          <p className="mt-7 max-w-lg text-[clamp(2.4rem,5vw,4.5rem)] font-semibold leading-[1.02] tracking-[-0.055em]">Calm operations.<br />Clear ownership.</p>
          <p className="mt-6 max-w-md text-[15px] leading-7 text-white/68">Bark brings clinic teams and central operations into one comfortable workspace for everyday coordination.</p>
          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/76"><span className="inline-flex items-center gap-2"><CheckCircle2 size={16} /> Role-aware workspace</span><span className="inline-flex items-center gap-2"><ShieldCheck size={16} /> Company access</span></div>
        </div>
        <p className="relative z-10 text-xs text-white/45">Built for the people who keep every tail moving.</p>
      </section>
      <section className="flex min-h-dvh items-center justify-center px-4 py-8 sm:px-8 lg:px-12">
        <div className="w-full max-w-[460px]">
          <div className="mb-8 lg:hidden"><BarkLogo /></div>
          <div className="mb-7"><p className="text-xs font-semibold tracking-[0.08em] text-brand uppercase">Welcome back</p><h1 className="mt-2 text-[clamp(1.9rem,5vw,2.35rem)] font-semibold tracking-[-0.045em] text-primary">Sign in to Bark</h1><p className="mt-3 text-[15px] leading-6 text-secondary">Your workspace for seamless clinic operations.</p></div>
          <Card className="p-5 sm:p-6">
            {(location.state as LoginLocationState | null)?.message && <p role="status" className="mb-4 rounded-lg bg-success-soft p-3 text-sm text-success">{(location.state as LoginLocationState).message}</p>}
            <div className="mb-5 flex items-start gap-3 rounded-[var(--radius-md)] border border-info-border bg-info-soft p-3.5"><span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-info text-on-brand"><ShieldCheck size={15} /></span><div><p className="text-sm font-semibold text-primary">{isDemoMode ? "Development authentication" : "Secure company access"}</p><p className="mt-1 text-xs leading-5 text-secondary">{isDemoMode ? "Use a fictional employee email from the development dataset." : "Access is controlled by your assigned role, clearance, and clinic permissions."}</p></div></div>
            <form onSubmit={(event) => void handleSubmit(event)}>
              <label htmlFor="email" className="text-sm font-semibold text-primary">Work email</label>
              <input id="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={pending} className="mt-2 min-h-12 w-full rounded-[var(--radius-control)] border border-input bg-input px-3.5 text-sm text-primary outline-none transition-colors hover:border-input-hover focus:border-focus focus:ring-2 focus:ring-focus-soft disabled:opacity-60" />
              <label htmlFor="password" className="mt-4 block text-sm font-semibold text-primary">Password</label>
              <input id="password" type="password" autoComplete="current-password" required={!isDemoMode} value={password} onChange={(event) => setPassword(event.target.value)} disabled={pending} className="mt-2 min-h-12 w-full rounded-[var(--radius-control)] border border-input bg-input px-3.5 text-sm text-primary outline-none transition-colors hover:border-input-hover focus:border-focus focus:ring-2 focus:ring-focus-soft disabled:opacity-60" />
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
