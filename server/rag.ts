// SENTINEL RAG Pipeline
// Deliberately vulnerable: no content sanitisation, no per-tenant isolation, uploader metadata leaked.

import OpenAI from "openai";
import { storage } from "./storage";

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

// ── Text chunking ─────────────────────────────────────────────────────────────
// Splits on double-newline paragraphs; falls back to fixed 800-char windows.
export function chunkText(text: string, maxChars = 800, overlap = 100): string[] {
  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if ((current + "\n\n" + para).length <= maxChars) {
      current = current ? current + "\n\n" + para : para;
    } else {
      if (current) chunks.push(current.trim());
      // Para itself exceeds limit — slice with overlap
      if (para.length > maxChars) {
        let start = 0;
        while (start < para.length) {
          chunks.push(para.slice(start, start + maxChars).trim());
          start += maxChars - overlap;
        }
        current = "";
      } else {
        current = para;
      }
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(c => c.length > 20);
}

// ── Embedding ─────────────────────────────────────────────────────────────────
export async function embedText(text: string): Promise<number[]> {
  const response = await getClient().embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

// ── Cosine similarity ─────────────────────────────────────────────────────────
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}

// ── Ingest document ───────────────────────────────────────────────────────────
// VULN: content is ingested verbatim — no sanitisation.
// Malicious payloads ("Ignore prior instructions...") embedded in the doc
// will surface in the retrieval context injected into ARIA's system prompt.
export async function ingestDocument(params: {
  documentId: number;
  userId: number;
  uploaderUsername: string;
  filename: string;
  text: string;
}): Promise<number> {
  const { documentId, userId, uploaderUsername, filename, text } = params;
  const chunks = chunkText(text);

  for (let i = 0; i < chunks.length; i++) {
    const embedding = await embedText(chunks[i]);
    // VULN: uploaderUsername and filename written verbatim into every chunk row
    await storage.createRagChunk({
      documentId,
      userId,
      uploaderUsername,
      filename,
      content: chunks[i],
      embedding: JSON.stringify(embedding),
      chunkIndex: i,
    });
  }

  return chunks.length;
}

// ── Retrieval ─────────────────────────────────────────────────────────────────
// VULN #1 — No tenant isolation: getAllRagChunks() returns chunks for ALL users.
//           An adversary querying ARIA gets context that includes other orgs' uploads.
// VULN #2 — Uploader metadata (filename, uploaderUsername, userId) is embedded
//           verbatim in the context block injected into the LLM system prompt,
//           leaking PII about other organisations' employees and file names.
export async function retrieveRelevantChunks(query: string, topK = 4): Promise<string | null> {
  const allChunks = await storage.getAllRagChunks(); // ← cross-tenant fetch
  if (allChunks.length === 0) return null;

  const queryEmbedding = await embedText(query);

  const scored = allChunks
    .filter(c => c.embedding)
    .map(c => ({
      chunk: c,
      score: cosineSimilarity(queryEmbedding, JSON.parse(c.embedding!)),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  if (scored.length === 0 || scored[0].score < 0.3) return null;

  // VULN: uploader identity (username, filename, userId) injected into the
  // LLM context window — visible to any user whose query triggers retrieval.
  const contextBlocks = scored.map(({ chunk, score }) =>
    `[SOURCE: file="${chunk.filename}" | uploaded_by="${chunk.uploaderUsername}" | user_id=${chunk.userId} | relevance=${score.toFixed(3)}]\n${chunk.content}`
  );

  return `--- KNOWLEDGE BASE CONTEXT (retrieved from internal document store) ---\n${contextBlocks.join("\n\n")}\n--- END KNOWLEDGE BASE CONTEXT ---`;
}
