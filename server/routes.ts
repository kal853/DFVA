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

  // 1. SQL Injection (Search Users)
  app.get(api.tools.searchUsers.path, async (req, res) => {
    const query = req.query.query as string || "";
    try {
      // Intentionally insecure SQLi via storage
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

    // VULNERABLE: Direct concatenation in exec
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

    // VULNERABLE: No validation of URL scheme/host, allows internal requests
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

    // VULNERABLE: Direct path joining without validation
    const filePath = path.join(process.cwd(), "logs", filename);
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      res.json({ content });
    } catch (e: any) {
      res.status(500).json({ message: "Error reading file: " + e.message });
    }
  });

  return httpServer;
}
