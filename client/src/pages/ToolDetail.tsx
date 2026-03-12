import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft, Shield, Zap, Eye, Globe, Lock, Cpu, Check, ExternalLink } from "lucide-react";
import type { Product } from "@shared/schema";

const CAT_ICONS: Record<string, React.ElementType> = {
  scanning:     Zap,
  osint:        Eye,
  web:          Globe,
  crypto:       Lock,
  intelligence: Cpu,
  auth:         Shield,
};

const TIER_COLORS: Record<string, { badge: string; glow: string; label: string }> = {
  FREE:       { badge: "bg-muted/60 text-muted-foreground border-border/50", glow: "from-muted/30", label: "Free Plan" },
  PRO:        { badge: "bg-primary/10 text-primary border-primary/30", glow: "from-primary/20", label: "Pro Plan" },
  ENTERPRISE: { badge: "bg-amber-500/10 text-amber-400 border-amber-500/30", glow: "from-amber-500/20", label: "Enterprise Plan" },
};

export default function ToolDetail() {
  const { slug } = useParams<{ slug: string }>();

  const { data: tool, isLoading, error } = useQuery<Product>({
    queryKey: ["/api/products", slug],
    queryFn: async () => {
      const res = await fetch(`/api/products/${slug}`);
      if (!res.ok) throw new Error("Tool not found");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16">
        <div className="animate-pulse space-y-6">
          <div className="h-6 w-24 rounded bg-card/50" />
          <div className="h-12 w-2/3 rounded bg-card/50" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
            <div className="lg:col-span-2 h-64 rounded-xl bg-card/50" />
            <div className="h-64 rounded-xl bg-card/50" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !tool) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center">
        <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
        <h2 className="text-xl font-display font-bold mb-2">Tool not found</h2>
        <Link href="/tools"><span className="text-primary hover:underline cursor-pointer">Back to tools</span></Link>
      </div>
    );
  }

  const Icon = CAT_ICONS[tool.category] ?? Shield;
  const tier = (tool.badge ?? "FREE") as keyof typeof TIER_COLORS;
  const tierInfo = TIER_COLORS[tier] ?? TIER_COLORS.FREE;
  const specs = tool.specs ? JSON.parse(tool.specs) : {};
  const apiCalls = parseInt(tool.stock?.toString() ?? "0");

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link href="/tools">
        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> All tools
        </span>
      </Link>

      {/* Header */}
      <div className={`rounded-2xl bg-gradient-to-r ${tierInfo.glow} to-transparent border border-border/50 p-8 mb-8`}>
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          <div className="p-4 rounded-xl bg-primary/10 text-primary flex-shrink-0">
            <Icon className="w-8 h-8" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-widest ${tierInfo.badge}`}>
                {tier}
              </span>
              <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full capitalize">{tool.category}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground">{tool.name}</h1>
            <p className="text-muted-foreground mt-2 leading-relaxed max-w-2xl">{tool.longDescription || tool.description}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Specs */}
        <div className="lg:col-span-2 space-y-6">
          {Object.keys(specs).length > 0 && (
            <div>
              <h2 className="text-lg font-display font-bold text-foreground mb-4">Capabilities</h2>
              <div className="rounded-xl border border-border/60 overflow-hidden">
                {Object.entries(specs).filter(([k]) => k !== "api_calls").map(([key, val], i) => (
                  <div key={key} className={`flex gap-4 px-5 py-3 text-sm ${i % 2 === 0 ? "bg-card/40" : "bg-card/20"}`}>
                    <span className="text-muted-foreground font-medium min-w-[130px] capitalize">{key.replace(/_/g, " ")}</span>
                    <span className="text-foreground font-mono">{val as string}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar — get access */}
        <div className="space-y-4">
          <div className="glass-panel rounded-xl p-6 border border-border/60">
            <h3 className="font-display font-bold text-foreground mb-1">Get Access</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {tool.name} is included in the <span className="text-foreground font-medium">{tierInfo.label}</span> and above.
            </p>

            <div className="space-y-2 mb-5">
              {[
                `${apiCalls >= 999999 ? "Unlimited" : apiCalls.toLocaleString()} API calls/month`,
                "REST API access",
                "Full documentation",
                "Priority support (Pro+)",
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  {f}
                </div>
              ))}
            </div>

            <Link href="/pricing">
              <button
                data-testid="button-get-access"
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-semibold transition-all"
              >
                See Plans <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </Link>

            {tier === "FREE" && (
              <p className="text-xs text-muted-foreground text-center mt-3">Available on all plans including Free</p>
            )}
          </div>

          <div className="glass-panel rounded-xl p-5 border border-border/60">
            <h4 className="text-sm font-display font-bold text-foreground mb-3">API endpoint</h4>
            <code className="text-xs font-mono text-primary bg-primary/5 px-3 py-2 rounded-lg block break-all">
              POST /v1/tools/{tool.slug}
            </code>
            <p className="text-xs text-muted-foreground mt-2">Authenticate with your API key in the <code className="text-primary">Authorization</code> header.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
