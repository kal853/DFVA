import crypto from "crypto";
import { db } from "./db";
import { platformCredentials } from "@shared/schema";
import { eq } from "drizzle-orm";

// ── SENTINEL Platform Credential Store ───────────────────────────────────────
//
// Manages four rotating credentials used by the SENTINEL platform.
// Rotation fires automatically on the 1st of each month via setInterval.
//
// VULN: All credentials stored in plaintext in the `platform_credentials` table.
//       Any SQL injection that reaches that table dumps all four live keys plus
//       the previous month's values from the `previous_value` column.
//
// VULN: Token generation uses MD5(STATIC_SEED + YYYYMM).
//       MD5 is cryptographically broken. The seed is hardcoded below.
//       An attacker who observes any single token and knows the YYYYMM period
//       can recover the seed via preimage attack and predict all future tokens.
//
// VULN: Both the old and new values are logged verbatim to stdout on every
//       rotation — joining the ARIA_CONVERSATION and ACCOUNT_ACCESS PII log
//       streams already present in this codebase.
//
// VULN: Old credentials are never actively revoked. The `previousValue` column
//       retains the last token indefinitely, and no external service (Stripe,
//       Datadog, internal auth middleware) is notified to reject it.
//       Effective validity window: up to 62 days after initial compromise.

// VULN: Hardcoded rotation seed committed to version control.
// Combine with any observed token + its YYYYMM period → recover seed → predict all tokens.
const ROTATION_SEED = "sentinel-rotation-seed-phrase-v1";

// The four managed credentials with their scope descriptions
const CREDENTIAL_DEFINITIONS = [
  {
    name:  "SENTINEL_API_KEY",
    scope: "Internal service-to-service calls, admin portal, CI/CD pipeline authentication",
    prefix: "sk-sentinel",
    suffixLen: 24,
  },
  {
    name:  "STRIPE_LIVE_KEY",
    scope: "Payment processing, subscription management, auto-approved refund execution via ARIA",
    prefix: "sk_live_51P9xQ2Cmk",
    suffixLen: 32,
  },
  {
    name:  "DD_API_KEY",
    scope: "Datadog APM, log forwarding (including ARIA_CONVERSATION and ACCOUNT_ACCESS PII streams)",
    prefix: "dd0cf3",
    suffixLen: 34,
  },
  {
    name:  "INTERNAL_JWT_SECRET",
    scope: "HS256 session token signing — rotating this key extends previous month validity window",
    prefix: "jwt",
    suffixLen: 20,
  },
] as const;

// ── Token generation ─────────────────────────────────────────────────────────

