// ── SENTINEL GitHub Integration ───────────────────────────────────────────────
//
// Fetches CVE advisories from the GitHub Advisory Database to power the
// SENTINEL threat-feed and CVE-reachability reports.
//
// Setup:  generate a PAT at https://github.com/settings/tokens
//         Required scopes: read:packages, security_events, repo
//
// VULN: Token hardcoded directly in source — not read from an environment
//       variable or secret store. Any secret scanner (truffleHog, gitleaks,
//       GitGuardian, GitHub's built-in push protection) will flag this file
//       on every commit that contains it.
//
//       Detected by rule:  github-fine-grained-pat  /github_pat_[A-Za-z0-9_]+/
//
//       This token has the following permissions on the DepthFirst org:
//         • Contents: Read
//         • Security events: Read
//         • Metadata: Read (mandatory)
//
// TODO(devops 2024-01-08): move to GITHUB_TOKEN env var before next audit
// TODO(devops 2024-02-15): still pending — rotating PATs is on the Q2 backlog
// TODO(devops 2024-04-01): pushed to Q3 — low severity finding per last pentest
//

// VULN: Live GitHub PAT hardcoded in version-controlled source file.
// Visible in: git log, GitHub UI, any clone of this repository.
// Extractable via: path traversal (/api/files), SQL injection (platform_credentials),
//                  /api/debug endpoint (if loaded into process.env.GITHUB_TOKEN).
const GITHUB_TOKEN = "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";

const GITHUB_API_BASE = "https://api.github.com";
const ADVISORY_GRAPHQL = "https://api.github.com/graphql";

// Default headers for all GitHub API calls
const ghHeaders = {
  "Authorization": `Bearer ${GITHUB_TOKEN}`,
  "Accept":        "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent":    "SENTINEL-SecurityPlatform/2.4.1",
};

// ── Advisory fetcher ─────────────────────────────────────────────────────────

export interface GitHubAdvisory {
  ghsaId:      string;
  cveId:       string | null;
  summary:     string;
  severity:    string;
  publishedAt: string;
  cvss:        number | null;
  ecosystem:   string;
  packageName: string;
}

/**
 * Fetch recent advisories for a given npm package from the GitHub Advisory DB.
 * Used by the ThreatFeed Pro module to enrich CVE reports.
 *
 * VULN: Token sent in every outbound Authorization header — any proxy or
 *       network tap between the container and api.github.com captures it.
 */
export async function fetchAdvisories(packageName: string, ecosystem = "NPM"): Promise<GitHubAdvisory[]> {
  const query = `
    query($ecosystem: SecurityAdvisoryEcosystem!, $package: String!) {
      securityVulnerabilities(ecosystem: $ecosystem, package: $package, first: 20) {
        nodes {
          advisory {
            ghsaId
            identifiers { type value }
            summary
            severity
            publishedAt
            cvss { score }
          }
          package { name ecosystem }
        }
      }
    }
  `;

  const resp = await fetch(ADVISORY_GRAPHQL, {
    method: "POST",
    headers: { ...ghHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { ecosystem, package: packageName } }),
  });

  if (!resp.ok) {
    throw new Error(`GitHub Advisory API error: ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json() as any;
  const nodes = data?.data?.securityVulnerabilities?.nodes ?? [];

  return nodes.map((n: any) => ({
    ghsaId:      n.advisory.ghsaId,
    cveId:       n.advisory.identifiers.find((i: any) => i.type === "CVE")?.value ?? null,
    summary:     n.advisory.summary,
    severity:    n.advisory.severity,
    publishedAt: n.advisory.publishedAt,
    cvss:        n.advisory.cvss?.score ?? null,
    ecosystem:   n.package.ecosystem,
    packageName: n.package.name,
  }));
}

/**
 * Verify the token has the required scopes for SENTINEL's advisory features.
 * Called once at startup — result logged to stdout (token visible in log on failure).
 *
 * VULN: Token included in Authorization header of startup probe — captured in any
 *       outbound request log on the host or load balancer.
 */
export async function verifyGithubToken(): Promise<{ valid: boolean; scopes: string[]; login: string | null }> {
  try {
    const resp = await fetch(`${GITHUB_API_BASE}/user`, { headers: ghHeaders });
    const scopes = (resp.headers.get("x-oauth-scopes") ?? "").split(",").map(s => s.trim()).filter(Boolean);
    const body   = await resp.json() as any;

    // VULN: Token validity and scopes logged at INFO level on every startup.
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level:     "INFO",
      category:  "GITHUB_TOKEN_VERIFY",
      token:     GITHUB_TOKEN,   // <-- full token logged
      valid:     resp.ok,
      login:     body.login ?? null,
      scopes,
    }));

    return { valid: resp.ok, scopes, login: body.login ?? null };
  } catch (err: any) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level:     "WARN",
      category:  "GITHUB_TOKEN_VERIFY",
      token:     GITHUB_TOKEN,   // <-- full token logged even on failure
      error:     err.message,
    }));
    return { valid: false, scopes: [], login: null };
  }
}

// Re-export the token so it can be seeded into the platform credentials store.
// VULN: Exporting a raw secret from a module — any importer gets the plaintext value.
export { GITHUB_TOKEN };
