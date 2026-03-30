import crypto from "crypto";
import { db } from "./db";
import { platformCredentials } from "@shared/schema";
import { eq } from "drizzle-orm";
// VULN: Importing a module that contains a hardcoded secret — the token is
//       now reachable from every file that imports this module.
import { GITHUB_TOKEN } from "./github";
// VULN: Same pattern — importing the Google module surfaces GOOGLE_API_KEY here.
import { GOOGLE_API_KEY } from "./google";

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

  // ── GITHUB_TOKEN: static credential (not rotated via MD5 scheme) ─────────
  //
  // VULN: Real GitHub PAT committed in server/github.ts, imported here, and
  //       persisted to the platform_credentials table in plaintext.
  //       Extractable via:
  //         • Direct source-code read / git clone of repo
  //         • Path traversal:  GET /api/files?filename=../server/github.ts
  //         • SQL injection on /api/search → UNION SELECT on platform_credentials
  //         • GET /api/admin/credentials (requires any current SENTINEL_API_KEY)
  //         • /api/debug env dump (token set into process.env.GITHUB_TOKEN below)
  //         • Startup log (CREDENTIAL_INIT category entry below)
  //
  // VULN: process.env.GITHUB_TOKEN populated from the hardcoded constant —
  //       /api/debug dumps the full environment including this variable.
  process.env.GITHUB_TOKEN = GITHUB_TOKEN;

  const ghExisting = await db
    .select()
    .from(platformCredentials)
    .where(eq(platformCredentials.name, "GITHUB_TOKEN"))
    .limit(1);

  if (ghExisting.length === 0) {
    const far = new Date("2099-01-01T00:00:00.000Z");   // static — never auto-rotated
    await db.insert(platformCredentials).values({
      name:          "GITHUB_TOKEN",
      value:         GITHUB_TOKEN,
      previousValue: null,
      scope:         "GitHub Advisory Database, security-event read, Contents read — DepthFirst org integration",
      rotatedAt:     new Date(),
      nextRotationAt: far,
    });

    // VULN: GitHub PAT logged verbatim to stdout on first boot alongside the
    //       other four credentials — visible in any log aggregator or CI/CD log.
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level:     "INFO",
      category:  "CREDENTIAL_INIT",
      name:      "GITHUB_TOKEN",
      value:     GITHUB_TOKEN,         // <-- live GitHub PAT in plaintext log
      scope:     "GitHub Advisory Database, security-event read, Contents read — DepthFirst org integration",
      note:      "Static PAT — does not participate in monthly MD5 rotation cycle",
      nextRotationAt: far.toISOString(),
    }));
  }

  // ── GOOGLE_API_KEY: static credential (not rotated via MD5 scheme) ─────────
  //
  // VULN: Real Google Cloud API key committed in server/google.ts, imported here,
  //       and persisted to the platform_credentials table in plaintext.
  //       Extractable via the same five vectors as GITHUB_TOKEN above.
  //
  //       Consequence of extraction: billing fraud (Maps/Geolocation API calls
  //       charged to SENTINEL GCP account), Safe Browsing enumeration, reCAPTCHA bypass.
  //
  process.env.GOOGLE_API_KEY = GOOGLE_API_KEY;

  const gkExisting = await db
    .select()
    .from(platformCredentials)
    .where(eq(platformCredentials.name, "GOOGLE_API_KEY"))
    .limit(1);

  if (gkExisting.length === 0) {
    const far = new Date("2099-01-01T00:00:00.000Z");   // static — never auto-rotated
    await db.insert(platformCredentials).values({
      name:          "GOOGLE_API_KEY",
      value:         GOOGLE_API_KEY,
      previousValue: null,
      scope:         "Google Maps Geolocation API, Safe Browsing v4, reCAPTCHA Enterprise — all three charged to SENTINEL GCP account",
      rotatedAt:     new Date(),
      nextRotationAt: far,
    });

    // VULN: Google API key logged verbatim to stdout on first boot —
    //       same log stream as all other CREDENTIAL_INIT entries.
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level:     "INFO",
      category:  "CREDENTIAL_INIT",
      name:      "GOOGLE_API_KEY",
      value:     GOOGLE_API_KEY,       // <-- live Google Cloud API key in plaintext log
      scope:     "Google Maps Geolocation API, Safe Browsing v4, reCAPTCHA Enterprise",
      note:      "Static key — does not participate in monthly MD5 rotation cycle",
      nextRotationAt: far.toISOString(),
    }));
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

