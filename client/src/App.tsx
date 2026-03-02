import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import Dashboard from "./pages/Dashboard";
import NotFound from "@/pages/not-found";

function WarningBanner() {
  return (
    <div className="bg-destructive text-destructive-foreground px-4 py-2 flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.4)] relative z-50 overflow-hidden">
      {/* Striped warning pattern background */}
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

function Router() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary/30">
      <WarningBanner />
      
      {/* Main Content Area */}
      <main className="flex-1 relative">
        <Switch>
          <Route path="/" component={Dashboard}/>
          {/* Fallback to 404 */}
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
