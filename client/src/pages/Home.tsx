import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowRight, Shield, Zap, Globe, Lock, Eye, Cpu, ChevronRight, Star } from "lucide-react";
import type { Product } from "@shared/schema";

const TIER_COLORS: Record<string, string> = {
  FREE:       "bg-muted/60 text-muted-foreground border-border/50",
  PRO:        "bg-primary/10 text-primary border-primary/30",
  ENTERPRISE: "bg-amber-500/10 text-amber-400 border-amber-500/30",
};

const CAT_ICONS: Record<string, React.ElementType> = {
  scanning:     Zap,
  osint:        Eye,
  web:          Globe,
  crypto:       Lock,
  intelligence: Cpu,
  auth:         Shield,
};

function ToolCard({ tool, index }: { tool: Product; index: number }) {
  const Icon = CAT_ICONS[tool.category] ?? Shield;
  const tier = tool.badge ?? "FREE";

  return (
    <Link href={`/tools/${tool.slug}`}>
      <div
        data-testid={`card-tool-${tool.id}`}
        className="group glass-panel rounded-xl p-5 flex flex-col gap-4 cursor-pointer hover-elevate border border-border/50 h-full"
        style={{ animationDelay: `${index * 60}ms` }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
            <Icon className="w-5 h-5" />
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-widest ${TIER_COLORS[tier]}`}>
            {tier}
          </span>
        </div>
        <div>
          <h3 className="font-display font-bold text-foreground group-hover:text-primary transition-colors">
            {tool.name}
          </h3>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">{tool.description}</p>
        </div>
        <div className="flex items-center gap-1 text-xs text-primary font-medium mt-auto">
          View tool <ChevronRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </Link>
  );
}

const HOW_IT_WORKS = [
  { step: "01", title: "Choose your plan", desc: "Pick Free, Pro, or Enterprise based on your team's needs." },
  { step: "02", title: "Access your tools", desc: "Log in and immediately use every tool in your tier — no setup, no installs." },
  { step: "03", title: "Run at scale", desc: "Use the REST API to integrate into your CI/CD pipeline or SIEM workflow." },
];

const STATS = [
  { value: "10+", label: "Security Tools" },
  { value: "40k+", label: "Active Users" },
  { value: "99.9%", label: "Uptime SLA" },
  { value: "< 60s", label: "IOC Delivery" },
];

export default function Home() {
  const { data: featured, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products/featured"],
    queryFn: async () => {
      const res = await fetch("/api/products/featured");
      return res.json();
    },
  });

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 relative text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-6">
            <Shield className="w-3.5 h-3.5" />
            Professional Security Tools — One Subscription
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-display font-bold text-foreground leading-tight mb-6">
            The security toolkit<br />
            <span className="text-primary">built for professionals.</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed mb-10 max-w-2xl mx-auto">
            Scanners, OSINT frameworks, credential auditors, and threat intelligence — all in one subscription. Start free, scale to enterprise.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/pricing">
              <span data-testid="button-hero-cta" className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-lg px-7 py-3.5 font-semibold text-base cursor-pointer transition-all">
                Start Free <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
            <Link href="/tools">
              <span className="inline-flex items-center gap-2 border border-border rounded-lg px-7 py-3.5 font-semibold text-base text-muted-foreground hover:text-foreground cursor-pointer transition-all">
                Browse Tools
              </span>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-16 max-w-2xl mx-auto">
            {STATS.map(({ value, label }) => (
              <div key={label} className="text-center">
                <p className="text-3xl font-display font-bold text-primary">{value}</p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured tools */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-display font-bold text-foreground">Featured Tools</h2>
            <p className="text-muted-foreground mt-1">The tools security teams use most.</p>
          </div>
          <Link href="/tools">
            <span className="flex items-center gap-1.5 text-sm text-primary hover:underline cursor-pointer font-medium">
              All tools <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => <div key={i} className="h-44 rounded-xl bg-card/50 animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {featured?.map((t, i) => <ToolCard key={t.id} tool={t} index={i} />)}
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="border-y border-border/50 bg-card/20 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-display font-bold text-foreground text-center mb-12">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map(({ step, title, desc }) => (
              <div key={step} className="flex flex-col items-center text-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-display font-bold text-primary text-lg">
                  {step}
                </div>
                <h3 className="font-display font-bold text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl font-display font-bold text-foreground mb-6">Browse by category</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { key: "scanning", label: "Scanning", icon: Zap },
            { key: "osint", label: "OSINT", icon: Eye },
            { key: "web", label: "Web App", icon: Globe },
            { key: "crypto", label: "Crypto", icon: Lock },
            { key: "intelligence", label: "Intelligence", icon: Cpu },
            { key: "auth", label: "Auth", icon: Shield },
          ].map(({ key, label, icon: Icon }) => (
            <Link key={key} href={`/tools?category=${key}`}>
              <div className="glass-panel rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer hover-elevate group border border-border/50">
                <Icon className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="rounded-2xl bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border border-primary/20 p-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-2xl font-display font-bold text-foreground">Ready to start?</h3>
            <p className="text-muted-foreground mt-1">Free plan includes NullScan and DNSReaper — no credit card required.</p>
          </div>
          <Link href="/pricing">
            <span className="whitespace-nowrap inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-lg px-6 py-3 font-semibold cursor-pointer transition-all">
              See Pricing <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}