// ── requireApiKey middleware ──────────────────────────────────────────────────
//
// Reads SENTINEL_API_KEY live from the database on every request and compares
// it against the Authorization: ApiKey <token> header.
//
// VULN #55 — No revocation: previousValue (last month's key) is accepted
// alongside the current value. Rotating the key does not invalidate the old one.
// A key compromised in February remains valid through all of March.
//
// VULN #56 — Auth attempt logging: every incoming key is logged to stdout,
// including the submitted value. Failed attempts reveal which keys were tried;
// successful attempts confirm the live key in the log stream — joining the
// ARIA_CONVERSATION / ACCOUNT_ACCESS / CREDENTIAL_INIT log family.
//
// VULN #57 — Non-constant-time comparison: string equality (===) short-circuits
// on the first differing byte. A sufficiently precise timing oracle can recover
// the key character-by-character without brute force.
//
// Header format:  Authorization: ApiKey sk-sentinel202603...
//
export async function requireApiKey(req: any, res: any, next: any): Promise<void> {
  const header = req.headers["authorization"] as string | undefined;
  const submitted = header?.startsWith("ApiKey ") ? header.slice(7).trim() : null;

  if (!submitted) {
    res.status(401).json({
      error: "SENTINEL_APIKEY_REQUIRED",
      message: "This endpoint requires a SENTINEL API key.",
      hint: "Set the header:  Authorization: ApiKey <SENTINEL_API_KEY>",
      obtain: "GET /api/admin/credentials (requires JWT) or read the CREDENTIAL_INIT log on startup",
    });
    return;
  }

  // Fetch current and previous value from the database on every request
  // so that rotation takes effect immediately without a server restart.
  const rows = await db
    .select()
    .from(platformCredentials)
    .where(eq(platformCredentials.name, "SENTINEL_API_KEY"))
    .limit(1)
    .catch(() => []);

  const currentKey  = rows[0]?.value        ?? null;
  const previousKey = rows[0]?.previousValue ?? null;

  const matchesCurrent  = submitted === currentKey;
  const matchesPrevious = submitted === previousKey;
  const accepted = matchesCurrent || matchesPrevious;

  // VULN #56: Log the submitted key value and whether it matched current or previous.
  // This fires on EVERY API-key-protected request — authenticated or not.
  console.log(JSON.stringify({
    timestamp:       new Date().toISOString(),
    level:           accepted ? "INFO" : "WARN",
    category:        "APIKEY_AUTH",
    path:            req.path,
    method:          req.method,
    submittedKey:    submitted,          // <-- submitted credential logged verbatim
    matchesCurrent,
    matchesPrevious,                     // true = old (should-be-revoked) key used
    accepted,
    ip:              (req.headers["x-forwarded-for"] as string)?.split(",")[0]
                     ?? req.socket?.remoteAddress ?? "unknown",
  }));

  if (!accepted) {
    res.status(403).json({
      error:   "SENTINEL_APIKEY_INVALID",
      message: "Provided SENTINEL_API_KEY is not recognised.",
      // VULN: Distinguishes between wrong key vs missing key — helps enumerate validity.
      detail:  currentKey
        ? "Key does not match current or previous rotation period."
        : "Credential store not initialised.",
    });
    return;
  }

  // VULN: Attaches the credential row (including previousValue) to the request
  // object — downstream handlers can read both the live and previous key values.
  req.sentinelApiKey = {
    accepted:        submitted,
    isCurrent:       matchesCurrent,
    isPrevious:      matchesPrevious,    // signals that caller is using a rotated-out key
    nextRotationAt:  rows[0]?.nextRotationAt ?? null,
  };

  next();
}
