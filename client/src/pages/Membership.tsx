import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Check, Zap, Star, ArrowUp, ArrowDown, Wallet, CreditCard, Loader2 } from "lucide-react";
import { api } from "@shared/routes";
import { PLANS } from "@shared/schema";

const PLAN_ORDER = ["free", "pro", "enterprise"] as const;

async function handleResponse(res: Response) {
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

const PLAN_PERKS: Record<string, string[]> = {
  free:       ["Standard 5–7 day shipping", "30-day returns", "Community forum access"],
  pro:        ["Free standard shipping", "5% off every order", "Priority customer support", "Early sale access"],
  enterprise: ["Free express shipping (1–2 days)", "15% off every order", "Dedicated support agent", "Early product access", "Exclusive colorways"],
};

const PLAN_COLOR: Record<string, string> = {
  free: "border-border/60",
  pro: "border-primary/40 ring-1 ring-primary/20",
  enterprise: "border-accent/40",
};

export default function Membership() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState(2);
  const [paymentMethod, setPaymentMethod] = useState("card_4242");
  const [orderAmount, setOrderAmount] = useState("100");
  const [topupAmount, setTopupAmount] = useState("25");
  const [log, setLog] = useState<string[]>([]);

  const addLog = (msg: string) => setLog(p => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...p.slice(0, 14)]);

  const { data: billing, isLoading } = useQuery({
    queryKey: ["/api/billing", userId],
    queryFn: async () => {
      const res = await fetch(`/api/billing/${userId}`);
      return handleResponse(res);
    },
  });

  const upgrade = useMutation({
    mutationFn: async (plan: string) => handleResponse(await fetch(api.billing.upgrade.path, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, targetPlan: plan, paymentMethod }),
    })),
    onSuccess: d => { addLog(`Plan → ${d.plan}. Wallet: $${d.walletBalance}`); queryClient.invalidateQueries({ queryKey: ["/api/billing", userId] }); },
    onError: (e: Error) => addLog(`Error: ${e.message}`),
  });

  const downgrade = useMutation({
    mutationFn: async (plan: string) => handleResponse(await fetch(api.billing.downgrade.path, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, targetPlan: plan }),
    })),
    onSuccess: d => { addLog(`Downgraded. Refund: $${d.refundAmount}. Wallet: $${d.walletBalance}`); queryClient.invalidateQueries({ queryKey: ["/api/billing", userId] }); },
    onError: (e: Error) => addLog(`Error: ${e.message}`),
  });

  const applyCredits = useMutation({
    mutationFn: async () => handleResponse(await fetch(api.billing.applyCredits.path, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, orderAmount: parseFloat(orderAmount) }),
    })),
    onSuccess: d => { addLog(`Credits applied: $${d.creditsUsed}. New total: $${d.finalAmount}`); queryClient.invalidateQueries({ queryKey: ["/api/billing", userId] }); },
    onError: (e: Error) => addLog(`Error: ${e.message}`),
  });

  const topup = useMutation({
    mutationFn: async () => handleResponse(await fetch(api.billing.topup.path, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, amount: parseFloat(topupAmount) }),
    })),
    onSuccess: d => { addLog(`Wallet balance: $${d.walletBalance}`); queryClient.invalidateQueries({ queryKey: ["/api/billing", userId] }); },
    onError: (e: Error) => addLog(`Error: ${e.message}`),
  });

  const currentPlanIdx = billing ? PLAN_ORDER.indexOf(billing.plan as any) : -1;
  const busy = upgrade.isPending || downgrade.isPending || applyCredits.isPending || topup.isPending;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-4">
          <Star className="w-3.5 h-3.5" />
          Member Benefits
        </div>
        <h1 className="text-4xl sm:text-5xl font-display font-bold text-foreground mb-3">
          Your Membership
        </h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Upgrade for free shipping, exclusive discounts, and early access to new drops.
        </p>
      </div>

      {/* User picker */}
      <div className="flex items-center justify-center gap-3 mb-10">
        <span className="text-sm text-muted-foreground">Demo user ID:</span>
        <input
          type="number" min={1} value={userId}
          onChange={e => setUserId(parseInt(e.target.value))}
          className="w-16 bg-input text-foreground border border-border rounded-lg px-3 py-1.5 text-sm text-center font-mono"
        />
        <button onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/billing", userId] })}
          className="bg-primary/20 hover:bg-primary/30 text-primary rounded-lg px-3 py-1.5 text-sm font-medium transition-colors">
          Load
        </button>
        {billing && (
          <span className="text-sm text-muted-foreground font-mono">
            → <strong className="text-foreground">{billing.username}</strong> · <span className="text-primary">${parseFloat(billing.walletBalance).toFixed(2)} credits</span>
          </span>
        )}
      </div>

      {isLoading && (
        <div className="flex justify-center py-10 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading...
        </div>
      )}

      {billing && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          {/* Plan cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PLAN_ORDER.map((planKey, idx) => {
              const plan = PLANS[planKey];
              const isCurrent = billing.plan === planKey;
              const isHigher = idx > currentPlanIdx;
              const isLower = idx < currentPlanIdx;

              return (
                <div key={planKey} className={`glass-panel rounded-2xl p-6 border flex flex-col gap-4 transition-all ${PLAN_COLOR[planKey]} ${isCurrent ? "bg-primary/5" : ""}`}>
                  {isCurrent && (
                    <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-bold uppercase tracking-widest self-start">
                      Current
                    </span>
                  )}
                  <div>
                    <h3 className="font-display font-bold text-xl text-foreground">{plan.name}</h3>
                    <p className="text-3xl font-bold font-mono text-foreground mt-1">
                      {plan.price === 0 ? "Free" : `$${plan.price}`}
                      {plan.price > 0 && <span className="text-sm font-normal text-muted-foreground">/mo</span>}
                    </p>
                  </div>

                  <ul className="space-y-2 flex-1">
                    {PLAN_PERKS[planKey].map(perk => (
                      <li key={perk} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                        {perk}
                      </li>
                    ))}
                  </ul>

                  <div className="flex flex-col gap-2 pt-2">
                    {isHigher && (
                      <button
                        onClick={() => upgrade.mutate(planKey)}
                        disabled={busy}
                        className="flex items-center justify-center gap-1.5 bg-primary text-primary-foreground rounded-lg py-2 text-sm font-semibold disabled:opacity-50 transition-all"
                      >
                        <ArrowUp className="w-3.5 h-3.5" /> Upgrade
                      </button>
                    )}
                    {isLower && (
                      <button
                        onClick={() => downgrade.mutate(planKey)}
                        disabled={busy}
                        className="flex items-center justify-center gap-1.5 bg-secondary text-secondary-foreground rounded-lg py-2 text-sm font-medium disabled:opacity-50 transition-all"
                      >
                        <ArrowDown className="w-3.5 h-3.5" /> Downgrade
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Payment method input */}
          <div className="glass-panel rounded-xl p-5 border border-border/60">
            <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-2">Payment Method</label>
            <div className="flex gap-3">
              <input
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="flex-1 bg-input text-foreground border border-border rounded-lg px-3 py-2 text-sm font-mono"
                placeholder="card_4242"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">Try <code className="text-primary font-mono">fail_test</code> to simulate a failed payment.</p>
          </div>

          {/* Wallet */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="glass-panel rounded-xl p-5 border border-border/60">
              <div className="flex items-center gap-2 mb-3">
                <Wallet className="w-4 h-4 text-primary" />
                <h3 className="font-display font-semibold text-foreground">Apply Credits</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Balance: <span className="text-primary font-mono">${parseFloat(billing.walletBalance).toFixed(2)}</span></p>
              <div className="flex gap-2">
                <input type="number" value={orderAmount} onChange={e => setOrderAmount(e.target.value)}
                  className="flex-1 bg-input border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground" />
                <button onClick={() => applyCredits.mutate()} disabled={busy}
                  className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
                  Apply
                </button>
              </div>
            </div>

            <div className="glass-panel rounded-xl p-5 border border-border/60">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="w-4 h-4 text-primary" />
                <h3 className="font-display font-semibold text-foreground">Add Credits</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Top up your wallet for future purchases.</p>
              <div className="flex gap-2">
                <input type="number" value={topupAmount} onChange={e => setTopupAmount(e.target.value)}
                  className="flex-1 bg-input border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground" />
                <button onClick={() => topup.mutate()} disabled={busy}
                  className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
                  Top Up
                </button>
              </div>
            </div>
          </div>

          {/* Activity log */}
          {log.length > 0 && (
            <div className="glass-panel rounded-xl overflow-hidden border border-border/60">
              <div className="px-5 py-3 border-b border-border/50 bg-secondary/30">
                <span className="text-sm font-display font-semibold text-foreground flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" /> Activity Log
                </span>
              </div>
              <div className="p-4 font-mono text-xs space-y-1 max-h-40 overflow-auto">
                {log.map((e, i) => <div key={i} className="text-primary/80">{e}</div>)}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
