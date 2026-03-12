import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import axios from "axios";
import { calculateProration, applyCreditsToOrder, finalizeUpgrade, processDowngrade } from "./billing";
import { PLANS, type PlanKey } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Seed DB on startup
  setTimeout(async () => {
    try {
      const admin = await storage.getUserByUsername("admin");
      if (!admin) {
        await storage.createUser({
          username: "admin",
          password: "super_secret_password_123",
          role: "admin",
          email: "admin@corp.internal",
          plan: "enterprise",
          walletBalance: "0.00",
        });

        const jdoe = await storage.createUser({
          username: "jdoe",
          password: "password1",
          role: "user",
          email: "jdoe@corp.internal",
          plan: "pro",
          walletBalance: "50.00",
        });

        const asmith = await storage.createUser({
          username: "asmith",
          password: "password1",
          role: "user",
          email: "asmith@corp.internal",
          plan: "free",
          walletBalance: "0.00",
        });

        await storage.createInvoice({ userId: jdoe.id, amount: "1500.00", status: "unpaid" });
        await storage.createInvoice({ userId: jdoe.id, amount: "2500.00", status: "paid" });
        await storage.createInvoice({ userId: asmith.id, amount: "3000.00", status: "unpaid" });
      }
    } catch (e) {
      console.error("Failed to seed database:", e);
    }
  }, 1000);

  const logsDir = path.join(process.cwd(), "logs");
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
    fs.writeFileSync(path.join(logsDir, "system.log"), "System started successfully.\nAll systems operational.\n");
    fs.writeFileSync(path.join(logsDir, "access.log"), "User admin logged in from 10.0.0.5\nUser jdoe failed login from 10.0.0.12\n");
  }

  const AWS_ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE";
  const AWS_SECRET_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
  const STRIPE_KEY = "sk_test_4eC39HqLyjWDarjtT1zdp7dc";

  // --- EXISTING VULNERABILITY ROUTES ---

  app.get(api.tools.searchUsers.path, async (req, res) => {
    const query = req.query.query as string || "";
    try {
      const results = await storage.searchUsersVulnerable(query);
      res.json(results);
    } catch (e: any) {
      res.status(500).json({ message: "Database Error: " + e.message });
    }
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
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get(api.tools.readLog.path, (req, res) => {
    const filename = req.query.filename as string;
    if (!filename) return res.status(400).json({ message: "Filename required" });
    const filePath = path.join(process.cwd(), "logs", filename);
    try {
      res.json({ content: fs.readFileSync(filePath, 'utf8') });
    } catch (e: any) {
      res.status(500).json({ message: "Error reading file: " + e.message });
    }
  });

  app.post(api.tools.deserialize.path, (req, res) => {
    const { data } = req.body;
    try {
      const result = eval("(" + data + ")");
      res.json({ result });
    } catch (e: any) {
      res.status(500).json({ message: "Deserialization Error: " + e.message });
    }
  });

  app.get(api.tools.bypassAuth.path, (req, res) => {
    const isAdmin = req.headers['x-admin-bypass'] === 'true';
    if (!isAdmin) return res.status(401).json({ message: "Unauthorized. Admin bypass header missing." });
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
    const currentUserId = req.headers['x-user-id'] as string;
    if (!currentUserId) return res.status(401).json({ message: "Not authenticated" });
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
      if (code === "PERCENT50") {
        const discount = finalAmount * 0.5;
        finalAmount -= discount;
        breakdown[code] = `-${discount.toFixed(2)}`;
      }
      if (code === "FIXED100") {
        finalAmount -= 100;
        breakdown[code] = "-100.00";
      }
    }
    res.json({ finalAmount: Math.max(0, finalAmount), breakdown });
  });

  app.get("/api/generate-token", (req, res) => {
    const token = Math.random().toString(36).substring(2, 15);
    res.json({ token });
  });

  app.post("/api/process-file", (req, res) => {
    const { filename, operations } = req.body;
    let config: any = { allowed: true, owner: "system" };
    for (const op of operations) {
      Object.assign(config, op);
    }
    res.json({ result: `Processed ${filename} with config: ${JSON.stringify(config)}` });
  });

  // --- BILLING & SUBSCRIPTION ROUTES ---

  app.get("/api/billing/:userId", async (req, res) => {
    try {
      const user = await storage.getUser(parseInt(req.params.userId));
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({
        userId: user.id,
        username: user.username,
        plan: user.plan,
        walletBalance: user.walletBalance,
        planStartDate: user.planStartDate?.toISOString() ?? null,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post(api.billing.upgrade.path, async (req, res) => {
    try {
      const { userId, targetPlan, paymentMethod } = req.body;
      const result = await finalizeUpgrade(userId, targetPlan as PlanKey, paymentMethod);
      res.json({ message: `Upgraded to ${targetPlan}`, plan: result.plan, walletBalance: result.newBalance });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post(api.billing.downgrade.path, async (req, res) => {
    try {
      const { userId, targetPlan } = req.body;
      const result = await processDowngrade(userId, targetPlan as PlanKey);
      res.json({ message: `Downgraded to ${targetPlan}`, refundAmount: result.refundAmount, walletBalance: result.newBalance });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post(api.billing.applyCredits.path, async (req, res) => {
    try {
      const { userId, orderAmount } = req.body;
      const result = await applyCreditsToOrder(userId, orderAmount);
      res.json({ message: "Credits applied", finalAmount: result.finalAmount, creditsUsed: result.creditsUsed });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post(api.billing.topup.path, async (req, res) => {
    try {
      const { userId, amount } = req.body;
      const user = await storage.topupWallet(userId, amount);
      await storage.logWalletTransaction(userId, amount, "topup", "Manual wallet top-up");
      res.json({ message: `Wallet topped up by $${amount}`, walletBalance: user.walletBalance });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  return httpServer;
}
