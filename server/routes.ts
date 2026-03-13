import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import axios from "axios";
import { calculateProration, applyCreditsToOrder, finalizeUpgrade, processDowngrade } from "./billing";
import { PLANS, type PlanKey } from "@shared/schema";
// Vulnerable packages — intentionally pinned to known-vulnerable versions
import marked from "marked";           // marked@0.3.6  — XSS via unsanitised HTML (CVE-2022-21681 et al.)
import _ from "lodash";                // lodash@4.17.15 — prototype pollution (CVE-2019-10744)
// @ts-ignore — no type declarations for node-serialize@0.0.4
import serialize from "node-serialize"; // node-serialize@0.0.4 — RCE via IIFE (CVE-2017-5941)

const SEED_TOOLS = [
  {
    name: "NullScan",
    slug: "nullscan",
    description: "Fast TCP/UDP port scanner with service fingerprinting and banner grabbing.",
    longDescription: "NullScan performs high-speed SYN scans across full IPv4 ranges. Service detection identifies over 1,200 protocols. Built-in banner grabbing extracts version strings for downstream CVE matching. Outputs to JSON, XML, or CSV.",
    price: "0.00",
    category: "scanning",
    badge: "FREE",
    stock: 5000,
    rating: "4.7",
    reviewCount: 1840,
    featured: true,
    specs: JSON.stringify({ type: "Port Scanner", protocols: "TCP / UDP / SCTP", speed: "Up to 100k pkts/sec", output: "JSON, XML, CSV", api_calls: "5,000 / month" }),
  },
  {
    name: "DNSReaper",
    slug: "dnsreaper",
    description: "DNS enumeration and subdomain takeover detection across all major providers.",
    longDescription: "DNSReaper resolves, brute-forces, and zone-walks DNS records. Subdomain takeover detection checks against 80+ cloud services including AWS S3, Azure, GitHub Pages, and Heroku. Identifies dangling CNAMEs automatically.",
    price: "0.00",
    category: "scanning",
    badge: "FREE",
    stock: 5000,
    rating: "4.6",
    reviewCount: 1230,
    featured: false,
    specs: JSON.stringify({ type: "DNS Enumeration", takeover_checks: "80+ providers", record_types: "A, AAAA, CNAME, MX, TXT, NS", wordlist: "Built-in 500k entries", api_calls: "5,000 / month" }),
  },
  {
    name: "WebProbe",
    slug: "webprobe",
    description: "Full-stack web application vulnerability scanner. OWASP Top 10 coverage.",
    longDescription: "WebProbe crawls and fuzzes web applications for injection flaws, broken auth, SSRF, XXE, and insecure deserialisation. Authenticated scan support via session cookies or OAuth. Generates SARIF-compatible reports.",
    price: "49.00",
    category: "web",
    badge: "PRO",
    stock: 50000,
    rating: "4.9",
    reviewCount: 3210,
    featured: true,
    specs: JSON.stringify({ type: "DAST Scanner", coverage: "OWASP Top 10 + CWE Top 25", auth: "Cookie, Bearer, OAuth2", report: "SARIF, HTML, PDF", api_calls: "50,000 / month" }),
  },
  {
    name: "VaultBreach",
    slug: "vaultbreach",
    description: "Offline password auditing and hash cracking suite. GPU-accelerated.",
    longDescription: "VaultBreach supports MD5, SHA-1, SHA-256, bcrypt, Argon2, NTLM, and NetNTLMv2. GPU acceleration via OpenCL. Dictionary, rule-based, and PRINCE attacks. Integrates with HaveIBeenPwned corpus (14B+ hashes).",
    price: "29.00",
    category: "auth",
    badge: "PRO",
    stock: 50000,
    rating: "4.8",
    reviewCount: 2670,
    featured: true,
    specs: JSON.stringify({ type: "Password Auditor", algorithms: "MD5, SHA-1, SHA-256, bcrypt, Argon2, NTLM", acceleration: "GPU (OpenCL)", modes: "Dictionary, Combinator, PRINCE, Brute-force", api_calls: "50,000 / month" }),
  },
  {
    name: "PhantomTrace",
    slug: "phantomtrace",
    description: "OSINT and recon framework. Aggregate data from 200+ open sources.",
    longDescription: "PhantomTrace orchestrates queries across Shodan, Censys, VirusTotal, WHOIS, LinkedIn scraping, email harvesting, and dark-web paste sites. Built-in graph visualisation shows entity relationships. One-click PDF report generation.",
    price: "39.00",
    category: "osint",
    badge: "PRO",
    stock: 50000,
    rating: "4.8",
    reviewCount: 1980,
    featured: true,
    specs: JSON.stringify({ type: "OSINT Framework", sources: "200+ (Shodan, Censys, VirusTotal, LinkedIn...)", outputs: "Graph, PDF, JSON", modules: "Email, Domain, IP, Person, Company", api_calls: "50,000 / month" }),
  },
  {
    name: "CipherAudit",
    slug: "cipheraudit",
    description: "TLS/SSL configuration analyser. Flags weak ciphers, expired certs, and HSTS misconfigs.",
    longDescription: "CipherAudit connects to any TLS endpoint and enumerates supported cipher suites, protocol versions, certificate chains, HSTS policies, and CT log inclusion. Grades results A–F following Mozilla's modern configuration baseline.",
    price: "19.00",
    category: "crypto",
    badge: "PRO",
    stock: 50000,
    rating: "4.7",
    reviewCount: 1120,
    featured: false,
    specs: JSON.stringify({ type: "TLS Analyser", protocols: "TLS 1.0–1.3, SSL 2/3 detection", grading: "A–F (Mozilla baseline)", cert_checks: "Expiry, chain, CT log, HSTS, HPKP", api_calls: "50,000 / month" }),
  },
  {
    name: "PacketVault",
    slug: "packetvault",
    description: "Passive network traffic analyser with protocol decoding and anomaly detection.",
    longDescription: "PacketVault decodes 300+ application-layer protocols from PCAP files or live capture streams. ML-based anomaly detection flags DGA traffic, beaconing patterns, and lateral movement. Integrates with SIEM via syslog/CEF.",
    price: "39.00",
    category: "scanning",
    badge: "PRO",
    stock: 50000,
    rating: "4.6",
    reviewCount: 890,
    featured: false,
    specs: JSON.stringify({ type: "Network Analyser", protocols: "300+ decoded", input: "PCAP, live capture, S3 bucket", detection: "ML anomaly (DGA, beaconing, lateral movement)", api_calls: "50,000 / month" }),
  },
  {
    name: "ThreatFeed Pro",
    slug: "threatfeed-pro",
    description: "Real-time threat intelligence feed. IOCs, TTPs, and actor profiles updated hourly.",
    longDescription: "ThreatFeed Pro aggregates indicators from 40+ commercial and government intelligence feeds, normalised to STIX 2.1. Includes CVE enrichment, malware family tagging, and ATT&CK technique mapping. Push API delivers new IOCs in under 60 seconds.",
    price: "149.00",
    category: "intelligence",
    badge: "ENTERPRISE",
    stock: 999999,
    rating: "4.9",
    reviewCount: 542,
    featured: true,
    specs: JSON.stringify({ type: "Threat Intelligence", format: "STIX 2.1 / TAXII 2.1", feeds: "40+ sources", latency: "<60 sec IOC delivery", mapping: "MITRE ATT&CK", api_calls: "Unlimited" }),
  },
  {
    name: "LogSentinel",
    slug: "logsentinel",
    description: "Cloud-native SIEM. Ingest, correlate, and alert on security events at scale.",
    longDescription: "LogSentinel ingests logs from AWS CloudTrail, GCP Audit Logs, Azure Monitor, Okta, and 200+ other sources via pre-built connectors. Correlation engine runs 500+ detection rules out of the box. Alert routing to PagerDuty, Slack, or webhook.",
    price: "199.00",
    category: "intelligence",
    badge: "ENTERPRISE",
    stock: 999999,
    rating: "4.8",
    reviewCount: 317,
    featured: false,
    specs: JSON.stringify({ type: "SIEM", ingestion: "200+ connectors", detection_rules: "500+ built-in (Sigma compatible)", alerting: "PagerDuty, Slack, Webhook", retention: "90 days hot / 2 years cold", api_calls: "Unlimited" }),
  },
  {
    name: "ShadowBrute",
    slug: "shadowbrute",
    description: "Distributed credential testing framework for red team operations.",
    longDescription: "ShadowBrute orchestrates distributed credential-stuffing and password-spray campaigns against SSH, RDP, SMB, HTTP Basic, and OWA targets. Built-in proxy rotation and timing jitter evade detection. Full audit log for authorised testing.",
    price: "99.00",
    category: "auth",
    badge: "ENTERPRISE",
    stock: 999999,
    rating: "4.7",
    reviewCount: 208,
    featured: false,
    specs: JSON.stringify({ type: "Credential Testing", protocols: "SSH, RDP, SMB, HTTP, OWA", evasion: "Proxy rotation, timing jitter, TLS SNI spoofing", audit: "Full immutable log", note: "Authorised use only", api_calls: "Unlimited" }),
  },
];

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ── Seed on startup ──────────────────────────────────────────────────────────
  setTimeout(async () => {
    try {
      if (!await storage.getUserByUsername("admin")) {
        await storage.createUser({ username: "admin", password: "super_secret_password_123", role: "admin", email: "admin@sentinel.io", plan: "enterprise", walletBalance: "0.00" });
        const jdoe = await storage.createUser({ username: "jdoe", password: "password1", role: "user", email: "jdoe@corp.internal", plan: "pro", walletBalance: "50.00" });
        const asmith = await storage.createUser({ username: "asmith", password: "password1", role: "user", email: "asmith@corp.internal", plan: "free", walletBalance: "0.00" });
        await storage.createInvoice({ userId: jdoe.id, amount: "49.00", status: "paid" });
        await storage.createInvoice({ userId: asmith.id, amount: "0.00", status: "paid" });
      }
      if ((await storage.getProducts()).length === 0) {
        for (const t of SEED_TOOLS) await storage.createProduct(t as any);
      }
    } catch (e) { console.error("Seed failed:", e); }
  }, 1000);

  const logsDir = path.join(process.cwd(), "logs");
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
    fs.writeFileSync(path.join(logsDir, "system.log"), "Sentinel started.\nAll systems operational.\n");
    fs.writeFileSync(path.join(logsDir, "access.log"), "User admin logged in from 10.0.0.5\nUser jdoe failed login from 10.0.0.12\n");
  }

  const AWS_ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE";
  const AWS_SECRET_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
  const STRIPE_KEY     = "sk_test_4eC39HqLyjWDarjtT1zdp7dc";

  // ── PRODUCT / TOOL ROUTES ────────────────────────────────────────────────────

  app.get("/api/products", async (req, res) => {
    try {
      const { category, q } = req.query as { category?: string; q?: string };
      res.json(q ? await storage.searchProducts(q) : await storage.getProducts(category));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/products/featured", async (_req, res) => {
    try { res.json(await storage.getFeaturedProducts()); }
    catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/products/:slug", async (req, res) => {
    try {
      const p = await storage.getProductBySlug(req.params.slug);
      if (!p) return res.status(404).json({ message: "Tool not found" });
      res.json(p);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── BILLING / SUBSCRIPTION ROUTES ───────────────────────────────────────────

  app.get("/api/billing/:userId", async (req, res) => {
    try {
      const user = await storage.getUser(parseInt(req.params.userId));
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({ userId: user.id, username: user.username, plan: user.plan, walletBalance: user.walletBalance, planStartDate: user.planStartDate?.toISOString() ?? null });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post(api.billing.upgrade.path, async (req, res) => {
    try {
      const { userId, targetPlan, paymentMethod } = req.body;
      const result = await finalizeUpgrade(userId, targetPlan as PlanKey, paymentMethod);
      res.json({ message: `Upgraded to ${targetPlan}`, plan: result.plan, walletBalance: result.newBalance });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post(api.billing.downgrade.path, async (req, res) => {
    try {
      const { userId, targetPlan } = req.body;
      const result = await processDowngrade(userId, targetPlan as PlanKey);
      res.json({ message: `Downgraded to ${targetPlan}`, refundAmount: result.refundAmount, walletBalance: result.newBalance });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post(api.billing.applyCredits.path, async (req, res) => {
    try {
      const { userId, orderAmount } = req.body;
      const result = await applyCreditsToOrder(userId, orderAmount);
      res.json({ message: "Credits applied", finalAmount: result.finalAmount, creditsUsed: result.creditsUsed });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post(api.billing.topup.path, async (req, res) => {
    try {
      const { userId, amount } = req.body;
      const user = await storage.topupWallet(userId, amount);
      await storage.logWalletTransaction(userId, amount, "topup", "Credit top-up");
      res.json({ message: `Topped up $${amount}`, walletBalance: user.walletBalance });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── VULNERABLE ROUTES (hidden — no UI links) ─────────────────────────────────

  // 1. SQL Injection
  app.get(api.tools.searchUsers.path, async (req, res) => {
    const query = req.query.query as string || "";
    try { res.json(await storage.searchUsersVulnerable(query)); }
    catch (e: any) { res.status(500).json({ message: "Database Error: " + e.message }); }
  });

  // 2. Command Injection
  app.post(api.tools.ping.path, (req, res) => {
    const { host } = req.body;
    if (!host) return res.status(400).json({ message: "Host required" });
    exec(`ping -c 1 ${host}`, (err, stdout, stderr) => {
      res.json({ output: stdout || stderr || err?.message });
    });
  });

  // 3. SSRF
  app.post(api.tools.fetchUrl.path, async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ message: "URL required" });
    try {
      const r = await axios.get(url);
      res.json({ data: typeof r.data === "string" ? r.data : JSON.stringify(r.data).substring(0, 2000) });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // 4. Path Traversal
  app.get(api.tools.readLog.path, (req, res) => {
    const filename = req.query.filename as string;
    if (!filename) return res.status(400).json({ message: "Filename required" });
    try { res.json({ content: fs.readFileSync(path.join(process.cwd(), "logs", filename), "utf8") }); }
    catch (e: any) { res.status(500).json({ message: "Error: " + e.message }); }
  });

  // 5. eval() Deserialization
  app.post(api.tools.deserialize.path, (req, res) => {
    const { data } = req.body;
    try { res.json({ result: eval("(" + data + ")") }); }
    catch (e: any) { res.status(500).json({ message: "Eval Error: " + e.message }); }
  });

  // 6. Broken Auth — header bypass
  app.get(api.tools.bypassAuth.path, (req, res) => {
    if (req.headers["x-admin-bypass"] !== "true") return res.status(401).json({ message: "Unauthorized" });
    res.json({ stats: { users: 3, revenue: "$29,400/mo", secrets_exposed: true } });
  });

  // 7. Reflected XSS
  app.post(api.tools.updateProfile.path, (req, res) => {
    const { bio } = req.body;
    res.json({ message: `Profile updated! New bio: ${bio}` });
  });

  // 8. Info Exposure — hardcoded secrets
  app.get(api.tools.debugInfo.path, (_req, res) => {
    res.json({ env: { AWS_ACCESS_KEY, AWS_SECRET_KEY, STRIPE_KEY, DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: process.env.NODE_ENV } });
  });

  // 9. IDOR — no ownership check on invoice
  app.get("/api/invoice/:id", async (req, res) => {
    const inv = await storage.getInvoice(parseInt(req.params.id));
    if (!inv) return res.status(404).json({ message: "Not found" });
    res.json({ id: inv.id, amount: inv.amount, status: inv.status });
  });

  // 10. Broken Authorization — no role check
  app.post("/api/admin/deactivate", async (req, res) => {
    const { userId } = req.body;
    if (!req.headers["x-user-id"]) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.deactivateUser(userId);
    res.json({ message: `User ${user.username} deactivated` });
  });

  // 11. Open Redirect
  app.get("/api/redirect", (req, res) => {
    const next = req.query.next as string;
    if (!next) return res.status(400).json({ message: "next required" });
    res.redirect(next);
  });

  // 12. Business Logic — coupon stacking
  app.post("/api/checkout/discount", (req, res) => {
    let { baseAmount, coupons: codes } = req.body;
    baseAmount = parseFloat(baseAmount);
    let final = baseAmount;
    const breakdown: Record<string, string> = {};
    for (const code of codes) {
      if (code === "PERCENT50") { const d = final * 0.5; final -= d; breakdown[code] = `-${d.toFixed(2)}`; }
      if (code === "FIXED100")  { final -= 100; breakdown[code] = "-100.00"; }
    }
    res.json({ finalAmount: Math.max(0, final), breakdown });
  });

  // 13. Weak Randomness
  app.get("/api/generate-token", (_req, res) => {
    res.json({ token: Math.random().toString(36).substring(2, 15) });
  });

  // 14. Prototype Pollution — via Object.assign + user input
  app.post("/api/process-file", (req, res) => {
    const { filename, operations } = req.body;
    let config: any = { allowed: true, owner: "system" };
    for (const op of operations) Object.assign(config, op);
    res.json({ result: `Processed ${filename}: ${JSON.stringify(config)}` });
  });

  // 15. marked@0.3.6 — XSS: renders user markdown without sanitisation
  // CVE-2022-21681, CVE-2022-21680 — ReDoS + XSS in old marked versions
  app.post("/api/tools/render-advisory", (req, res) => {
    const { markdown } = req.body;
    if (!markdown) return res.status(400).json({ message: "markdown required" });
    // marked@0.3.6 does not strip <script> tags or sanitise href="javascript:"
    const html = marked(markdown);
    res.json({ html });
  });

  // 16. node-serialize@0.0.4 — RCE via IIFE in serialised object
  // CVE-2017-5941: unserialize() calls eval() on function-valued properties
  app.post("/api/preferences/save", (req, res) => {
    const { data } = req.body;
    try {
      const prefs = serialize.unserialize(data); // RCE if data contains {"x":"_$$ND_FUNC$$_function(){...}()"}
      res.json({ saved: true, prefs });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // 17. lodash@4.17.15 — Prototype Pollution via _.merge
  // CVE-2019-10744: merging __proto__ key pollutes Object.prototype
  app.post("/api/tools/merge-config", (req, res) => {
    const { base, overrides } = req.body;
    const merged = _.merge({}, base, overrides); // VULN: overrides can contain __proto__
    res.json({ config: merged });
  });

  return httpServer;
}
