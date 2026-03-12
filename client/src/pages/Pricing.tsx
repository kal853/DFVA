import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ArrowUp, ArrowDown, Wallet, CreditCard, Loader2, Shield, Zap, Star } from "lucide-react";
import { api } from "@shared/routes";
import { PLANS } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

const PLAN_ORDER = ["free", "pro", "enterprise"] as const;

const PLAN_UI: Record<string, {
  icon: React.ElementType;
  color: string;
  highlight: boolean;
  perks: string[];
  tools: string;
}> = {
  free: {
    icon: Zap,
    color: "border-border/60",
    highlight: false,
    perks: [
      "NullScan — port scanner",
      "DNSReaper — DNS enumeration",
      "5,000 API calls / month",
      "Community support",
      "REST API access",
    ],
    tools: "2 tools",
  },
  pro: {
    icon: Shield,
    color: "border-primary/40 ring-1 ring-primary/20",
    highlight: true,
    perks: [
      "Everything in Free",
      "WebProbe — web app scanner",
      "VaultBreach — password auditor",
      "PhantomTrace — OSINT framework",
      "CipherAudit — TLS analyser",
      "PacketVault — traffic analyser",
      "50,000 API calls / month",
      "Priority support",
      "CI/CD integrations",
    ],
    tools: "7 tools",
  },
  enterprise: {
    icon: Star,
    color: "border-amber-500/30",
    highlight: false,
    perks: [
      "Everything in Pro",
      "ThreatFeed Pro — live intelligence",
      "LogSentinel — cloud SIEM",
      "ShadowBrute — credential testing",
      "Unlimited API calls",
      "Dedicated support engineer",
      "SSO / SAML",
      "Self-hosted deployment",
      "99.9% SLA",
    ],
    tools: "All 10 tools",
  },
};

async function apiFetch(url: string, body: object) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

