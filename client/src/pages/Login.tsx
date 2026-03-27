import { useState } from "react";
import { useLocation } from "wouter";
import { Shield, Eye, EyeOff, Loader2, AlertCircle, Lock } from "lucide-react";
import { useSession } from "@/lib/session";

export default function Login() {
  const { login } = useSession();
  const [, navigate] = useLocation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
   * VULN (CWE-601 — Open Redirect, client-side source):
   *
   * `next` is read verbatim from the URL query string.  Any value the caller
   * supplies ends up in the `next` parameter of GET /api/auth/redirect.
   *
   * Normal deep-link use:
   *   /login?next=/scans   → after login → GET /api/auth/redirect?next=/scans
   *
   * Phishing attack:
   *   /login?next=https://attacker.io/harvest
   *   → after login → GET /api/auth/redirect?next=https://attacker.io/harvest
   *   → server issues 302 to attacker.io
   *
   * The client reads the value but performs no validation.  All validation
   * responsibility falls on the backend — which also does not validate (see route).
   */
  const nextParam = new URLSearchParams(window.location.search).get("next") ?? "/";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      await login(username.trim(), password);
      /*
       * VULN: POST-LOGIN REDIRECT via /api/auth/redirect
       *
       * After a successful login the browser navigates to the backend redirect
       * endpoint, which performs res.redirect(next) with no validation.
       *
       * `nextParam` comes from window.location.search — the caller controls it.
       * It is appended directly to the redirect URL and sent to the server.
       *
       * Attack:
       *   Attacker sends victim:  /login?next=https://evil.com
       *   Victim logs in → browser hits /api/auth/redirect?next=https://evil.com
       *   Server issues 302 → victim lands on evil.com
       *
       * Easy fix on the SERVER: one guard clause in the route handler.
       * Easy fix on the CLIENT: validate nextParam starts with "/" before use.
       * Neither fix is present — two independent opportunities to stop the attack.
       */
      window.location.href = `/api/auth/redirect?next=${encodeURIComponent(nextParam)}`;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary mb-4">
            <Shield className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">
            SENTIN<span className="text-primary">EL</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="glass-panel rounded-2xl border border-border/60 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="username" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Username
              </label>
              <input
                id="username"
                data-testid="input-username"
                type="text"
                autoComplete="username"
                placeholder="Enter your username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                disabled={loading}
                className="w-full bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  data-testid="input-password"
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={loading}
                  className="w-full bg-input border border-border rounded-xl px-4 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div
                data-testid="text-login-error"
                className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2.5"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <button
              data-testid="button-login-submit"
              type="submit"
              disabled={loading || !username.trim() || !password}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 transition-all"
            >
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Lock className="w-4 h-4" />}
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          {/*
            * VULN (CWE-601 — information disclosure of redirect target):
            * The `nextParam` value is rendered verbatim in the UI.
            * An attacker can pre-fill a convincing redirect destination
            * (e.g. /settings?session_expired=1) to make the phishing link
            * look more legitimate before the user even clicks Sign In.
            */}
          {nextParam !== "/" && (
            <div
              data-testid="text-redirect-hint"
              className="mt-4 text-xs text-muted-foreground/60 text-center truncate"
            >
              You'll be redirected to{" "}
              <span className="font-mono text-muted-foreground">{nextParam}</span>
              {" "}after sign in.
            </div>
          )}

          <div className="mt-4 pt-5 border-t border-border/50 text-center text-xs text-muted-foreground">
            Access is restricted to authorised personnel only.
          </div>
        </div>
      </div>
    </div>
  );
}
