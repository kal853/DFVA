import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AlertTriangle, ShieldAlert, LayoutDashboard, CreditCard } from "lucide-react";
import Dashboard from "./pages/Dashboard";
import Billing from "./pages/Billing";
import NotFound from "@/pages/not-found";

function WarningBanner() {
  return (
    <div className="bg-destructive text-destructive-foreground px-4 py-2 flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.4)] relative z-50 overflow-hidden">
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, #000 10px, #000 20px)'
      }} />
      <div className="relative flex items-center gap-3 font-display font-bold tracking-wide text-sm sm:text-base animate-pulse">
        <ShieldAlert className="w-5 h-5" />
        <span>DANGER: VULNERABLE APPLICATION FOR DEMONSTRATION PURPOSES</span>
        <AlertTriangle className="w-5 h-5 hidden sm:block" />
      </div>
    </div>
  );
}

function NavBar() {
  const [location] = useLocation();
  const links = [
    { href: "/", label: "Admin Toolkit", icon: LayoutDashboard },
    { href: "/billing", label: "Billing", icon: CreditCard },
  ];
  return (
    <nav className="border-b border-border/60 bg-card/40 backdrop-blur-sm px-6 py-2 flex items-center gap-1">
      {links.map(({ href, label, icon: Icon }) => {
        const active = location === href;
        return (
          <Link key={href} href={href}>
            <span className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all ${
              active
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}>
              <Icon className="w-4 h-4" />
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function Router() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary/30">
      <WarningBanner />
      <NavBar />
      <main className="flex-1 relative">
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/billing" component={Billing} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
