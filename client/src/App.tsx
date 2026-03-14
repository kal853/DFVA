import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Shield, Menu, X } from "lucide-react";
import { useState } from "react";
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

function AccountBadge({ user }: { user: SessionUser }) {
  return (
    <div
      data-testid="badge-account"
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/60 bg-card/40 text-sm"
    >
      <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold uppercase">
        {user.username[0]}
      </div>
      <span className="font-medium text-foreground hidden sm:block">{user.username}</span>
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full hidden sm:block ${PLAN_BADGE_COLORS[user.plan]}`}>
        {PLAN_LABEL[user.plan]}
      </span>
    </div>
  );
}

function NavBar({ user }: { user: SessionUser }) {
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
          <AccountBadge user={user} />
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
      {(user, _setUser) => (
        <div className="min-h-screen flex flex-col bg-background text-foreground">
          <NavBar user={user} />
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
