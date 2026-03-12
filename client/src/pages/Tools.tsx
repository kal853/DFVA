import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { Search, Shield, Zap, Eye, Globe, Lock, Cpu, ChevronRight, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import type { Product } from "@shared/schema";

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "scanning", label: "Scanning" },
  { key: "osint", label: "OSINT" },
  { key: "web", label: "Web App" },
  { key: "crypto", label: "Crypto" },
  { key: "intelligence", label: "Intelligence" },
  { key: "auth", label: "Auth" },
];

const CAT_ICONS: Record<string, React.ElementType> = {
  scanning:     Zap,
  osint:        Eye,
  web:          Globe,
  crypto:       Lock,
  intelligence: Cpu,
  auth:         Shield,
};

const TIER_COLORS: Record<string, string> = {
  FREE:       "bg-muted/60 text-muted-foreground border-border/50",
  PRO:        "bg-primary/10 text-primary border-primary/30",
  ENTERPRISE: "bg-amber-500/10 text-amber-400 border-amber-500/30",
};

const TIER_FILTERS = ["all", "FREE", "PRO", "ENTERPRISE"] as const;

function ToolCard({ tool, index }: { tool: Product; index: number }) {
  const Icon = CAT_ICONS[tool.category] ?? Shield;
  const tier = tool.badge ?? "FREE";

  return (
    <Link href={`/tools/${tool.slug}`}>
      <div
        data-testid={`card-tool-${tool.id}`}
        className="group glass-panel rounded-xl p-5 flex flex-col gap-4 cursor-pointer hover-elevate border border-border/50 h-full"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
            <Icon className="w-5 h-5" />
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-widest ${TIER_COLORS[tier]}`}>
            {tier}
          </span>
        </div>
        <div className="flex-1">
          <h3 className="font-display font-bold text-foreground group-hover:text-primary transition-colors">{tool.name}</h3>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed line-clamp-3">{tool.description}</p>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-mono">
            {parseInt(tool.stock?.toString() ?? "0").toLocaleString()} calls/mo
          </span>
          <span className="flex items-center gap-1 text-xs text-primary font-medium">
            Details <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function Tools() {
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);
  const [category, setCategory] = useState(params.get("category") || "all");
  const [tier, setTier] = useState<string>("all");
  const [q, setQ] = useState("");

  const { data: tools, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products", { category, q }],
    queryFn: async () => {
      const url = new URL("/api/products", window.location.origin);
      if (q) url.searchParams.set("q", q);
      else if (category !== "all") url.searchParams.set("category", category);
      const res = await fetch(url.toString());
      return res.json();
    },
  });

  const filtered = tools?.filter(t => tier === "all" || t.badge === tier) ?? [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-foreground mb-2">Security Tools</h1>
        <p className="text-muted-foreground">All tools available in your subscription tier.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 mb-8">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              data-testid="input-tool-search"
              type="text"
              placeholder="Search tools..."
              value={q}
              onChange={e => { setQ(e.target.value); setCategory("all"); }}
              className="w-full pl-10 pr-4 py-2.5 bg-input text-foreground border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Category:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                data-testid={`button-category-${cat.key}`}
                onClick={() => { setCategory(cat.key); setQ(""); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  category === cat.key && !q
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-2">
            <span className="text-xs text-muted-foreground font-medium">Tier:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TIER_FILTERS.map(t => (
              <button
                key={t}
                data-testid={`button-tier-${t}`}
                onClick={() => setTier(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  tier === t
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "all" ? "All Tiers" : t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(9)].map((_, i) => <div key={i} className="h-48 rounded-xl bg-card/50 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No tools found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((t, i) => <ToolCard key={t.id} tool={t} index={i} />)}
        </div>
      )}
    </div>
  );
}
