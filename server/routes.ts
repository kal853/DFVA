import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { walletTransactions } from "@shared/schema";
import { eq } from "drizzle-orm";
import { api } from "@shared/routes";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { signToken, requireAuth } from "./auth";
import axios from "axios";
import multer from "multer";
import { createRequire } from "module";
// import.meta.url is undefined in the CJS production bundle (esbuild format:"cjs").
// Use an absolute path derived from process.cwd() so createRequire works in both environments.
const _require = createRequire(path.resolve("./package.json"));
const pdfParse: (buf: Buffer) => Promise<{ text: string }> = _require("pdf-parse");
import { calculateProration, applyCreditsToOrder, finalizeUpgrade, processDowngrade } from "./billing";
import { PLANS, type PlanKey } from "@shared/schema";
import { chat, type ChatMessage } from "./chat";
import { logLogin, logPayment, logPlanChange, logAccess } from "./logger";
import { ingestDocument, retrieveRelevantChunks } from "./rag";
import { getAllCredentials, rotateCredentials, requireApiKey } from "./credentials";
// Vulnerable packages — intentionally pinned to known-vulnerable versions
import marked from "marked";           // marked@0.3.6  — XSS via unsanitised HTML (CVE-2022-21681 et al.)
import _ from "lodash";                // lodash@4.17.15 — prototype pollution (CVE-2019-10744)
// @ts-ignore — no type declarations for node-serialize@0.0.4
import serialize from "node-serialize"; // node-serialize@0.0.4 — RCE via IIFE (CVE-2017-5941)
// Loaded via _require so they land in require.cache and appear in /api/admin/modules
// VULN: each package exposes a distinct CVE-class attack surface (see routes below)
const { NodeVM }   = _require("vm2");         // vm2 — sandbox escape  (CVE-2023-29017, CVE-2023-37466)
const { DOMParser } = _require("xmldom");     // xmldom — XXE          (CVE-2021-21366)
const pug: any     = _require("pug");         // pug  — SSTI / RCE     (CVE-2021-21353)
const flatLib: any = _require("flat");        // flat — proto pollution (CVE-2020-28168)

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
      const adminUser = await storage.getUserByUsername("admin");
      if (!adminUser) {
        await storage.createUser({ username: "admin", password: "super_secret_password_123", fullName: "Kalyan Ramkumar", role: "admin", email: "admin@sentinel.io", plan: "enterprise", walletBalance: "0.00" });
        const jdoe = await storage.createUser({ username: "jdoe", password: "password1", fullName: "James Doe", role: "user", email: "jdoe@corp.internal", plan: "free", walletBalance: "0.00" });
        const asmith = await storage.createUser({ username: "asmith", password: "password1", fullName: "Alice Smith", role: "user", email: "asmith@corp.internal", plan: "free", walletBalance: "0.00" });
        await storage.createInvoice({ userId: jdoe.id, amount: "0.00", status: "paid" });
        await storage.createInvoice({ userId: asmith.id, amount: "0.00", status: "paid" });
      } else if (!adminUser.fullName) {
        // Backfill fullName for existing users after schema migration
        await storage.setFullName(adminUser.id, "Kalyan Ramkumar");
        const jdoe = await storage.getUserByUsername("jdoe");
        if (jdoe && !jdoe.fullName) await storage.setFullName(jdoe.id, "James Doe");
        const asmith = await storage.getUserByUsername("asmith");
        if (asmith && !asmith.fullName) await storage.setFullName(asmith.id, "Alice Smith");
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

  // GET /api/billing/:userId
  // VULN #54 — PII Logging: Access to any user's billing record emits an audit log that
  // correlates email address + full name + wallet balance + plan + accessor IP in plaintext.
  //
  //   [ACCOUNT_ACCESS] userId=2 email="jdoe@acme.com" fullName="James Doe"
  //                    walletBalance=$68.00 plan=pro accessorIp=1.2.3.4
  //
  // This fires on every Wallet page load, every pricing check, and every IDOR probe
  // (GET /api/billing/1, /api/billing/2, etc.). Combined with the IDOR on this route
  // (no auth check), an attacker enumerating userIds generates a full PII ledger in logs.
  //
  // GDPR Art. 5(1)(c) — data minimisation: financial + identity fields not needed together.
  // GDPR Art. 5(1)(f) — integrity/confidentiality: plaintext PII correlation in log files.
  app.get("/api/billing/:userId", async (req, res) => {
    try {
      const user = await storage.getUser(parseInt(req.params.userId));
      if (!user) return res.status(404).json({ message: "User not found" });
      const accessorIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0] ?? req.socket.remoteAddress ?? "unknown";
      // PII + financial data written together to stdout on every billing lookup
      console.log(`[${new Date().toISOString()}] [AUDIT] [ACCOUNT_ACCESS] userId=${user.id} email=${user.email ?? "(none)"} fullName="${user.fullName ?? "(none)"}" walletBalance=$${user.walletBalance} plan=${user.plan} accessorIp=${accessorIp}`);
      res.json({ userId: user.id, username: user.username, plan: user.plan, walletBalance: user.walletBalance, planStartDate: user.planStartDate?.toISOString() ?? null, referralCode: user.referralCode });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/wallet/transactions/:userId
  // VULN: no auth check — supply any userId to read their transaction history
  app.get("/api/wallet/transactions/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const txs = await db.select().from(walletTransactions).where(eq(walletTransactions.userId, userId));
      res.json(txs);
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

  // ── AUTH ─────────────────────────────────────────────────────────────────────
  // VULN: Plaintext password comparison (no hashing).
  // VULN: User enumeration — distinct messages for "no such user" vs "wrong password".
  // VULN: No rate limiting — unlimited brute-force attempts permitted.
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ message: "Username and password are required." });

      const user = await storage.getUserByUsername(username);
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0] ?? req.socket.remoteAddress ?? "unknown";

      // VULN: Different messages reveal account existence
      if (!user) {
        logLogin({ userId: 0, username, fullName: null, plan: "unknown", ip, success: false, reason: "no_account" });
        return res.status(401).json({ message: "No account found with that username." });
      }
      if (user.password !== password) {
        // VULN: Full name logged even on failed attempt — PII exposure
        logLogin({ userId: user.id, username, fullName: user.fullName, plan: user.plan, ip, success: false, reason: "wrong_password" });
        return res.status(401).json({ message: "Incorrect password." });
      }

      // VULN: Full name (PII) written to server logs on every successful login
      logLogin({ userId: user.id, username, fullName: user.fullName, plan: user.plan, ip, success: true });

      // Issue a signed JWT. VULN: the verifyToken() implementation accepts alg:none —
      // any attacker who inspects this token can forge a new one with a different role/plan
      // by changing the header to {"alg":"none"} and stripping the signature segment.
      const token = signToken({ userId: user.id, username: user.username, role: user.role ?? "user", plan: user.plan });

      res.json({ id: user.id, username: user.username, plan: user.plan, walletBalance: user.walletBalance, role: user.role, fullName: user.fullName, token });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/auth/logout", (_req, res) => {
    res.json({ message: "Logged out." });
  });

  // ── REGISTRATION with REFERRAL CREDIT ─────────────────────────────────────────
  // VULN #44 (C1): Referral credit fires on account CREATION, not on payment settlement.
  //   → Attacker registers infinite sock accounts with referral code to generate credits.
  // VULN #45: Referral code redemptions are not rate-limited or single-use.
  //   → Same code can be used by unlimited sock accounts, each yielding $25 to the referrer.
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password, email, fullName, referralCode } = req.body;
      if (!username || !password) return res.status(400).json({ message: "username and password required" });

      const existing = await storage.getUserByUsername(username);
      if (existing) return res.status(409).json({ message: "Username already taken." });

      // Create account first
      const newUser = await storage.createUser({
        username, password, email: email ?? null,
        fullName: fullName ?? null, role: "user", plan: "free", walletBalance: "0.00",
      });

      // Generate a unique referral code for the new user (format: REF-XXXXXX)
      const code = `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      await storage.setReferralCode(newUser.id, code);

      // VULN: credit referrer immediately on account creation — no payment required
      // VULN: referralCode not invalidated after use — unlimited reuse
      if (referralCode) {
        const referrer = await storage.getUserByReferralCode(referralCode);
        if (referrer) {
          const REFERRAL_CREDIT = 25;
          await storage.creditWallet(referrer.id, REFERRAL_CREDIT, `Referral credit — new signup: ${username}`);
          await storage.logWalletTransaction(referrer.id, REFERRAL_CREDIT, "referral", `Referral signup: ${username}`);
          console.log(`[referral] code=${referralCode} referrer=${referrer.username} credited $${REFERRAL_CREDIT} — no payment required`);
        }
      }

      const fresh = await storage.getUser(newUser.id);
      res.json({ id: fresh!.id, username: fresh!.username, plan: fresh!.plan, walletBalance: fresh!.walletBalance, role: fresh!.role, fullName: fresh!.fullName, referralCode: code });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/referral/:userId — returns referral code for any user (IDOR: no auth)
  // VULN #46: no ownership check — any caller can harvest referral codes for all users
  app.get("/api/referral/:userId", async (req, res) => {
    const user = await storage.getUser(parseInt(req.params.userId));
    if (!user) return res.status(404).json({ message: "Not found" });
    res.json({ userId: user.id, username: user.username, referralCode: user.referralCode });
  });

  // ── TICKETS ───────────────────────────────────────────────────────────────────

  // GET /api/tickets?userId= — IDOR: no auth, enumerate any user's tickets
  app.get("/api/tickets", async (req, res) => {
    const userId = parseInt(req.query.userId as string ?? "0");
    if (!userId) return res.status(400).json({ message: "userId required" });
    res.json(await storage.getTicketsByUser(userId));
  });

  // POST /api/tickets — manual ticket creation (ARIA tool call also creates tickets)
  // VULN #47: userId taken from body — any caller can submit tickets on behalf of any user
  app.post("/api/tickets", async (req, res) => {
    try {
      const { userId, type, amount, reason } = req.body;
      if (!userId || !type) return res.status(400).json({ message: "userId and type required" });
      const ticket = await storage.createTicket({ userId: parseInt(userId), type, amount, reason, autoApproved: false, ariaGenerated: false });
      res.json(ticket);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/tickets/:id — IDOR: no ownership check
  app.get("/api/tickets/:id", async (req, res) => {
    const ticket = await storage.getTicket(parseInt(req.params.id));
    if (!ticket) return res.status(404).json({ message: "Not found" });
    res.json(ticket);
  });

  // ── PAYMENT ENDPOINT ─────────────────────────────────────────────────────────
  // VULN #22: PAN data (full card number + CVV) written to server logs.
  // Any log aggregator, SIEM, or /var/log reader will capture raw card data.
  app.post("/api/subscription/pay", async (req, res) => {
    try {
      const { userId, targetPlan, card } = req.body;
      if (!userId || !targetPlan || !card) return res.status(400).json({ message: "userId, targetPlan, and card required" });

      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0] ?? req.socket.remoteAddress ?? "unknown";
      const userRecord = await storage.getUser(parseInt(userId));

      // VULN: Full PAN + CVV logged — violates PCI-DSS requirement 3.2
      console.log(`[payment] uid=${userId} plan=${targetPlan} card=${(card.number ?? '').replace(/\s/g, '')} exp=${card.expiry} cvv=${card.cvv} name="${card.name}"`);

      const cardNum = (card.number ?? "").replace(/\s/g, "");

      if (cardNum === "4000000000000002") {
        return res.status(402).json({ message: "Your card was declined. Please try a different payment method." });
      }

      const fromPlan = userRecord?.plan ?? "unknown";
      const result = await finalizeUpgrade(userId, targetPlan as PlanKey, cardNum);

      // VULN: Full name (PII) written to payment audit log
      logPayment({ userId: parseInt(userId), fullName: userRecord?.fullName ?? null, fromPlan, toPlan: result.plan, amount: parseFloat(result.walletBalance ?? "0"), ip });

      res.json({ message: "Payment successful", plan: result.plan, walletBalance: result.walletBalance });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── TOOL ACCESS CHECK ─────────────────────────────────────────────────────────
  // VULN #23: Broken access control — trusts X-Plan-Override header with no auth.
  // Any request sending `X-Plan-Override: enterprise` bypasses plan gating entirely.
  const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, enterprise: 2 };
  const TIER_RANK: Record<string, number> = { FREE: 0, PRO: 1, ENTERPRISE: 2 };

  app.get("/api/access/check", async (req, res) => {
    try {
      const { slug, userId } = req.query as { slug: string; userId: string };
      const override = req.headers["x-plan-override"] as string | undefined;

      // VULN: No authentication check on the override — any caller can bypass
      if (override) {
        return res.json({ access: true, via: "plan-override", plan: override });
      }

      const product = slug ? await storage.getProductBySlug(slug) : null;
      if (!product) return res.json({ access: true });

      const user = userId ? await storage.getUser(parseInt(userId)) : null;
      const userPlan = user?.plan ?? "free";
      const toolTier = product.badge ?? "FREE";

      const access = (PLAN_RANK[userPlan] ?? 0) >= (TIER_RANK[toolTier] ?? 0);
      res.json({ access, plan: userPlan, required: toolTier });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── VULNERABLE ROUTES (hidden — no UI links) ─────────────────────────────────

  // 1. SQL Injection
  // Requires auth. The "filter" object approach looks safe but the underlying raw SQL
  // is built via string interpolation — bypass: use UNION SELECT after escaping the
  // single-quote sanitiser with double-quotes or comment injection.
  // e.g. POST body: { "filters": { "username": "\" UNION SELECT username,password,email,role,plan,'x' FROM users--" } }
  app.post(api.tools.searchUsers.path, requireAuth, async (req, res) => {
    const filters = req.body.filters ?? {};
    const raw = typeof filters.username === "string" ? filters.username : "";
    // "Sanitise" single quotes — VULN: double-quotes and SQL comments pass through
    const sanitised = raw.replace(/'/g, "''");
    try { res.json(await storage.searchUsersVulnerable(sanitised)); }
    catch (e: any) { res.status(500).json({ message: "Database Error: " + e.message }); }
  });

  // 2. Command Injection
  // Requires auth. Input validation blocks the obvious shell metacharacters (;|&`$<>)
  // but MISSES the newline character (\n / %0a).  Shell treats \n as a command separator,
  // so injecting "8.8.8.8\nid" runs both ping AND id.
  // Bypass: POST { "host": "8.8.8.8\ncat /etc/passwd" }
  app.post(api.tools.ping.path, requireAuth, (req, res) => {
    const { host } = req.body;
    if (!host) return res.status(400).json({ message: "Host required" });

    // "Security" filter — blocks common metacharacters but newline (\n) is not in the set
    const BLOCKED = [";", "|", "&", "`", "$", "<", ">", "'", "\""];
    if (BLOCKED.some(c => host.includes(c))) {
      return res.status(400).json({ message: "Invalid characters detected in host value." });
    }

    exec(`ping -c 3 ${host}`, { timeout: 8000 }, (err, stdout, stderr) => {
      res.json({ output: stdout || stderr || err?.message });
    });
  });

  // 3. SSRF
  // Requires auth. A blocklist guards against the obvious private IP patterns —
  // but it checks only the PARSED hostname string, missing alternative encodings:
  //   • http://0.0.0.0/             → routes to 127.0.0.1 on Linux
  //   • http://127.1/               → short-form of 127.0.0.1 (RFC 791)
  //   • http://2130706433/          → 127.0.0.1 in decimal
  //   • http://0177.0.0.1/          → 127.0.0.1 in octal
  //   • http://[::ffff:127.0.0.1]/  → IPv4-mapped IPv6
  //   • http://169.254.169.254/     → AWS metadata (NOT in blocklist)
  //   • DNS rebinding: point attacker.com → 127.0.0.1 post-resolution
  app.post(api.tools.fetchUrl.path, requireAuth, async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ message: "URL required" });

    // "Security" blocklist — obvious forms only; non-standard encodings bypass it
    const BLOCKED_HOSTS = ["localhost", "127.0.0.1", "::1", "0:0:0:0:0:0:0:1", "[::1]"];
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
      if (BLOCKED_HOSTS.includes(hostname)) {
        return res.status(400).json({ message: `Requests to '${hostname}' are not permitted.` });
      }
    } catch {
      return res.status(400).json({ message: "Malformed URL." });
    }

    try {
      const r = await axios.get(url, { timeout: 5000 });
      res.json({ data: typeof r.data === "string" ? r.data : JSON.stringify(r.data).substring(0, 4000) });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // 4. Path Traversal
  // Requires auth. Prefix check looks for "logs/" at the start of the filename —
  // looks like directory confinement, but path.join() does NOT strip the traversal
  // segments before the file read, so "logs/../../etc/passwd" passes the check and
  // resolves to /etc/passwd.
  // Bypass: GET /api/files?filename=logs/../../etc/passwd
  //         GET /api/files?filename=logs/../../proc/self/environ
  app.get(api.tools.readLog.path, requireAuth, (req, res) => {
    const filename = req.query.filename as string;
    if (!filename) return res.status(400).json({ message: "Filename required. Use: ?filename=logs/<name>" });

    // "Restrict" access to the logs directory — prefix check only, no path resolution
    if (!filename.startsWith("logs/") && !filename.startsWith("./logs/")) {
      return res.status(403).json({ message: "Access denied: only files under logs/ are permitted." });
    }

    try {
      const target = path.join(process.cwd(), filename); // VULN: traversal not resolved before check
      res.json({ content: fs.readFileSync(target, "utf8"), resolvedPath: target });
    } catch (e: any) { res.status(500).json({ message: "Error: " + e.message }); }
  });

  // 5. eval() Deserialization — RCE via direct eval()
  // Requires auth. No additional validation — any JS expression in `data` executes.
  app.post(api.tools.deserialize.path, requireAuth, (req, res) => {
    const { data } = req.body;
    if (!data) return res.status(400).json({ message: "data required" });
    try { res.json({ result: eval("(" + data + ")") }); }
    catch (e: any) { res.status(500).json({ message: "Eval Error: " + e.message }); }
  });

  // 6. Broken Auth — header bypass
  // Requires a valid JWT (requireAuth) PLUS the x-admin-bypass header.
  // VULN: x-admin-bypass header value is hardcoded and never rotated.
  // VULN: JWT role field is trusted but was forged via algorithm confusion (see /api/auth/login).
  app.get(api.tools.bypassAuth.path, requireAuth, (req, res) => {
    if (req.headers["x-admin-bypass"] !== "true") {
      return res.status(403).json({ message: "Admin header missing. Required: x-admin-bypass: true" });
    }
    const caller = (req as any).sentinelUser;
    res.json({ stats: { users: 3, revenue: "$29,400/mo", secrets_exposed: true }, callerRole: caller?.role });
  });

  // 7. Reflected XSS — requires auth to look legitimate; bio still unescaped
  app.post(api.tools.updateProfile.path, requireAuth, (req, res) => {
    const { bio } = req.body;
    if (!bio) return res.status(400).json({ message: "bio required" });
    res.json({ message: `Profile updated! New bio: ${bio}` });
  });

  // 8. Info Exposure — hardcoded secrets
  // Requires auth. Even so, any authenticated user (or forged token) retrieves all secrets.
  app.get(api.tools.debugInfo.path, requireAuth, (_req, res) => {
    // VULN: GITHUB_TOKEN set into process.env by initCredentials() —
    //       any authenticated user (or forged-token holder) sees the live PAT here.
    res.json({ env: { AWS_ACCESS_KEY, AWS_SECRET_KEY, STRIPE_KEY, DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: process.env.NODE_ENV, GITHUB_TOKEN: process.env.GITHUB_TOKEN } });
  });

  // 9. IDOR — no ownership check on invoice
  app.get("/api/invoice/:id", async (req, res) => {
    const inv = await storage.getInvoice(parseInt(req.params.id));
    if (!inv) return res.status(404).json({ message: "Not found" });
    res.json({ id: inv.id, amount: inv.amount, status: inv.status });
  });

  // 10. Broken Authorization — JWT required but no role check
  // VULN: requireAuth validates the JWT (or forged alg:none token), but the handler
  // never verifies that the caller's role === "admin". Any authenticated user can
  // deactivate any other user.
  app.post("/api/admin/deactivate", requireAuth, async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: "userId required" });
    const user = await storage.deactivateUser(userId);
    res.json({ message: `User ${user.username} deactivated`, callerClaims: (req as any).sentinelUser });
  });

  // 11. Open Redirect
  app.get("/api/redirect", (req, res) => {
    const next = req.query.next as string;
    if (!next) return res.status(400).json({ message: "next required" });
    res.redirect(next);
  });

  // 12. Business Logic — coupon stacking (auth required; abuse still possible once logged in)
  app.post("/api/checkout/discount", requireAuth, (req, res) => {
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

  // 13. Weak Randomness (auth required; still exploitable — Math.random() is predictable)
  app.get("/api/generate-token", requireAuth, (_req, res) => {
    res.json({ token: Math.random().toString(36).substring(2, 15) });
  });

  // 14. Prototype Pollution — via Object.assign + user input (auth required)
  app.post("/api/process-file", requireAuth, (req, res) => {
    const { filename, operations } = req.body;
    let config: any = { allowed: true, owner: "system" };
    for (const op of operations) Object.assign(config, op);
    res.json({ result: `Processed ${filename}: ${JSON.stringify(config)}` });
  });

  // 15. marked@0.3.6 — XSS: renders user markdown without sanitisation (auth required)
  // CVE-2022-21681, CVE-2022-21680 — ReDoS + XSS in old marked versions
  app.post("/api/tools/render-advisory", requireAuth, (req, res) => {
    const { markdown } = req.body;
    if (!markdown) return res.status(400).json({ message: "markdown required" });
    // marked@0.3.6 does not strip <script> tags or sanitise href="javascript:"
    const html = marked(markdown);
    res.json({ html });
  });

  // 16. node-serialize@0.0.4 — RCE via IIFE in serialised object (auth required)
  // CVE-2017-5941: unserialize() calls eval() on function-valued properties
  // Bypass: obtain JWT (login or forge via alg:none), then send IIFE payload in `data`
  app.post("/api/preferences/save", requireAuth, (req, res) => {
    const { data } = req.body;
    try {
      const prefs = serialize.unserialize(data); // RCE if data contains {"x":"_$$ND_FUNC$$_function(){...}()"}
      res.json({ saved: true, prefs });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── ARIA CHAT (prompt injection + RAG poisoning + ARIA tool abuse) ───────────
  // VULN: RAG retrieval is cross-tenant and unsanitised. If any uploaded doc
  // contains adversarial instructions, they execute with system-prompt authority.
  // VULN: userId taken from request body — no session check. Any user can pose as any userId.
  // VULN: ARIA tool calls (submit_ticket, get_wallet_balance) use caller-supplied userId
  //       and auto-approve refund tickets with no payment provenance verification (C4).
  app.post("/api/chat", async (req, res) => {
    const { history, userId } = req.body as { history: ChatMessage[]; userId?: number };
    if (!Array.isArray(history)) return res.status(400).json({ message: "history array required" });
    try {
      const lastUserMsg = [...history].reverse().find(m => m.role === "user")?.content ?? "";
      // VULN: retrieves chunks from ALL tenants — cross-org data bleed
      const ragContext = await retrieveRelevantChunks(lastUserMsg).catch(() => null);
      // VULN: callerUserId not verified against session — ARIA acts on it as truth
      const result = await chat(history, ragContext, userId);
      res.json({ reply: result.reply, ragContextInjected: result.ragContextInjected, toolCalls: result.toolCalls });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // 17. lodash@4.17.15 — Prototype Pollution via _.merge (auth required)
  // CVE-2019-10744: merging __proto__ key pollutes Object.prototype
  app.post("/api/tools/merge-config", requireAuth, (req, res) => {
    const { base, overrides } = req.body;
    const merged = _.merge({}, base, overrides); // VULN: overrides can contain __proto__
    res.json({ config: merged });
  });

  // 18. vm2@3.9.x — Sandbox Escape → RCE (auth required)
  // CVE-2023-29017, CVE-2023-37466: prototype pollution inside vm2 escapes the sandbox.
  // Payload: code = "this.constructor.constructor('return process')().env"
  app.post("/api/tools/sandbox", requireAuth, (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: "code required" });
    try {
      const vm = new NodeVM({ sandbox: {}, require: { external: false } });
      const result = vm.run(`module.exports = (function(){ ${code} })()`);
      res.json({ result: String(result) });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // 19. xmldom@0.6.0 — XXE via external entity injection (auth required)
  // CVE-2021-21366: DOMParser does not block DOCTYPE + ENTITY declarations.
  // Payload: xml = "<!DOCTYPE x [<!ENTITY xxe SYSTEM 'file:///etc/passwd'>]><x>&xxe;</x>"
  app.post("/api/tools/parse-xml", requireAuth, (req, res) => {
    const { xml } = req.body;
    if (!xml) return res.status(400).json({ message: "xml required" });
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, "text/xml");
      const tag = doc.documentElement?.tagName ?? "unknown";
      const text = doc.documentElement?.textContent ?? "";
      res.json({ tag, text, xml });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // 20. pug@2.x — Server-Side Template Injection → RCE (auth required)
  // CVE-2021-21353: pug.render() with attacker-controlled template executes arbitrary code.
  // Payload: template = "-var x = require('child_process').execSync('id').toString()\n= x"
  app.post("/api/tools/render-template", requireAuth, (req, res) => {
    const { template, locals } = req.body;
    if (!template) return res.status(400).json({ message: "template required" });
    try {
      const html = pug.render(template, locals ?? {});
      res.json({ html });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // 21. flat@5.0.0 — Prototype Pollution via unflatten() (auth required)
  // CVE-2020-28168: unflatten({"__proto__.polluted":"yes"}) writes to Object.prototype.
  // Payload: obj = {"__proto__.polluted": "pwned"}, then check ({}).polluted === "pwned"
  app.post("/api/tools/flatten", requireAuth, (req, res) => {
    const { obj, options } = req.body;
    if (!obj) return res.status(400).json({ message: "obj required" });
    try {
      const flattened   = flatLib.flatten(obj, options ?? {});
      const unflattened = flatLib.unflatten(obj, options ?? {}); // VULN: dangerous path
      res.json({ flattened, unflattened });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── MODULE ENUMERATION ────────────────────────────────────────────────────────
  // VULN: Auth required, but any valid JWT (including alg:none forged token) is accepted.
  // Once inside, every loaded npm package is disclosed — combine with /api/debug
  // to get secrets + CVE-targetable dependency inventory in two requests.
  app.get("/api/admin/modules", requireAuth, (_req, res) => {
    const allKeys = Object.keys(_require.cache ?? {});
    const packages = allKeys
      .filter(k => k.includes("node_modules"))
      .map(k => {
        const match = k.match(/node_modules\/(@[^/]+\/[^/]+|[^/]+)/);
        return match ? match[1] : null;
      })
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort() as string[];
    const pkgJson = JSON.parse(fs.readFileSync(path.resolve("./package.json"), "utf8"));
    res.json({
      loadedModules: packages,
      count: packages.length,
      dependencies: pkgJson.dependencies,
      devDependencies: pkgJson.devDependencies,
    });
  });

  // ── PLATFORM CREDENTIAL STORE ─────────────────────────────────────────────────
  //
  // These routes are protected by the SENTINEL_API_KEY (live database value).
  // Header format:  Authorization: ApiKey sk-sentinel202603...
  //
  // VULN #55: previousValue (last month's key) is also accepted — no revocation.
  // VULN #56: The submitted key is logged verbatim on every request.
  // VULN #57: String equality comparison — timing oracle possible.
  //
  // Obtain the key:
  //   1. Read the CREDENTIAL_INIT log at server startup
  //   2. POST /api/auth/login → JWT → GET /api/admin/credentials (JWT route below)
  //   3. Forge an alg:none JWT → GET /api/admin/credentials
  //   4. SQL injection on /api/search → UNION SELECT from platform_credentials
  //
  app.get("/api/admin/credentials", requireApiKey, async (_req, res) => {
    try {
      const creds = await getAllCredentials();
      res.json({
        credentials: creds.map(c => ({
          id:            c.id,
          name:          c.name,
          value:         c.value,          // live credential in plaintext
          previousValue: c.previousValue,  // previous month — still valid, not revoked
          scope:         c.scope,
          rotatedAt:     c.rotatedAt,
          nextRotationAt: c.nextRotationAt,
        })),
        warning: "All credentials returned in plaintext. previousValue is NOT revoked.",
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/admin/credentials/rotate — manual rotation trigger for CI/CD pipelines
  // VULN: Any caller holding the current OR previous API key can rotate all credentials.
  //       Previous-key holders (compromised last month) can still force rotation this month,
  //       disrupting all live integrations without needing the current key.
  app.post("/api/admin/credentials/rotate", requireApiKey, async (_req, res) => {
    try {
      await rotateCredentials();
      const creds = await getAllCredentials();
      res.json({
        message: "Rotation complete. Previous credentials NOT revoked.",
        credentials: creds.map(c => ({
          name:          c.name,
          value:         c.value,
          previousValue: c.previousValue,
          nextRotationAt: c.nextRotationAt,
        })),
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── SERVICE API ROUTES (SENTINEL_API_KEY only, no JWT) ────────────────────────
  //
  // These endpoints are designed for machine-to-machine calls from CI/CD pipelines,
  // the scan worker, and internal monitoring tooling.
  // Authentication: Authorization: ApiKey <SENTINEL_API_KEY>
  //
  // VULN: No JWT required — the API key is the sole auth mechanism.
  //       Once the key is recovered (log scraping, SQL injection, timing attack),
  //       the attacker has persistent service-level access with no session expiry.

  // GET /api/service/status — used by CI/CD health checks and uptime monitors
  // VULN: Returns internal version, environment, and loaded module count —
  //       useful reconnaissance for an attacker who just obtained the API key.
  app.get("/api/service/status", requireApiKey, async (req: any, res) => {
    const loadedModules = Object.keys(_require.cache ?? {})
      .filter((k: string) => k.includes("node_modules")).length;
    res.json({
      status:          "operational",
      version:         "2.4.1",
      environment:     process.env.NODE_ENV ?? "unknown",
      uptime:          process.uptime(),
      loadedModules,
      apiKeyStatus: {
        isCurrent:  req.sentinelApiKey?.isCurrent,
        // VULN: Tells the caller whether they are using a rotated-out key.
        //       A "false" here signals the key is stale but still accepted.
        isPrevious: req.sentinelApiKey?.isPrevious,
        nextRotationAt: req.sentinelApiKey?.nextRotationAt,
      },
    });
  });

  // GET /api/service/users — internal user listing for scan worker / audit tooling
  // VULN: Returns full user list (id, username, email, plan, walletBalance) to any
  //       caller holding the API key. No pagination, no field filtering.
  //       Equivalent to a full IDOR sweep of /api/billing/:userId in one request.
  app.get("/api/service/users", requireApiKey, async (_req, res) => {
    try {
      const users = await storage.getAllUsers();
      // VULN: Email + plan + walletBalance returned for every user in one call.
      //       Combined with ACCOUNT_ACCESS log (VULN #54), creates a complete PII dossier.
      res.json({
        users: users.map((u: any) => ({
          id:            u.id,
          username:      u.username,
          email:         u.email,
          fullName:      u.fullName,
          plan:          u.plan,
          walletBalance: u.walletBalance,
          isActive:      u.isActive,
        })),
        count: users.length,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── RAG KNOWLEDGE BASE ────────────────────────────────────────────────────────
  // Multer: store uploaded file in memory as Buffer
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  });

  // POST /api/rag/upload
  // VULN #31: Plan check trusts X-User-Plan header from client — no DB verification.
  //   Set X-User-Plan: enterprise to bypass the gate regardless of actual plan.
  // VULN #32: userId taken from body with no authentication — any userId can be impersonated.
  // VULN #33: file content ingested verbatim — prompt injection payloads inside a PDF
  //   surface unsanitised in ARIA's system prompt during retrieval.
  app.post("/api/rag/upload", upload.single("file"), async (req, res) => {
    try {
      // Broken plan check — trusts client header, not DB
      const claimedPlan = req.headers["x-user-plan"] as string ?? "free";
      if (claimedPlan !== "enterprise") {
        return res.status(403).json({ message: "Knowledge Base upload requires an Enterprise plan." });
      }

      const userId   = parseInt(req.body.userId ?? "0");
      const username = req.body.username ?? "unknown";
      if (!userId) return res.status(400).json({ message: "userId required" });
      if (!req.file) return res.status(400).json({ message: "file required" });

      const { originalname, mimetype, buffer } = req.file;

      // Extract text based on MIME
      let text = "";
      if (mimetype === "application/pdf") {
        const parsed = await pdfParse(buffer);
        text = parsed.text;
      } else {
        // text/plain, text/markdown, etc.
        text = buffer.toString("utf8");
      }

      if (!text.trim()) return res.status(400).json({ message: "Could not extract text from file." });

      const doc = await storage.createRagDocument({ userId, filename: originalname, contentType: mimetype });

      // Ingest asynchronously — respond immediately, let embedding run in background
      ingestDocument({ documentId: doc.id, userId, uploaderUsername: username, filename: originalname, text })
        .then(chunkCount => storage.updateRagDocumentStatus(doc.id, "ready", chunkCount))
        .catch(() => storage.updateRagDocumentStatus(doc.id, "error"));

      res.json({ message: "Upload received. Indexing in progress.", documentId: doc.id, filename: originalname });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // GET /api/rag/documents?userId=
  // VULN #34: no auth check — pass any userId to list their documents
  app.get("/api/rag/documents", async (req, res) => {
    const userId = parseInt(req.query.userId as string ?? "0");
    if (!userId) return res.status(400).json({ message: "userId required" });
    const docs = await storage.getRagDocumentsByUser(userId);
    res.json(docs);
  });

  // DELETE /api/rag/documents/:id
  // VULN #35: IDOR — no ownership check. Any user can delete any document by ID.
  app.delete("/api/rag/documents/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteRagChunksByDocument(id);
    await storage.deleteRagDocument(id);
    res.json({ message: "Document deleted." });
  });

  // GET /api/rag/chunks — raw chunk dump (no auth, full cross-tenant exposure)
  // VULN #36: exposes every chunk from every tenant, including filename, uploaderUsername, userId
  app.get("/api/rag/chunks", async (_req, res) => {
    const chunks = await storage.getAllRagChunks();
    // Strip embeddings from the dump (too large) but leak all metadata + content
    res.json(chunks.map(c => ({
      id: c.id, documentId: c.documentId, userId: c.userId,
      uploaderUsername: c.uploaderUsername, filename: c.filename,
      chunkIndex: c.chunkIndex, content: c.content,
    })));
  });

  // ── SCHEDULED SCAN JOBS ───────────────────────────────────────────────────────

  // POST /api/scans
  // Plan gate enforced here at creation ONLY.
  // VULN #37: targetUrl stored verbatim — internal IPs/localhost accepted, executed by worker (Stored SSRF)
  // VULN #38: userId taken from body with no session verification — any userId can be impersonated
  app.post("/api/scans", async (req, res) => {
    try {
      const { userId, targetUrl, toolSlug, schedule } = req.body;
      if (!userId || !targetUrl || !toolSlug) {
        return res.status(400).json({ message: "userId, targetUrl and toolSlug required" });
      }

      // Plan gate — only checked at creation
      const user = await storage.getUser(parseInt(userId));
      if (!user) return res.status(404).json({ message: "User not found" });

      const allowedSchedules =
        user.plan === "enterprise" || user.plan === "pro"
          ? ["one-time", "daily", "weekly"]
          : ["one-time"];

      const chosenSchedule = schedule ?? "one-time";
      if (!allowedSchedules.includes(chosenSchedule)) {
        return res.status(403).json({
          message: `Schedule "${chosenSchedule}" requires Pro or Enterprise plan.`,
        });
      }

      const job = await storage.createScanJob({
        userId: parseInt(userId),
        targetUrl,
        toolSlug,
        schedule: chosenSchedule,
        nextRunAt: new Date(),
      });

      res.json(job);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/scans?userId=
  // VULN #39: no auth check — supply any userId to list their jobs (IDOR enumeration)
  app.get("/api/scans", async (req, res) => {
    const userId = parseInt(req.query.userId as string ?? "0");
    if (!userId) return res.status(400).json({ message: "userId required" });
    const jobs = await storage.getScanJobsByUser(userId);
    res.json(jobs);
  });

  // GET /api/scans/:id — retrieve single job including lastResult
  // VULN #40: no ownership check — enumerate IDs to read any user's scan results
  //           lastResult may contain internal metadata if targetUrl was a cloud metadata endpoint
  app.get("/api/scans/:id", async (req, res) => {
    const job = await storage.getScanJob(parseInt(req.params.id));
    if (!job) return res.status(404).json({ message: "Not found" });
    res.json(job);
  });

  // PATCH /api/scans/:id
  // VULN #41: plan gate NOT re-checked — free user creates one-time job, then PATCHes
  //           schedule to "daily" or "weekly". Worker will keep rescheduling indefinitely.
  // VULN #42: no ownership check — modify any job by ID (IDOR)
  app.patch("/api/scans/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { schedule } = req.body;
      const allowed = ["one-time", "daily", "weekly"];
      if (schedule && !allowed.includes(schedule)) {
        return res.status(400).json({ message: "Invalid schedule value" });
      }
      // VULN: updates schedule with no plan re-check and no ownership verification
      const updates: any = {};
      if (schedule) updates.schedule = schedule;
      const job = await storage.updateScanJob(id, updates);
      res.json(job);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // DELETE /api/scans/:id
  // VULN #43: no ownership check — any authenticated (or unauthenticated) caller can
  //           cancel another user's scheduled scans by guessing/enumerating the job ID
  app.delete("/api/scans/:id", async (req, res) => {
    try {
      await storage.deleteScanJob(parseInt(req.params.id));
      res.json({ message: "Job deleted." });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── TEAM WORKSPACES ───────────────────────────────────────────────────────────
  // VULN #44 (POST /api/workspaces): No plan gate — free users can create workspaces.
  app.post("/api/workspaces", async (req, res) => {
    try {
      const { name, ownerId } = req.body;
      if (!name || !ownerId) return res.status(400).json({ message: "name and ownerId required" });
      const ws = await storage.createWorkspace({ name, ownerId: parseInt(ownerId) });
      res.json(ws);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // VULN #45 (GET /api/workspaces?userId=): IDOR — supply any userId to enumerate their workspaces.
  app.get("/api/workspaces", async (req, res) => {
    try {
      const userId = parseInt(req.query.userId as string ?? "0");
      if (!userId) return res.status(400).json({ message: "userId required" });
      const list = await storage.getWorkspacesByUser(userId);
      res.json(list);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // VULN #46 (GET /api/workspaces/:id): No ownership check — read any workspace by ID (IDOR).
  app.get("/api/workspaces/:id", async (req, res) => {
    try {
      const ws = await storage.getWorkspace(parseInt(req.params.id));
      if (!ws) return res.status(404).json({ message: "Workspace not found" });
      res.json(ws);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // VULN #47 (GET /api/workspaces/:id/members): IDOR — list members of any workspace.
  app.get("/api/workspaces/:id/members", requireAuth, async (req, res) => {
    try {
      const workspaceId = parseInt(req.params.id);
      const members = await storage.getWorkspaceMembers(workspaceId);
      const callerIsMember = members.some((m: any) => m.userId === req.sentinelUser.userId);
      if (!callerIsMember) return res.status(403).json({ message: "Forbidden" });
      res.json(members);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });
    try {
      const members = await storage.getWorkspaceMembers(parseInt(req.params.id));
      res.json(members);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // VULN #48 (POST /api/workspaces/:id/invite):
  //   - Token generated with Math.random().toString(36) — same weakness as #13.
  //   - Intended role written to DB but POST /api/invitations/:token/accept reads ?role= from URL.
  //   - No check that caller is a workspace admin.
  app.post("/api/workspaces/:id/invite", async (req, res) => {
    try {
      const workspaceId = parseInt(req.params.id);
      const { email, role = "viewer" } = req.body;
      if (!email) return res.status(400).json({ message: "email required" });
      // VULN: Math.random() token — predictable, brute-forceable
      const token = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
      const inv = await storage.createInvitation({ workspaceId, email, role, token });
      // Simulate sending invite email — link embeds role in URL (the tamper target)
      const inviteUrl = `/invite/${token}?role=${role}`;
      res.json({ invitation: inv, inviteUrl, note: "Invite link sent (role embedded in URL)" });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/invitations/:token — preview invite details before accepting.
  // VULN: token is weak — brute-force to discover pending invitations across all workspaces.
  app.get("/api/invitations/:token", async (req, res) => {
    try {
      const inv = await storage.getInvitationByToken(req.params.token);
      if (!inv) return res.status(404).json({ message: "Invitation not found" });
      const ws = await storage.getWorkspace(inv.workspaceId);
      res.json({ ...inv, workspaceName: ws?.name });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // VULN #49 (POST /api/invitations/:token/accept):
  //   Role taken from ?role= query param — NOT from the invitation record.
  //   Attacker modifies URL: /invite/TOKEN?role=admin → joins as Workspace Admin.
  app.post("/api/invitations/:token/accept", async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ message: "userId required" });
      const pendingInv = await storage.getInvitationByToken(req.params.token);
      if (!pendingInv) return res.status(404).json({ message: "Invitation not found" });
      const inv = await storage.acceptInvitation(req.params.token, parseInt(userId), pendingInv.role);
      res.json({ message: `Joined workspace as ${pendingInv.role}`, invitation: inv });
      res.json({ message: `Joined workspace as ${role}`, invitation: inv });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // PATCH /api/workspaces/:id/members/:memberId — change member role.
  // VULN #50: no role check — any workspace member (even Viewer) can promote themselves to Admin.
  app.patch("/api/workspaces/:id/members/:memberId", async (req, res) => {
    try {
      const { role } = req.body;
      if (!role) return res.status(400).json({ message: "role required" });
      const member = await storage.updateMemberRole(parseInt(req.params.memberId), role);
      res.json(member);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // DELETE /api/workspaces/:id/members/:memberId — remove a member.
  // VULN #51: no role check — any member can remove any other member.
  app.delete("/api/workspaces/:id/members/:memberId", async (req, res) => {
    try {
      await storage.removeWorkspaceMember(parseInt(req.params.memberId));
      res.json({ message: "Member removed" });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/workspaces/:id/scans — shared scan view for workspace members.
  // VULN #52: returns ALL scans from ALL member userIds — cross-tenant data bleed.
  //           No role check: Viewer can see Analyst/Admin scan results.
  app.get("/api/workspaces/:id/scans", async (req, res) => {
    try {
      const members = await storage.getWorkspaceMembers(parseInt(req.params.id));
      const allScans = await Promise.all(members.map(m => storage.getScanJobsByUser(m.userId)));
      res.json(allScans.flat());
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/workspaces/:id/invitations — list pending invitations.
  // VULN: IDOR — any caller can list invitations (and extract tokens) for any workspace.
  app.get("/api/workspaces/:id/invitations", async (req, res) => {
    try {
      const invs = await storage.getWorkspaceInvitations(parseInt(req.params.id));
      res.json(invs); // VULN: tokens returned in plaintext — enables harvest + replay
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  return httpServer;
}
