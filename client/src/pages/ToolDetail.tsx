import { useQuery } from "@tanstack/react-query";
import { useParams, Link, useSearch } from "wouter";
import { ArrowLeft, Shield, Zap, Eye, Globe, Lock, Cpu, Check, ExternalLink, Star } from "lucide-react";
import type { Product } from "@shared/schema";
import { useSession, canAccessTool, PLAN_RANK } from "@/lib/session";

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

const UPGRADE_TO: Record<string, string> = {
  PRO:        "Pro",
  ENTERPRISE: "Enterprise",
};

export default function ToolDetail() {
  const { slug } = useParams<{ slug: string }>();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const previewMode = params.get("access") === "preview";

  const { user, isLoggedIn } = useSession();
  const guestPlan = "free";

  const { data: tool, isLoading, error } = useQuery<Product>({
    queryKey: ["/api/products", slug],
    queryFn: async () => {
      const res = await fetch(`/api/products/${slug}`);
      if (!res.ok) throw new Error("Tool not found");
      return res.json();
    },
  });

  // VULN: access check trusts X-Plan-Override header without authentication
  const { data: accessData } = useQuery<{ access: boolean; via?: string }>({
    queryKey: ["/api/access/check", slug, previewMode],
    queryFn: async () => {
      const headers: Record<string, string> = {};
      if (previewMode) headers["X-Plan-Override"] = "enterprise";
      const res = await fetch(`/api/access/check?slug=${slug}&userId=${user.id}`, { headers });
      return res.json();
    },
    enabled: !!slug,
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

  const hasAccess = accessData?.access ?? canAccessTool(user?.plan ?? guestPlan, tier);
  const locked = !hasAccess;

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
        {/* Specs / Paywall */}
        <div className="lg:col-span-2 space-y-6">
          {Object.keys(specs).length > 0 && (
            <div className="relative">
              <h2 className="text-lg font-display font-bold text-foreground mb-4">Capabilities</h2>

              {/* Paywall overlay */}
              {locked && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl bg-background/70 backdrop-blur-[3px] border border-border/60">
                  <div className="text-center p-8 max-w-xs">
                    <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
                      {tier === "ENTERPRISE" ? <Star className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
                    </div>
                    <h3 className="font-display font-bold text-foreground mb-2">
                      {UPGRADE_TO[tier] ?? "Pro"} required
                    </h3>
                    <p className="text-sm text-muted-foreground mb-5">
                      Upgrade to the <strong>{tierInfo.label}</strong> to unlock full access to {tool.name} and its capabilities.
                    </p>
                    <Link href="/pricing">
                      <button
                        data-testid="button-paywall-upgrade"
                        className="w-full bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold transition-all"
                      >
                        Upgrade to {UPGRADE_TO[tier] ?? "Pro"}
                      </button>
                    </Link>
                  </div>
                </div>
              )}

              <div className={`rounded-xl border border-border/60 overflow-hidden ${locked ? "blur-[2px] select-none pointer-events-none" : ""}`}>
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

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="glass-panel rounded-xl p-6 border border-border/60">
            <h3 className="font-display font-bold text-foreground mb-1">
              {hasAccess ? "You have access" : "Get Access"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {hasAccess
                ? `${tool.name} is included in your current plan.`
                : `${tool.name} requires the ${tierInfo.label} or higher.`}
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

            {hasAccess ? (
              <div
                data-testid="status-tool-access"
                className="w-full flex items-center justify-center gap-2 bg-primary/10 text-primary border border-primary/30 rounded-lg py-2.5 text-sm font-semibold"
              >
                <Check className="w-4 h-4" /> Active on your plan
              </div>
            ) : (
              <Link href="/pricing">
                <button
                  data-testid="button-get-access"
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-semibold transition-all"
                >
                  See Plans <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </Link>
            )}

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
