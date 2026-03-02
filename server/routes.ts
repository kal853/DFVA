import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import axios from "axios";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Seed DB with some dummy data if it doesn't exist
  setTimeout(async () => {
    try {
      const admin = await storage.getUserByUsername("admin");
      if (!admin) {
        await storage.createUser({
          username: "admin",
          password: "super_secret_password_123",
          role: "admin",
          email: "admin@corp.internal"
        });
        
        await storage.createUser({
          username: "jdoe",
          password: "password1",
          role: "user",
          email: "jdoe@corp.internal"
        });
        
        await storage.createUser({
          username: "asmith",
          password: "password1",
          role: "user",
          email: "asmith@corp.internal"
        });
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

  // 5. Insecure Deserialization (Unsafe JSON parse/eval-like behavior)
  app.post(api.tools.deserialize.path, (req, res) => {
    const { data } = req.body;
    try {
      // VULNERABLE: Using eval to "parse" configuration strings
      const result = eval("(" + data + ")");
      res.json({ result });
    } catch (e: any) {
      res.status(500).json({ message: "Deserialization Error: " + e.message });
    }
  });

  // 6. Broken Auth (Weak check, bypassable)
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
    // VULNERABLE: Sending back unescaped input that will be rendered directly
    res.json({ message: `Profile updated successfully! New bio: ${bio}` });
  });

  // 8. Debug Info (Information Exposure)
  app.get(api.tools.debugInfo.path, (req, res) => {
    // VULNERABLE: Exposing sensitive environment variables
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

  return httpServer;
}
