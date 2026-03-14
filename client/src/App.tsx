import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Shield, Menu, X, ChevronDown, LogIn } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import Home from "./pages/Home";
import Tools from "./pages/Tools";
import ToolDetail from "./pages/ToolDetail";
import Pricing from "./pages/Pricing";
import ChatWidget from "@/components/ChatWidget";
import NotFound from "@/pages/not-found";
import {
  SessionContext,
  SessionUser,
  DEMO_ACCOUNTS,
  PLAN_LABEL,
} from "./lib/session";

const PLAN_BADGE_COLORS: Record<string, string> = {
  free:       "bg-muted/50 text-muted-foreground",
  pro:        "bg-primary/10 text-primary",
  enterprise: "bg-amber-500/10 text-amber-400",
};

function AccountMenu({ user, setUser }: { user: SessionUser; setUser: (u: SessionUser) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        data-testid="button-account-menu"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/60 bg-card/40 hover:bg-card/70 transition-all text-sm"
      >
        <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold uppercase">
          {user.username[0]}
        </div>
        <span className="font-medium text-foreground hidden sm:block">{user.username}</span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full hidden sm:block ${PLAN_BADGE_COLORS[user.plan]}`}>
          {PLAN_LABEL[user.plan]}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 glass-panel rounded-xl border border-border/60 shadow-xl overflow-hidden z-50">
          <div className="px-3 py-2 border-b border-border/50">
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Switch account</p>
          </div>
          {DEMO_ACCOUNTS.map(acc => (
            <button
              key={acc.id}
              data-testid={`button-switch-account-${acc.username}`}
              onClick={() => { setUser(acc); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-muted/30 ${acc.id === user.id ? "bg-primary/5" : ""}`}
            >
              <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold uppercase flex-shrink-0">
                {acc.username[0]}
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium text-foreground">{acc.username}</div>
                <div className={`text-[10px] font-bold ${PLAN_BADGE_COLORS[acc.plan]}`}>{PLAN_LABEL[acc.plan]} plan</div>
              </div>
              {acc.id === user.id && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NavBar({ user, setUser }: { user: SessionUser; setUser: (u: SessionUser) => void }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/", label: "Home" },
    { href: "/tools", label: "Tools" },
    { href: "/pricing", label: "Pricing" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/">
          <span className="flex items-center gap-2 cursor-pointer group" data-testid="link-logo">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight">
              SENTIN<span className="text-primary">EL</span>
            </span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map(({ href, label }) => (
            <Link key={href} href={href}>
              <span
                data-testid={`link-nav-${label.toLowerCase()}`}
                className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all ${
                  location === href
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                {label}
              </span>
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <AccountMenu user={user} setUser={setUser} />
          <button className="md:hidden p-2 rounded-lg text-muted-foreground" onClick={() => setOpen(!open)}>
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-border/60 bg-background px-4 py-3 flex flex-col gap-1">
          {links.map(({ href, label }) => (
            <Link key={href} href={href}>
              <span onClick={() => setOpen(false)} className="block px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground cursor-pointer">
                {label}
              </span>
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/60 py-10 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 font-display font-bold text-foreground">
          <Shield className="w-4 h-4 text-primary" />
          SENTIN<span className="text-primary">EL</span>
        </div>
        <p>© 2025 Sentinel Security Inc. For authorised use only.</p>
        <div className="flex gap-4">
          {["Privacy", "Terms", "Docs", "Status"].map(l => (
            <span key={l} className="hover:text-foreground cursor-pointer transition-colors">{l}</span>
          ))}
        </div>
      </div>
    </footer>
  );
}

function SessionProvider({ children }: { children: (user: SessionUser, setUser: (u: SessionUser) => void) => React.ReactNode }) {
  const [user, setUserRaw] = useState<SessionUser>(() => {
    try {
      const stored = localStorage.getItem("sentinel_uid");
      if (stored) {
        const id = parseInt(stored);
        return DEMO_ACCOUNTS.find(a => a.id === id) ?? DEMO_ACCOUNTS[0];
      }
    } catch {}
    return DEMO_ACCOUNTS[0];
  });

  const [sessionUser, setSessionUserState] = useState<SessionUser>(user);

  const setUser = (u: SessionUser) => {
    localStorage.setItem("sentinel_uid", String(u.id));
    setUserRaw(u);
    setSessionUserState(u);
  };

  const refreshUser = async () => {
    try {
      const res = await fetch(`/api/billing/${sessionUser.id}`);
      if (res.ok) {
        const d = await res.json();
        const updated = { ...sessionUser, plan: d.plan, walletBalance: d.walletBalance };
        setSessionUserState(updated);
      }
    } catch {}
  };

  return (
    <SessionContext.Provider value={{ user: sessionUser, setUser, refreshUser }}>
      {children(sessionUser, setUser)}
    </SessionContext.Provider>
  );
}

function Router() {
  return (
    <SessionProvider>
      {(user, setUser) => (
        <div className="min-h-screen flex flex-col bg-background text-foreground">
          <NavBar user={user} setUser={setUser} />
          <main className="flex-1">
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/tools" component={Tools} />
              <Route path="/tools/:slug" component={ToolDetail} />
              <Route path="/pricing" component={Pricing} />
              <Route component={NotFound} />
            </Switch>
          </main>
          <Footer />
          <ChatWidget />
        </div>
      )}
    </SessionProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
