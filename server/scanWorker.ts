// SENTINEL Scan Job Worker
// Runs as an in-process setInterval loop; production systems would use a proper queue.

import axios from "axios";
import { storage } from "./storage";
import { validateScanTargetUrl } from "./scanTargetValidation";

const SCHEDULE_INTERVALS: Record<string, number> = {
  daily:  24 * 60 * 60 * 1000,
  weekly: 7  * 24 * 60 * 60 * 1000,
};

async function fetchValidatedScanTarget(targetUrl: string, redirectsRemaining = 5) {
  const validatedUrl = await validateScanTargetUrl(targetUrl);
  const response = await axios.get(validatedUrl.toString(), {
    timeout: 8000,
    maxRedirects: 0,
    validateStatus: () => true,
    responseType: "text",
  });

  const locationHeader = response.headers.location;
  const location = Array.isArray(locationHeader) ? locationHeader[0] : locationHeader;
  if (location && response.status >= 300 && response.status < 400) {
    if (redirectsRemaining <= 0) {
      throw new Error("Too many redirects.");
    }

    const redirectedUrl = new URL(location, validatedUrl).toString();
    return fetchValidatedScanTarget(redirectedUrl, redirectsRemaining - 1);
  }

  return response;
}

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
      const response = await fetchValidatedScanTarget(job.targetUrl);

      const snippet = typeof response.data === "string"
        ? response.data.slice(0, 2000)
        : JSON.stringify(response.data).slice(0, 2000);

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
