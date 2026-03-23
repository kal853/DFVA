import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Shield, Menu, X, LogOut, LogIn } from "lucide-react";
import { useState } from "react";
import Home from "./pages/Home";
import Tools from "./pages/Tools";
import ToolDetail from "./pages/ToolDetail";
import Pricing from "./pages/Pricing";
import Login from "./pages/Login";
import KnowledgeBase from "./pages/KnowledgeBase";
import Scans from "./pages/Scans";
import Register from "./pages/Register";
import Wallet from "./pages/Wallet";
import Workspaces from "./pages/Workspaces";
import InviteAccept from "./pages/InviteAccept";
import ChatWidget from "@/components/ChatWidget";
import NotFound from "@/pages/not-found";
import { SessionContext, SessionUser, PLAN_LABEL, useSession } from "./lib/session";

const PLAN_BADGE_COLORS: Record<string, string> = {
  free:       "bg-muted/50 text-muted-foreground",
  pro:        "bg-primary/10 text-primary",
  enterprise: "bg-amber-500/10 text-amber-400",
};

type NavBarProps = {
  user: SessionUser | null;
  onLogout: () => void;
};

function NavBar({ user, onLogout }: NavBarProps) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/", label: "Home" },
    { href: "/tools", label: "Tools" },
    { href: "/pricing", label: "Pricing" },
    ...(user ? [
      { href: "/scans", label: "Scans" },
      { href: "/knowledge-base", label: "Knowledge Base" },
      { href: "/wallet", label: "Wallet" },
      { href: "/workspaces", label: "Workspaces" },
    ] : []),
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/">
          <span className="flex items-center gap-2 cursor-pointer" data-testid="link-logo">
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

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <div
                data-testid="badge-account"
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/60 bg-card/40 text-sm"
              >
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold uppercase">
                  {user.username[0]}
                </div>
                <span className="font-medium text-foreground">{user.username}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${PLAN_BADGE_COLORS[user.plan]}`}>
                  {PLAN_LABEL[user.plan]}
                </span>
              </div>
              <button
                data-testid="button-logout"
                onClick={onLogout}
                title="Sign out"
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <Link href="/login">
              <span
                data-testid="button-sign-in"
                className="hidden md:inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer transition-all"
              >
                <LogIn className="w-4 h-4" /> Sign In
              </span>
            </Link>
          )}
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
          {user ? (
            <button onClick={() => { onLogout(); setOpen(false); }} className="text-left px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-2">
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          ) : (
            <Link href="/login">
              <span onClick={() => setOpen(false)} className="block px-3 py-2 rounded-lg text-sm font-medium text-primary cursor-pointer">
                Sign In
              </span>
            </Link>
          )}
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

function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => {
    try {
      const stored = localStorage.getItem("sentinel_session");
      if (stored) return JSON.parse(stored) as SessionUser;
    } catch {}
    return null;
  });

  const login = async (username: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.message);
    // Store the JWT — VULN: token is accepted without signature if alg header is changed to "none"
    if (d.token) localStorage.setItem("sentinel_token", d.token);
    const u: SessionUser = { id: d.id, username: d.username, plan: d.plan, walletBalance: d.walletBalance };
    localStorage.setItem("sentinel_session", JSON.stringify(u));
    setUser(u);
  };

  const logout = () => {
    localStorage.removeItem("sentinel_session");
    localStorage.removeItem("sentinel_token");
    setUser(null);
    queryClient.clear();
  };

  const refreshUser = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/billing/${user.id}`);
      if (res.ok) {
        const d = await res.json();
        const updated: SessionUser = { ...user, plan: d.plan, walletBalance: d.walletBalance };
        localStorage.setItem("sentinel_session", JSON.stringify(updated));
        setUser(updated);
      }
    } catch {}
  };

  return (
    <SessionContext.Provider value={{ user, isLoggedIn: !!user, login, logout, refreshUser }}>
      {children}
    </SessionContext.Provider>
  );
}

function AppShell() {
  const [location, navigate] = useLocation();
  const { user, logout } = useSession();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {location !== "/login" && <NavBar user={user} onLogout={handleLogout} />}
      <main className="flex-1">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/tools" component={Tools} />
          <Route path="/tools/:slug" component={ToolDetail} />
          <Route path="/pricing" component={Pricing} />
          <Route path="/login" component={Login} />
          <Route path="/knowledge-base" component={KnowledgeBase} />
          <Route path="/scans" component={Scans} />
          <Route path="/register" component={Register} />
          <Route path="/wallet" component={Wallet} />
          <Route path="/workspaces" component={Workspaces} />
          <Route path="/invite/:token" component={InviteAccept} />
          <Route component={NotFound} />
        </Switch>
      </main>
      {location !== "/login" && <Footer />}
      {location !== "/login" && <ChatWidget />}
    </div>
  );
}

function Router() {
  return (
    <SessionProvider>
      <AppShell />
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
