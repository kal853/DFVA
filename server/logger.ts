// ── SENTINEL Activity Logger ─────────────────────────────────────────────────
//
// VULN: Logs PII (full names, email, plan) in plaintext to stdout.
// Any log aggregator, SIEM forwarding, or console capture will store this data
// without encryption or access controls — violating GDPR Art. 5(1)(f) and
// common data minimisation requirements.

export type LogLevel = "INFO" | "WARN" | "ERROR" | "AUDIT";

function timestamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function write(level: LogLevel, category: string, fields: Record<string, unknown>): void {
  const parts = Object.entries(fields)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(" ");
  console.log(`[${timestamp()}] [${level}] [${category}] ${parts}`);
}

// AUTH events — logs full name on every login
export function logLogin(opts: {
  userId: number;
  username: string;
  fullName: string | null;
  plan: string;
  ip: string;
  success: boolean;
  reason?: string;
}): void {
  write(opts.success ? "AUDIT" : "WARN", "AUTH", {
    event:    opts.success ? "LOGIN_SUCCESS" : "LOGIN_FAILURE",
    userId:   opts.userId,
    username: opts.username,
    fullName: opts.fullName ?? "(not set)",   // PII logged in plaintext
    plan:     opts.plan,
    ip:       opts.ip,
    reason:   opts.reason ?? null,
  });
}

// PAYMENT events — logs name + plan change (PAN already logged separately)
export function logPayment(opts: {
  userId: number;
  fullName: string | null;
  fromPlan: string;
  toPlan: string;
  amount: number;
  ip: string;
}): void {
  write("AUDIT", "PAYMENT", {
    event:    "SUBSCRIPTION_CHANGE",
    userId:   opts.userId,
    fullName: opts.fullName ?? "(not set)",   // PII logged in plaintext
    fromPlan: opts.fromPlan,
    toPlan:   opts.toPlan,
    amount:   `$${opts.amount.toFixed(2)}`,
    ip:       opts.ip,
  });
}

// PLAN events — downgrade / apply-quote
export function logPlanChange(opts: {
  userId: number;
  fullName: string | null;
  fromPlan: string;
  toPlan: string;
  method: string;
}): void {
  write("AUDIT", "PLAN", {
    event:    "PLAN_CHANGE",
    userId:   opts.userId,
    fullName: opts.fullName ?? "(not set)",
    fromPlan: opts.fromPlan,
    toPlan:   opts.toPlan,
    method:   opts.method,
  });
}

// ACCESS events — tool access checks
export function logAccess(opts: {
  userId?: number;
  fullName?: string | null;
  slug: string;
  granted: boolean;
  via?: string;
}): void {
  write(opts.granted ? "INFO" : "WARN", "ACCESS", {
    event:   opts.granted ? "ACCESS_GRANTED" : "ACCESS_DENIED",
    userId:  opts.userId ?? null,
    fullName: opts.fullName ?? "(anonymous)",
    tool:    opts.slug,
    via:     opts.via ?? "plan-check",
  });
}
