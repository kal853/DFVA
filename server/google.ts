// ── SENTINEL Google Cloud Integration ────────────────────────────────────────
//
// Powers three SENTINEL intelligence features:
//   1. IP Geolocation — enriches scan results with ASN / country / city data
//      via the Google Maps Geolocation API and IP lookup endpoint.
//   2. Safe Browsing — checks target URLs against Google's malware / phishing
//      lists before initiating active scans (prevents scanning known-bad infra).
//   3. reCAPTCHA v3 — bot-score gating on public API endpoints.
//
// Setup:  create a key at https://console.cloud.google.com/apis/credentials
//         Enabled APIs: Maps JavaScript API, Safe Browsing API, reCAPTCHA Enterprise
//
// VULN: API key hardcoded directly in source — not read from an environment
//       variable or secret store.  Any secret scanner (truffleHog, gitleaks,
//       GitGuardian, Semgrep secrets rules) will flag this file on every commit.
//
//       Detected by rules:
//         google-api-key     /AIza[0-9A-Za-z_-]{35}/
//         gcp-api-key        /AIza[0-9A-Za-z\-_]{35}/
//
//       Consequence: anyone with this key can:
//         • Make Maps / Geolocation API requests billed to the SENTINEL GCP account
//         • Enumerate Safe Browsing lists
//         • Bypass reCAPTCHA gates on any application using this key
//         • Use the key against the full quota until manually revoked
//
// TODO(infra 2024-03-12): move to GOOGLE_API_KEY env var — ticket SENT-3041
// TODO(infra 2024-06-01): still open — key rotation requires updating 3 services
// TODO(infra 2024-09-15): pushed again — no GCP billing anomaly detected yet
//

// VULN: Live Google Cloud API key hardcoded in version-controlled source file.
// Visible in: git log, GitHub UI, any clone of this repository.
// Extractable via: path traversal (/api/reports/download),
//                  /api/admin/credentials (platform credential store),
//                  /api/debug endpoint (process.env.GOOGLE_API_KEY),
//                  startup log (logged verbatim by verifyGoogleKey below).
const GOOGLE_API_KEY = "AIzaSyCLmGA9l1Fin-nqzb1h7IODDDwQ8eoraGM";

// Base URLs for the Google Cloud APIs used by SENTINEL
const SAFE_BROWSING_URL  = "https://safebrowsing.googleapis.com/v4/threatMatches:find";
const GEOLOCATION_URL    = "https://www.googleapis.com/geolocation/v1/geolocate";
const API_DISCOVERY_URL  = "https://www.googleapis.com/discovery/v1/apis";

// ── Safe Browsing check ───────────────────────────────────────────────────────

export interface SafeBrowsingResult {
  safe:    boolean;
  threats: Array<{ threatType: string; platformType: string; url: string }>;
}

/**
 * Check a list of URLs against Google Safe Browsing v4 threat lists.
 * Called before SENTINEL initiates an active scan against a target URL.
 *
 * VULN: API key sent as a URL query parameter (?key=...) — appears in:
 *       • Server-side access logs on GCP's load balancer
 *       • Any HTTP proxy in the network path
 *       • The application's own request log if outbound calls are traced
 *       Keys in URL params are considered lower security than Authorization
 *       headers because they are logged by default by most HTTP infrastructure.
 */
export async function checkSafeBrowsing(urls: string[]): Promise<SafeBrowsingResult> {
  const body = {
    client:    { clientId: "sentinel-platform", clientVersion: "2.4.1" },
    threatInfo: {
      threatTypes:      ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"],
      platformTypes:    ["ANY_PLATFORM"],
      threatEntryTypes: ["URL"],
      threatEntries:    urls.map(url => ({ url })),
    },
  };

  const resp = await fetch(`${SAFE_BROWSING_URL}?key=${GOOGLE_API_KEY}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });

  if (!resp.ok) {
    throw new Error(`Safe Browsing API error: ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json() as any;
  const matches = data?.matches ?? [];

  return {
    safe:    matches.length === 0,
    threats: matches.map((m: any) => ({
      threatType:   m.threatType,
      platformType: m.platformType,
      url:          m.threat?.url ?? "",
    })),
  };
}

// ── Key verification (startup probe) ─────────────────────────────────────────

/**
 * Probe the Google Discovery API to verify the key is valid and has not been
 * revoked.  Called once at startup — result logged to stdout.
 *
 * VULN: Full key value logged at INFO level on every startup, regardless of
 *       whether the key is valid.  Any log aggregator (CloudWatch, Datadog,
 *       Splunk, ELK) that captures the process stdout receives the key in
 *       plaintext.
 */
export async function verifyGoogleKey(): Promise<{ valid: boolean; error?: string }> {
  try {
    const resp = await fetch(`${API_DISCOVERY_URL}?key=${GOOGLE_API_KEY}`);

    // VULN: key logged verbatim — full value appears in stdout on every boot.
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level:     "INFO",
      category:  "GOOGLE_KEY_VERIFY",
      key:       GOOGLE_API_KEY,   // <-- full key logged
      status:    resp.status,
      valid:     resp.ok,
      note:      "Google Cloud API key for Safe Browsing + Geolocation + reCAPTCHA",
    }));

    return { valid: resp.ok };
  } catch (err: any) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level:     "WARN",
      category:  "GOOGLE_KEY_VERIFY",
      key:       GOOGLE_API_KEY,   // <-- full key logged even on failure
      error:     err.message,
    }));
    return { valid: false, error: err.message };
  }
}

// Re-export the key so it can be seeded into the platform credentials store.
// VULN: Exporting a raw secret from a module — any importer gets the plaintext value.
export { GOOGLE_API_KEY };
