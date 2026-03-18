import { useState } from "react";
import { useLocation } from "wouter";
import { Shield, UserPlus, Eye, EyeOff, Gift, ArrowRight, AlertCircle } from "lucide-react";
import { useSession } from "@/lib/session";
import { useToast } from "@/hooks/use-toast";

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { login } = useSession();

  const [form, setForm] = useState({
    username: "", password: "", email: "", fullName: "", referralCode: "",
  });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function set(k: keyof typeof form, v: string) {
    setForm(f => ({ ...f, [k]: v }));
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.username || !form.password) { setError("Username and password are required."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message); return; }
      // Auto-login after registration
      await login(form.username, form.password);
      toast({ title: "Account created!", description: "Welcome to SENTINEL." });
      setLocation("/");
    } catch {
      setError("Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 items-center justify-center mb-4">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold font-display tracking-tight text-foreground">
            Create your account
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Start securing your infrastructure with SENTINEL
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          data-testid="form-register"
          className="rounded-2xl border border-border/60 bg-card/40 p-7 space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Full name</label>
              <input
                data-testid="input-fullname"
                type="text"
                value={form.fullName}
                onChange={e => set("fullName", e.target.value)}
                placeholder="Jane Smith"
                className="w-full px-3 py-2 rounded-lg bg-input text-foreground border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Email</label>
              <input
                data-testid="input-email"
                type="email"
                value={form.email}
                onChange={e => set("email", e.target.value)}
                placeholder="jane@example.com"
                className="w-full px-3 py-2 rounded-lg bg-input text-foreground border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Username <span className="text-red-400">*</span></label>
            <input
              data-testid="input-username"
              type="text"
              value={form.username}
              onChange={e => set("username", e.target.value)}
              placeholder="jdoe"
              className="w-full px-3 py-2 rounded-lg bg-input text-foreground border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Password <span className="text-red-400">*</span></label>
            <div className="relative">
              <input
                data-testid="input-password"
                type={showPw ? "text" : "password"}
                value={form.password}
                onChange={e => set("password", e.target.value)}
                placeholder="Choose a strong password"
                className="w-full px-3 py-2 pr-9 rounded-lg bg-input text-foreground border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
              <button
                type="button"
                data-testid="button-toggle-password"
                onClick={() => setShowPw(x => !x)}
                className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Referral code — the C1 exploit entry point */}
          <div className="rounded-lg bg-primary/5 border border-primary/15 p-3">
            <label className="flex items-center gap-1.5 text-xs text-primary font-semibold mb-1.5">
              <Gift className="w-3 h-3" /> Referral Code
              <span className="text-muted-foreground font-normal ml-1">(optional — get $25 for your referrer)</span>
            </label>
            <input
              data-testid="input-referral-code"
              type="text"
              value={form.referralCode}
              onChange={e => set("referralCode", e.target.value.toUpperCase())}
              placeholder="REF-XXXXXX"
              className="w-full px-3 py-2 rounded-lg bg-input text-foreground border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono uppercase"
            />
            <p className="text-[10px] text-muted-foreground mt-1.5">
              Your referrer will receive $25 wallet credit instantly upon your registration.
            </p>
          </div>

          {error && (
            <div
              data-testid="banner-register-error"
              className="flex items-center gap-2 text-sm text-red-400 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <button
            data-testid="button-submit-register"
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <span className="animate-pulse">Creating account…</span>
            ) : (
              <><UserPlus className="w-4 h-4" /> Create Account</>
            )}
          </button>

          <p className="text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <a
              href="/login"
              data-testid="link-go-login"
              className="text-primary hover:underline"
            >
              Sign in <ArrowRight className="w-3 h-3 inline" />
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