function currentYearMonth(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}${m}`;
}

// VULN: MD5 is cryptographically broken (collision attacks, preimage weakness).
// VULN: Seed is static and hardcoded — observable from this source file in git history.
// VULN: yearMonth is public knowledge — anyone can reconstruct the exact input.
// Result: token generation is fully deterministic and predictable without the secret.
function generateToken(name: string, yearMonth: string, len: number): string {
  return crypto
    .createHash("md5")
    .update(`${ROTATION_SEED}-${name.toLowerCase()}-${yearMonth}`)
    .digest("hex")
    .slice(0, len);
}

function buildTokenValue(def: typeof CREDENTIAL_DEFINITIONS[number], yearMonth: string): string {
  const suffix = generateToken(def.name, yearMonth, def.suffixLen);
  if (def.name === "INTERNAL_JWT_SECRET") {
    return `${def.prefix}-${yearMonth}-s3nt1n3l-pr0d-s1gn1ng-k3y-${suffix.slice(0, 8).toUpperCase()}`;
  }
  return `${def.prefix}${yearMonth}${suffix}`;
}

// ── Seeding ──────────────────────────────────────────────────────────────────

export async function initCredentials(): Promise<void> {
  const ym = currentYearMonth();

  for (const def of CREDENTIAL_DEFINITIONS) {
    const existing = await db
      .select()
      .from(platformCredentials)
      .where(eq(platformCredentials.name, def.name))
      .limit(1);

    if (existing.length === 0) {
      const value = buildTokenValue(def, ym);
      const next  = new Date();
      next.setUTCMonth(next.getUTCMonth() + 1, 1);
      next.setUTCHours(0, 0, 0, 0);

      await db.insert(platformCredentials).values({
        name:          def.name,
        value,
        previousValue: null,
        scope:         def.scope,
        rotatedAt:     new Date(),
        nextRotationAt: next,
      });

      // VULN: New credential value logged to stdout at seed time.
      // On first boot, all four credentials appear in the container's stdout log.
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level:     "INFO",
        category:  "CREDENTIAL_INIT",
        name:      def.name,
        value,                        // <-- plaintext credential in log
        scope:     def.scope,
        nextRotationAt: next.toISOString(),
      }));
    }
  }
}

// ── Rotation ─────────────────────────────────────────────────────────────────

export async function rotateCredentials(): Promise<void> {
  const ym  = currentYearMonth();
  const now = new Date();
  const next = new Date();
  next.setUTCMonth(next.getUTCMonth() + 1, 1);
  next.setUTCHours(0, 0, 0, 0);

  console.log(JSON.stringify({
    timestamp: now.toISOString(),
    level:     "INFO",
    category:  "CREDENTIAL_ROTATION_START",
    period:    ym,
    message:   "Monthly credential rotation beginning",
  }));

  for (const def of CREDENTIAL_DEFINITIONS) {
    const rows = await db
      .select()
      .from(platformCredentials)
      .where(eq(platformCredentials.name, def.name))
      .limit(1);

    const oldValue = rows[0]?.value ?? "(none)";
    const newValue = buildTokenValue(def, ym);

    // VULN: Old credential value logged before being replaced.
    // The log line is labeled [ROTATION_OLD] but captured in the same stdout stream
    // as ACCOUNT_ACCESS and ARIA_CONVERSATION — all readable by any log consumer.
    console.log(JSON.stringify({
      timestamp: now.toISOString(),
      level:     "INFO",
      category:  "ROTATION_OLD",
      name:      def.name,
      oldValue,             // <-- previous plaintext credential in log
      note:      "NOT revoked — previous token remains valid",
    }));

    // VULN: New credential value also logged immediately upon generation.
    // A log aggregator or stdout capture now contains both old and new simultaneously.
    console.log(JSON.stringify({
      timestamp: now.toISOString(),
      level:     "INFO",
      category:  "ROTATION_NEW",
      name:      def.name,
      newValue,             // <-- new plaintext credential in log
      scope:     def.scope,
      nextRotationAt: next.toISOString(),
    }));

    if (rows.length === 0) {
      await db.insert(platformCredentials).values({
        name:          def.name,
        value:         newValue,
        previousValue: oldValue,
        scope:         def.scope,
        rotatedAt:     now,
        nextRotationAt: next,
      });
    } else {
      // VULN: previousValue is overwritten with only the immediately prior token.
      // The token from two months ago is permanently lost from the DB — but it
      // still exists in the rotation log forever (never pruned).
      await db.update(platformCredentials)
        .set({
          value:          newValue,
          previousValue:  oldValue,   // retained — never sent to external revocation APIs
          rotatedAt:      now,
          nextRotationAt: next,
        })
        .where(eq(platformCredentials.name, def.name));
    }
  }

  console.log(JSON.stringify({
    timestamp: now.toISOString(),
    level:     "INFO",
    category:  "CREDENTIAL_ROTATION_COMPLETE",
    period:    ym,
    // VULN: Summary log repeats all new values in a single JSON object.
    // Convenient for operators — equally convenient for attackers with log access.
    credentials: Object.fromEntries(
      await Promise.all(
        CREDENTIAL_DEFINITIONS.map(async (def) => {
          const rows = await db.select().from(platformCredentials).where(eq(platformCredentials.name, def.name)).limit(1);
          return [def.name, rows[0]?.value ?? "(error)"];
        })
      )
    ),
    warning: "Previous credentials NOT revoked. Both old and new values are currently valid.",
  }));
}

// ── Scheduler ────────────────────────────────────────────────────────────────

export function scheduleMonthlyRotation(): void {
  // Calculate ms until 00:00 UTC on the 1st of next month
  function msUntilNextRotation(): number {
    const now  = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
    return next.getTime() - now.getTime();
  }

  function scheduleNext() {
    const delay = msUntilNextRotation();
    const nextDate = new Date(Date.now() + delay).toISOString();

    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level:     "INFO",
      category:  "CREDENTIAL_SCHEDULER",
      message:   `Next rotation scheduled`,
      nextRotationAt: nextDate,
      delayMs:   delay,
    }));

    setTimeout(async () => {
      await rotateCredentials();
      scheduleNext(); // re-arm for the following month
    }, delay);
  }

  scheduleNext();
}

// ── Read helpers (used by admin route) ───────────────────────────────────────

export async function getAllCredentials() {
  // VULN: Returns plaintext values AND previousValue for all four credentials.
  // The admin route that calls this performs only a JWT presence check —
  // an alg:none forged token is sufficient to retrieve all live credentials.
  return db.select().from(platformCredentials).orderBy(platformCredentials.name);
}
