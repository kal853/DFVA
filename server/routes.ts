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

const SEED_PRODUCTS = [
  {
    name: "APEX TKL Pro",
    slug: "apex-tkl-pro",
    description: "Tenkeyless mechanical keyboard with hot-swap sockets and per-key RGB.",
    longDescription: "The APEX TKL Pro is engineered for those who refuse to compromise. Hot-swap PCB lets you swap switches without soldering. Anodized aluminum case dampens sound and flex. 8000Hz polling via USB-C. Compatible with QMK and Via firmware.",
    price: "199.00",
    category: "keyboards",
    badge: "Best Seller",
    stock: 48,
    rating: "4.9",
    reviewCount: 312,
    featured: true,
    specs: JSON.stringify({ layout: "TKL (87 key)", switches: "Gateron Yellow Pre-lubed", polling: "8000 Hz", connectivity: "USB-C", backlighting: "Per-key RGB", case: "Anodized Aluminum" }),
  },
  {
    name: "APEX 65% Compact",
    slug: "apex-65-compact",
    description: "Compact 65% layout with arrow keys. Gasket-mounted for a premium typing feel.",
    longDescription: "65% layout keeps arrow keys while shedding the numpad and function row. Gasket mounting isolates the PCB from the case for a softer, bouncier sound profile. Includes south-facing RGB for uniform underglow.",
    price: "149.00",
    category: "keyboards",
    badge: "New",
    stock: 72,
    rating: "4.8",
    reviewCount: 178,
    featured: true,
    specs: JSON.stringify({ layout: "65% (68 key)", switches: "Linear or Tactile", polling: "1000 Hz", connectivity: "USB-C / Wireless 2.4GHz", backlighting: "South-facing RGB", case: "Polycarbonate" }),
  },
  {
    name: "APEX 40% Ortho",
    slug: "apex-40-ortho",
    description: "Ortholinear 40% board. For the minimalist who types faster than they talk.",
    longDescription: "The APEX 40% Ortho features an ortholinear grid layout optimized for home-row usage and layers. Ships with both 2u and 1u thumb cluster configurations. Runs QMK natively.",
    price: "129.00",
    category: "keyboards",
    badge: null,
    stock: 25,
    rating: "4.6",
    reviewCount: 89,
    featured: false,
    specs: JSON.stringify({ layout: "40% Ortholinear", switches: "Kailh Box compatible", polling: "1000 Hz", connectivity: "USB-C", backlighting: "Underglow only", case: "FR4 Sandwich" }),
  },
  {
    name: "Gateron Oil King Switches (35pcs)",
    slug: "gateron-oil-king",
    description: "Factory pre-lubed linear switches. 55g actuation. Buttery smooth.",
    longDescription: "Gateron Oil Kings are pre-lubed from the factory with a proprietary oil formula. 55g actuation force, 4mm travel, long pole stem for satisfying bottom-out. One of the smoothest linears available without additional lubing.",
    price: "32.00",
    category: "switches",
    badge: "Staff Pick",
    stock: 200,
    rating: "4.9",
    reviewCount: 540,
    featured: true,
    specs: JSON.stringify({ type: "Linear", actuation: "55g", travel: "4mm total / 2mm actuation", material: "Nylon housing / POM stem", lubed: "Factory pre-lubed" }),
  },
  {
    name: "Boba U4 Silent Tactile (35pcs)",
    slug: "boba-u4-silent",
    description: "Silent tactile switches with a round, smooth bump. Office-friendly.",
    longDescription: "Boba U4s deliver a noticeable tactile bump without any clack. The silenced stem reduces bottom-out noise to nearly nothing. Perfect for shared workspaces or those who want tactile feedback without the sound.",
    price: "38.00",
    category: "switches",
    badge: null,
    stock: 150,
    rating: "4.7",
    reviewCount: 291,
    featured: false,
    specs: JSON.stringify({ type: "Silent Tactile", actuation: "65g", travel: "4mm total", housing: "POM", stem: "Silenced UHMWPE", lubed: "Light factory lube" }),
  },
  {
    name: "Phantom Keycap Set — Dark",
    slug: "phantom-keycap-dark",
    description: "PBT double-shot keycaps. Cherry profile. Pitch-black with white legends.",
    longDescription: "Phantom Dark is a PBT double-shot set in Cherry profile. Double-shot construction means legends will never fade. Texture is fine and slightly rough — exactly how PBT should feel. Includes base kit + numpad + ISO kit.",
    price: "89.00",
    category: "keycaps",
    badge: "Limited",
    stock: 30,
    rating: "4.8",
    reviewCount: 203,
    featured: true,
    specs: JSON.stringify({ profile: "Cherry", material: "PBT Double-shot", legends: "White / RGB compatible", kits: "Base + Numpad + ISO", compatibility: "MX-style" }),
  },
  {
    name: "Starlight Keycap Set — Milky",
    slug: "starlight-milky",
    description: "Translucent PBT shine-through caps in XDA profile. Ideal for RGB builds.",
    longDescription: "Starlight Milky caps are made from translucent PBT for incredible light diffusion. XDA uniform profile means every row is the same height — great for ortholinear boards or beginners. Legends are laser-etched.",
    price: "65.00",
    category: "keycaps",
    badge: null,
    stock: 60,
    rating: "4.5",
    reviewCount: 117,
    featured: false,
    specs: JSON.stringify({ profile: "XDA", material: "Translucent PBT", legends: "Laser-etched", kits: "Base + Numpad", compatibility: "MX-style" }),
  },
  {
    name: "APEX Desk Mat XL",
    slug: "apex-desk-mat-xl",
    description: "900×400mm extended mat. Stitched edges. Micro-textured surface.",
    longDescription: "The APEX XL desk mat covers your entire setup. Micro-textured surface works with both laser and optical mice at all DPI settings. Natural rubber base prevents slipping. Stitched edges resist fraying after years of use.",
    price: "49.00",
    category: "accessories",
    badge: null,
    stock: 120,
    rating: "4.7",
    reviewCount: 389,
    featured: false,
    specs: JSON.stringify({ size: "900 × 400 × 4mm", surface: "Micro-textured cloth", base: "Natural rubber", edges: "Stitched", compatibility: "Laser & optical mice" }),
  },
  {
    name: "APEX Palm Rest — Walnut",
    slug: "apex-palm-rest-walnut",
    description: "Solid walnut wrist rest. Hand-finished with natural oil. TKL size.",
    longDescription: "Precision CNC-milled from a single piece of American black walnut. Finished with food-safe tung oil. Anti-slip cork base. Fits TKL and 65% keyboards. Each piece has unique grain — no two are identical.",
    price: "79.00",
    category: "accessories",
    badge: "Handmade",
    stock: 18,
    rating: "4.9",
    reviewCount: 64,
    featured: true,
    specs: JSON.stringify({ material: "Solid American Walnut", finish: "Tung oil (food-safe)", base: "Cork anti-slip", size: "360 × 95 × 22mm", fits: "TKL / 65%" }),
  },
  {
    name: "Switch Opener + Lube Kit",
    slug: "switch-lube-kit",
    description: "Everything you need to lube switches. Opener, Krytox 205g0, brush.",
    longDescription: "The ultimate beginner lube kit. Includes a dual-pin switch opener compatible with MX and Kailh box switches, 3ml Krytox 205g0 for linears, 3ml Tribosys 3203 for tactiles, and two detail brushes.",
    price: "28.00",
    category: "accessories",
    badge: null,
    stock: 85,
    rating: "4.6",
    reviewCount: 445,
    featured: false,
    specs: JSON.stringify({ includes: "Dual-pin opener, 205g0 3ml, 3203 3ml, 2x brushes", compatible: "MX, Box, Alps-style", lube_type: "Krytox + Tribosys" }),
  },
];

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Seed DB on startup
  setTimeout(async () => {
    try {
      const admin = await storage.getUserByUsername("admin");
      if (!admin) {
        await storage.createUser({ username: "admin", password: "super_secret_password_123", role: "admin", email: "admin@corp.internal", plan: "enterprise", walletBalance: "0.00" });
        const jdoe = await storage.createUser({ username: "jdoe", password: "password1", role: "user", email: "jdoe@corp.internal", plan: "pro", walletBalance: "50.00" });
        const asmith = await storage.createUser({ username: "asmith", password: "password1", role: "user", email: "asmith@corp.internal", plan: "free", walletBalance: "0.00" });
        await storage.createInvoice({ userId: jdoe.id, amount: "1500.00", status: "unpaid" });
        await storage.createInvoice({ userId: jdoe.id, amount: "2500.00", status: "paid" });
        await storage.createInvoice({ userId: asmith.id, amount: "3000.00", status: "unpaid" });
      }

      const existing = await storage.getProducts();
      if (existing.length === 0) {
        for (const p of SEED_PRODUCTS) {
          await storage.createProduct(p as any);
        }
      }
    } catch (e) {
      console.error("Seed failed:", e);
    }
  }, 1000);

  const logsDir = path.join(process.cwd(), "logs");
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
    fs.writeFileSync(path.join(logsDir, "system.log"), "System started successfully.\nAll systems operational.\n");
    fs.writeFileSync(path.join(logsDir, "access.log"), "User admin logged in from 10.0.0.5\nUser jdoe failed login.\n");
  }

  // ── PRODUCT ROUTES ──────────────────────────────────────────────────────────

  app.get("/api/products", async (req, res) => {
    try {
      const { category, q } = req.query as { category?: string; q?: string };
      let result;
      if (q) {
        result = await storage.searchProducts(q);
      } else {
        result = await storage.getProducts(category);
      }
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/products/featured", async (_req, res) => {
    try {
      res.json(await storage.getFeaturedProducts());
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/products/:slug", async (req, res) => {
    try {
      const product = await storage.getProductBySlug(req.params.slug);
      if (!product) return res.status(404).json({ message: "Product not found" });
      res.json(product);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── BILLING ROUTES ───────────────────────────────────────────────────────────

  app.get("/api/billing/:userId", async (req, res) => {
    try {
      const user = await storage.getUser(parseInt(req.params.userId));
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({ userId: user.id, username: user.username, plan: user.plan, walletBalance: user.walletBalance, planStartDate: user.planStartDate?.toISOString() ?? null });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
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
      await storage.logWalletTransaction(userId, amount, "topup", "Manual wallet top-up");
      res.json({ message: `Wallet topped up by $${amount}`, walletBalance: user.walletBalance });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── HIDDEN VULNERABILITY ROUTES (backend only, no frontend links) ────────────

  const AWS_ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE";
  const AWS_SECRET_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
  const STRIPE_KEY = "sk_test_4eC39HqLyjWDarjtT1zdp7dc";

  app.get(api.tools.searchUsers.path, async (req, res) => {
    const query = req.query.query as string || "";
    try {
      res.json(await storage.searchUsersVulnerable(query));
    } catch (e: any) { res.status(500).json({ message: "Database Error: " + e.message }); }
  });

  app.post(api.tools.ping.path, (req, res) => {
    const { host } = req.body;
    if (!host) return res.status(400).json({ message: "Host required" });
    exec(`ping -c 1 ${host}`, (error, stdout, stderr) => {
      res.status(200).json({ output: stdout || stderr || error?.message || "" });
    });
  });

  app.post(api.tools.fetchUrl.path, async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ message: "URL required" });
    try {
      const response = await axios.get(url);
      res.json({ data: typeof response.data === 'string' ? response.data : JSON.stringify(response.data).substring(0, 1000) });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get(api.tools.readLog.path, (req, res) => {
    const filename = req.query.filename as string;
    if (!filename) return res.status(400).json({ message: "Filename required" });
    try {
      res.json({ content: fs.readFileSync(path.join(process.cwd(), "logs", filename), 'utf8') });
    } catch (e: any) { res.status(500).json({ message: "Error reading file: " + e.message }); }
  });

  app.post(api.tools.deserialize.path, (req, res) => {
    const { data } = req.body;
    try { res.json({ result: eval("(" + data + ")") }); }
    catch (e: any) { res.status(500).json({ message: "Deserialization Error: " + e.message }); }
  });

  app.get(api.tools.bypassAuth.path, (req, res) => {
    if (req.headers['x-admin-bypass'] !== 'true') return res.status(401).json({ message: "Unauthorized." });
    res.json({ stats: { users: 3, uptime: "99.9%", secrets_exposed: true } });
  });

  app.post(api.tools.updateProfile.path, (req, res) => {
    const { bio } = req.body;
    res.json({ message: `Profile updated successfully! New bio: ${bio}` });
  });

  app.get(api.tools.debugInfo.path, (req, res) => {
    res.json({ env: { AWS_ACCESS_KEY, AWS_SECRET_KEY, STRIPE_KEY, DB_URL: process.env.DATABASE_URL, NODE_ENV: process.env.NODE_ENV } });
  });

  app.get("/api/invoice/:id", async (req, res) => {
    const invoice = await storage.getInvoice(parseInt(req.params.id));
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    res.json({ id: invoice.id, amount: invoice.amount, status: invoice.status });
  });

  app.post("/api/admin/deactivate", async (req, res) => {
    const { userId } = req.body;
    if (!req.headers['x-user-id']) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.deactivateUser(userId);
    res.json({ message: `User ${user.username} has been deactivated` });
  });

  app.get("/api/redirect", (req, res) => {
    const next = req.query.next as string;
    if (!next) return res.status(400).json({ message: "next parameter required" });
    res.redirect(next);
  });

  app.post("/api/checkout/discount", (req, res) => {
    let { baseAmount, coupons: couponCodes } = req.body;
    baseAmount = parseFloat(baseAmount);
    let finalAmount = baseAmount;
    const breakdown: Record<string, string> = {};
    for (const code of couponCodes) {
      if (code === "PERCENT50") { const d = finalAmount * 0.5; finalAmount -= d; breakdown[code] = `-${d.toFixed(2)}`; }
      if (code === "FIXED100") { finalAmount -= 100; breakdown[code] = "-100.00"; }
    }
    res.json({ finalAmount: Math.max(0, finalAmount), breakdown });
  });

  app.get("/api/generate-token", (req, res) => {
    res.json({ token: Math.random().toString(36).substring(2, 15) });
  });

  app.post("/api/process-file", (req, res) => {
    const { filename, operations } = req.body;
    let config: any = { allowed: true, owner: "system" };
    for (const op of operations) Object.assign(config, op);
    res.json({ result: `Processed ${filename} with config: ${JSON.stringify(config)}` });
  });

  return httpServer;
}