export default function Pricing() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [userId, setUserId] = useState(2);
  const [paymentMethod, setPaymentMethod] = useState("card_4242");
  const [topupAmount, setTopupAmount] = useState("25");
  const [log, setLog] = useState<string[]>([]);

  const addLog = (msg: string) => setLog(p => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...p.slice(0, 19)]);

  const { data: billing, isLoading } = useQuery({
    queryKey: ["/api/billing", userId],
    queryFn: async () => {
      const res = await fetch(`/api/billing/${userId}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      return d;
    },
  });

  const upgrade = useMutation({
    mutationFn: (plan: string) => apiFetch(api.billing.upgrade.path, { userId, targetPlan: plan, paymentMethod }),
    onSuccess: d => { addLog(`Upgraded → ${d.plan}. Credits: $${d.walletBalance}`); qc.invalidateQueries({ queryKey: ["/api/billing", userId] }); toast({ title: "Plan upgraded", description: `Now on ${d.plan} plan` }); },
    onError: (e: Error) => { addLog(`Error: ${e.message}`); toast({ title: "Error", description: e.message, variant: "destructive" }); },
  });

  const downgrade = useMutation({
    mutationFn: (plan: string) => apiFetch(api.billing.downgrade.path, { userId, targetPlan: plan }),
    onSuccess: d => { addLog(`Downgraded. Refund: $${d.refundAmount}. Credits: $${d.walletBalance}`); qc.invalidateQueries({ queryKey: ["/api/billing", userId] }); },
    onError: (e: Error) => { addLog(`Error: ${e.message}`); },
  });

  const topup = useMutation({
    mutationFn: () => apiFetch(api.billing.topup.path, { userId, amount: parseFloat(topupAmount) }),
    onSuccess: d => { addLog(`Credits topped up. Balance: $${d.walletBalance}`); qc.invalidateQueries({ queryKey: ["/api/billing", userId] }); },
    onError: (e: Error) => addLog(`Error: ${e.message}`),
  });

  const busy = upgrade.isPending || downgrade.isPending || topup.isPending;
  const currentPlanIdx = billing ? PLAN_ORDER.indexOf(billing.plan as any) : -1;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
      {/* Header */}
      <div className="text-center mb-14">
        <h1 className="text-4xl sm:text-5xl font-display font-bold text-foreground mb-3">
          Simple, transparent pricing
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          One subscription. All the tools your security team needs. Cancel anytime.
        </p>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-14">
        {PLAN_ORDER.map((planKey, idx) => {
          const plan = PLANS[planKey];
          const ui = PLAN_UI[planKey];
          const Icon = ui.icon;
          const isCurrent = billing?.plan === planKey;
          const isHigher = idx > currentPlanIdx;
          const isLower = idx < currentPlanIdx;

          return (
            <div
              key={planKey}
              data-testid={`card-plan-${planKey}`}
              className={`relative glass-panel rounded-2xl p-7 border flex flex-col gap-5 ${ui.color} ${ui.highlight ? "shadow-lg shadow-primary/10" : ""}`}
            >
              {ui.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wider">
                  Most Popular
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${ui.highlight ? "bg-primary/20 text-primary" : "bg-muted/50 text-muted-foreground"}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-display font-bold text-lg text-foreground">{plan.name}</div>
                  <div className="text-xs text-muted-foreground">{ui.tools}</div>
                </div>
                {isCurrent && (
                  <span className="ml-auto text-[10px] bg-primary/10 text-primary border border-primary/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">
                    Current
                  </span>
                )}
              </div>

              <div>
                <span className="text-4xl font-display font-bold text-foreground">
                  {plan.price === 0 ? "Free" : `$${plan.price}`}
                </span>
                {plan.price > 0 && <span className="text-muted-foreground text-sm">/month</span>}
              </div>

              <ul className="space-y-2.5 flex-1">
                {ui.perks.map(perk => (
                  <li key={perk} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    {perk}
                  </li>
                ))}
              </ul>

              <div className="pt-2 space-y-2">
                {isHigher && (
                  <button
                    data-testid={`button-upgrade-${planKey}`}
                    onClick={() => upgrade.mutate(planKey)}
                    disabled={busy}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 transition-all"
                  >
                    <ArrowUp className="w-4 h-4" /> Upgrade to {plan.name}
                  </button>
                )}
                {isLower && (
                  <button
                    data-testid={`button-downgrade-${planKey}`}
                    onClick={() => downgrade.mutate(planKey)}
                    disabled={busy}
                    className="w-full flex items-center justify-center gap-2 bg-secondary text-secondary-foreground rounded-xl py-2.5 text-sm font-medium disabled:opacity-50 transition-all"
                  >
                    <ArrowDown className="w-4 h-4" /> Downgrade to {plan.name}
                  </button>
                )}
                {isCurrent && (
                  <div className="text-center text-sm text-muted-foreground py-2">Current plan</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Account section */}
      <div className="glass-panel rounded-2xl border border-border/60 p-8">
        <h2 className="text-xl font-display font-bold text-foreground mb-6">Manage Your Subscription</h2>

        {/* User picker */}
        <div className="flex flex-wrap items-center gap-3 mb-6 pb-6 border-b border-border/50">
          <span className="text-sm text-muted-foreground">Demo account ID:</span>
          <input
            type="number" min={1} value={userId}
            onChange={e => setUserId(parseInt(e.target.value))}
            className="w-16 bg-input text-foreground border border-border rounded-lg px-3 py-1.5 text-sm text-center font-mono"
          />
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ["/api/billing", userId] })}
            className="bg-primary/20 hover:bg-primary/30 text-primary rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
          >
            Load
          </button>
          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          {billing && (
            <span className="text-sm text-muted-foreground">
              → <strong className="text-foreground">{billing.username}</strong>
              <span className="mx-2 text-border">·</span>
              <span className="capitalize text-foreground">{billing.plan} plan</span>
              <span className="mx-2 text-border">·</span>
              <span className="text-primary font-mono">${parseFloat(billing.walletBalance).toFixed(2)} credits</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Payment method */}
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Payment Method</label>
            <input
              data-testid="input-payment-method"
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
              className="w-full bg-input text-foreground border border-border rounded-lg px-3 py-2.5 text-sm font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Try <code className="text-primary">fail_test</code> to test failed payment handling.
            </p>
          </div>

          {/* Top up credits */}
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" /> Add Credits ($)
            </label>
            <div className="flex gap-2">
              <input
                data-testid="input-topup-amount"
                type="number"
                value={topupAmount}
                onChange={e => setTopupAmount(e.target.value)}
                className="flex-1 bg-input border border-border rounded-lg px-3 py-2.5 text-sm font-mono text-foreground"
              />
              <button
                data-testid="button-topup"
                onClick={() => topup.mutate()}
                disabled={busy}
                className="bg-primary text-primary-foreground rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5"
              >
                <CreditCard className="w-3.5 h-3.5" /> Top Up
              </button>
            </div>
          </div>
        </div>

        {/* Activity log */}
        {log.length > 0 && (
          <div className="mt-6 rounded-xl overflow-hidden border border-border/50">
            <div className="px-4 py-2.5 border-b border-border/50 bg-card/40 text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">
              Activity Log
            </div>
            <div className="p-4 font-mono text-xs space-y-1 max-h-36 overflow-auto">
              {log.map((e, i) => <div key={i} className="text-primary/80">{e}</div>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
