import { useState } from "react";
import { X, CreditCard, Lock, Loader2, CheckCircle, AlertCircle } from "lucide-react";

export type CardDetails = {
  number: string;
  expiry: string;
  cvv: string;
  name: string;
};

type Props = {
  planName: string;
  planPrice: number;
  onConfirm: (card: CardDetails) => Promise<void>;
  onClose: () => void;
};

function formatCardNumber(val: string) {
  return val.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(val: string) {
  const digits = val.replace(/\D/g, "").slice(0, 4);
  if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

export default function PaymentModal({ planName, planPrice, onConfirm, onClose }: Props) {
  const [card, setCard] = useState<CardDetails>({ number: "", expiry: "", cvv: "", name: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = card.number.replace(/\s/g, "");
    if (raw.length < 16) return setError("Please enter a valid 16-digit card number.");
    if (card.expiry.length < 5) return setError("Please enter a valid expiry date.");
    if (card.cvv.length < 3)   return setError("Please enter a valid CVV.");
    if (!card.name.trim())     return setError("Please enter the cardholder name.");

    setLoading(true);
    setError(null);
    try {
      await onConfirm({ ...card, number: raw });
      setSuccess(true);
      setTimeout(onClose, 1800);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md glass-panel rounded-2xl border border-border/60 p-7 shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
          <X className="w-4 h-4" />
        </button>

        {success ? (
          <div className="text-center py-6">
            <CheckCircle className="w-12 h-12 text-primary mx-auto mb-3" />
            <h3 className="text-lg font-display font-bold text-foreground mb-1">Payment successful</h3>
            <p className="text-sm text-muted-foreground">You're now on the <strong>{planName}</strong> plan.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-foreground">Upgrade to {planName}</h3>
                <p className="text-sm text-muted-foreground">${planPrice}/month — billed monthly</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cardholder Name</label>
                <input
                  data-testid="input-card-name"
                  type="text"
                  placeholder="Jane Smith"
                  value={card.name}
                  onChange={e => setCard(c => ({ ...c, name: e.target.value }))}
                  className="w-full bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Card Number</label>
                <div className="relative">
                  <input
                    data-testid="input-card-number"
                    type="text"
                    inputMode="numeric"
                    placeholder="1234 5678 9012 3456"
                    value={card.number}
                    onChange={e => setCard(c => ({ ...c, number: formatCardNumber(e.target.value) }))}
                    className="w-full bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary pr-10"
                  />
                  <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Expiry</label>
                  <input
                    data-testid="input-card-expiry"
                    type="text"
                    inputMode="numeric"
                    placeholder="MM/YY"
                    value={card.expiry}
                    onChange={e => setCard(c => ({ ...c, expiry: formatExpiry(e.target.value) }))}
                    className="w-full bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">CVV</label>
                  <input
                    data-testid="input-card-cvv"
                    type="text"
                    inputMode="numeric"
                    placeholder="123"
                    maxLength={4}
                    value={card.cvv}
                    onChange={e => setCard(c => ({ ...c, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                    className="w-full bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <button
                data-testid="button-confirm-payment"
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm disabled:opacity-50 transition-all mt-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                {loading ? "Processing…" : `Pay $${planPrice}/month`}
              </button>
            </form>

            <div className="mt-4 pt-4 border-t border-border/50">
              <p className="text-[11px] text-muted-foreground/60 text-center">
                🔒 Payments secured by Sentinel Pay. Cancel anytime.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
