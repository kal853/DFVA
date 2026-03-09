import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import axios from "axios";
import crypto from "crypto";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Seed DB with some dummy data if it doesn't exist
  setTimeout(async () => {
    try {
      const admin = await storage.getUserByUsername("admin");
      if (!admin) {
        const adminUser = await storage.createUser({
          username: "admin",
          password: "super_secret_password_123",
          role: "admin",
          email: "admin@corp.internal"
        });
        
        const jdoe = await storage.createUser({
          username: "jdoe",
          password: "password1",
          role: "user",
          email: "jdoe@corp.internal"
        });
        
        const asmith = await storage.createUser({
          username: "asmith",
          password: "password1",
          role: "user",
          email: "asmith@corp.internal"
        });

        // Create sample invoices (IDOR vulnerability - no ownership checks)
        await storage.createInvoice({ userId: jdoe.id, amount: "1500.00", status: "unpaid" });
        await storage.createInvoice({ userId: jdoe.id, amount: "2500.00", status: "paid" });
        await storage.createInvoice({ userId: asmith.id, amount: "3000.00", status: "unpaid" });

        // Create sample coupons for business logic vuln
        // @ts-ignore
        await storage.getCoupon("PERCENT50"); // stub
      }
    } catch (e) {
      console.error("Failed to seed database:", e);
    }
  }, 1000);

  // Ensure logs directory exists
  const logsDir = path.join(process.cwd(), "logs");
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
    fs.writeFileSync(path.join(logsDir, "system.log"), "System started successfully.\nAll systems operational.\n");
    fs.writeFileSync(path.join(logsDir, "access.log"), "User admin logged in from 10.0.0.5\nUser jdoe failed login from 10.0.0.12\n");
  }

  // HARDCODED SECRETS
  const AWS_ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE";
  const AWS_SECRET_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
  const STRIPE_KEY = "sk_test_4eC39HqLyjWDarjtT1zdp7dc";

  // 1. SQL Injection (Search Users)
  app.get(api.tools.searchUsers.path, async (req, res) => {
    const query = req.query.query as string || "";
    try {
      const results = await storage.searchUsersVulnerable(query);
      res.json(results);
    } catch (e: any) {
      res.status(500).json({ message: "Database Error: " + e.message });
    }
  });

  // 2. Command Injection (Ping Tool)
  app.post(api.tools.ping.path, (req, res) => {
    const { host } = req.body;
    if (!host) {
      return res.status(400).json({ message: "Host required" });
    }
    const command = `ping -c 1 ${host}`;
    exec(command, (error, stdout, stderr) => {
      if (error) {
        return res.status(200).json({ output: stdout || stderr || error.message });
      }
      res.status(200).json({ output: stdout });
    });
  });

  // 3. SSRF (Fetch URL)
  app.post(api.tools.fetchUrl.path, async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ message: "URL required" });
    }
    try {
      const response = await axios.get(url);
      res.json({ data: typeof response.data === 'string' ? response.data : JSON.stringify(response.data).substring(0, 1000) });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // 4. Path Traversal (Read Log File)
  app.get(api.tools.readLog.path, (req, res) => {
    const filename = req.query.filename as string;
    if (!filename) {
      return res.status(400).json({ message: "Filename required" });
    }
    const filePath = path.join(process.cwd(), "logs", filename);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      res.json({ content });
    } catch (e: any) {
      res.status(500).json({ message: "Error reading file: " + e.message });
    }
  });

  // 5. Insecure Deserialization (Unsafe eval)
  app.post(api.tools.deserialize.path, (req, res) => {
    const { data } = req.body;
    try {
      const result = eval("(" + data + ")");
      res.json({ result });
    } catch (e: any) {
      res.status(500).json({ message: "Deserialization Error: " + e.message });
    }
  });

  // 6. Broken Auth (Weak header check)
  app.get(api.tools.bypassAuth.path, (req, res) => {
    const isAdmin = req.headers['x-admin-bypass'] === 'true';
    if (!isAdmin) {
      return res.status(401).json({ message: "Unauthorized. Admin bypass header missing." });
    }
    res.json({ stats: { users: 3, uptime: "99.9%", secrets_exposed: true } });
  });

  // 7. XSS (Reflected in Profile Update)
  app.post(api.tools.updateProfile.path, (req, res) => {
    const { bio } = req.body;
    res.json({ message: `Profile updated successfully! New bio: ${bio}` });
  });

  // 8. Debug Info (Information Exposure)
  app.get(api.tools.debugInfo.path, (req, res) => {
    res.json({ 
      env: {
        AWS_ACCESS_KEY,
        AWS_SECRET_KEY,
        STRIPE_KEY,
        DB_URL: process.env.DATABASE_URL,
        NODE_ENV: process.env.NODE_ENV
      }
    });
  });

  // NEW VULNERABILITY 1: IDOR (Insecure Direct Object Reference)
  // No ownership checks - any user can view any invoice
  app.get("/api/invoice/:id", async (req, res) => {
    const invoiceId = parseInt(req.params.id);
    const invoice = await storage.getInvoice(invoiceId);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    // VULNERABLE: No check if current user owns this invoice
    res.json({ id: invoice.id, amount: invoice.amount, status: invoice.status });
  });

  // NEW VULNERABILITY 2: Broken Authorization
  // Checks only if authenticated, not if admin
  app.post("/api/admin/deactivate", async (req, res) => {
    const { userId } = req.body;
    // VULNERABLE: Only checks if user is authenticated, not if they are admin
    // The x-user-id header would be set in a real app via middleware
    const currentUserId = req.headers['x-user-id'] as string;
    if (!currentUserId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    // Missing: if (currentUserRole !== 'admin') return 403
    const user = await storage.deactivateUser(userId);
    res.json({ message: `User ${user.username} has been deactivated` });
  });

  // NEW VULNERABILITY 3: Open Redirect
  // No validation of redirect target - opens to any external URL
  app.get("/api/redirect", (req, res) => {
    const next = req.query.next as string;
    if (!next) {
      return res.status(400).json({ message: "next parameter required" });
    }
    // VULNERABLE: Direct redirect without validation
    res.redirect(next);
  });

  // NEW VULNERABILITY 4: Business Logic Bug (Coupon Stacking)
  // Can apply same coupon multiple times or create negative totals
  app.post("/api/checkout/discount", (req, res) => {
    let { baseAmount, coupons: couponCodes } = req.body;
    baseAmount = parseFloat(baseAmount);

    let finalAmount = baseAmount;
    const breakdown = {};

    // VULNERABLE: No deduplication, applies same coupon multiple times
    // No validation that amount doesn't go negative
    for (const code of couponCodes) {
      if (code === "PERCENT50") {
        const discount = finalAmount * 0.5;
        finalAmount -= discount;
        // @ts-ignore
        breakdown[code] = `-${discount}`;
      }
      if (code === "FIXED100") {
        finalAmount -= 100;
        // @ts-ignore
        breakdown[code] = "-100";
      }
    }

    // VULNERABLE: No floor at 0, can go negative
    res.json({ finalAmount: Math.max(0, finalAmount), breakdown });
  });

  // NEW VULNERABILITY 5: Weak Randomness / Predictable Token
  app.get("/api/generate-token", (req, res) => {
    // VULNERABLE: Using Math.random() which is predictable
    const token = Math.random().toString(36).substring(2, 15);
    res.json({ token });
  });

  // NEW VULNERABILITY 6: Unsafe Proto Pollution / Dangerous Object Merge
  app.post("/api/process-file", (req, res) => {
    const { filename, operations } = req.body;
    
    let config = { allowed: true, owner: "system" };
    
    // VULNERABLE: Merges user input directly, allowing __proto__ pollution
    for (const op of operations) {
      Object.assign(config, op);
    }
    
    // Could be exploited with: { "__proto__": { "admin": true } }
    res.json({ result: `Processed ${filename} with config: ${JSON.stringify(config)}` });
  });

  return httpServer;
}
