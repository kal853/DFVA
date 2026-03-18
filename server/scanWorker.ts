// SENTINEL Scan Job Worker
// Deliberately vulnerable — see inline VULN comments.
// Runs as an in-process setInterval loop; production systems would use a proper queue.

import axios from "axios";
import { storage } from "./storage";

const SCHEDULE_INTERVALS: Record<string, number> = {
  daily:  24 * 60 * 60 * 1000,
  weekly: 7  * 24 * 60 * 60 * 1000,
};

// ── Worker tick ───────────────────────────────────────────────────────────────
async function runDueJobs(): Promise<void> {
  let due: Awaited<ReturnType<typeof storage.getDueScanJobs>>;
  try {
    due = await storage.getDueScanJobs();
  } catch {
    return; // DB not ready yet
  }

  for (const job of due) {
    await storage.updateScanJob(job.id, { status: "running" });

    try {
      // VULN (Stored SSRF): targetUrl is fetched verbatim — no validation, no
      // block-list, no DNS rebinding protection. A job stored with
      // targetUrl="http://169.254.169.254/latest/meta-data/" will request AWS
      // instance metadata (or any other internal endpoint) when the worker ticks.
      // The raw response (truncated to 2 KB) is persisted in lastResult.
      const response = await axios.get(job.targetUrl, {
        timeout: 8000,
        maxRedirects: 5,
        validateStatus: () => true,           // accept any HTTP status
        responseType: "text",
      });

      const snippet = typeof response.data === "string"
        ? response.data.slice(0, 2000)
        : JSON.stringify(response.data).slice(0, 2000);

      // VULN: raw server response (may contain internal metadata) stored in DB
      //       and returned to any caller of GET /api/scans/:id
      const result = JSON.stringify({
        status:  response.status,
        headers: Object.fromEntries(
          Object.entries(response.headers as Record<string, string>).slice(0, 8)
        ),
        body: snippet,
        scannedAt: new Date().toISOString(),
      });

      const nextRun = computeNextRun(job.schedule);
      await storage.updateScanJob(job.id, {
        status:     nextRun ? "scheduled" : "completed",
        lastRunAt:  new Date(),
        lastResult: result,
        runCount:   (job.runCount ?? 0) + 1,
        ...(nextRun ? { nextRunAt: nextRun } : {}),
      });
    } catch (err: any) {
      const nextRun = computeNextRun(job.schedule);
      await storage.updateScanJob(job.id, {
        status:     nextRun ? "scheduled" : "failed",
        lastRunAt:  new Date(),
        lastResult: JSON.stringify({ error: err.message, scannedAt: new Date().toISOString() }),
        runCount:   (job.runCount ?? 0) + 1,
        ...(nextRun ? { nextRunAt: nextRun } : {}),
      });
    }
  }
}

function computeNextRun(schedule: string): Date | null {
  const interval = SCHEDULE_INTERVALS[schedule];
  if (!interval) return null;
  return new Date(Date.now() + interval);
}

// ── Start worker ──────────────────────────────────────────────────────────────
export function startScanWorker(): void {
  console.log("[scan-worker] Starting — polling every 15s");
  // Run immediately on startup, then every 15 seconds
  runDueJobs();
  setInterval(runDueJobs, 15_000);
}
