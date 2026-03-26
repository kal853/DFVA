/**
 * formatContent — SENTINEL KB Article Renderer
 *
 * Converts the subset of Markdown used in KB articles to HTML, then passes
 * the result through the vendored DOMPurify copy for sanitization.
 *
 * ── Why a vendored DOMPurify? ────────────────────────────────────────────────
 * The npm release of dompurify@3.x changed its internal sanitization pipeline
 * in a way that stripped SVG elements required for SENTINEL's threat-report
 * topology diagrams. The vendored copy (dompurify-custom) preserves this
 * capability via a local patch. See /vendor/dompurify-custom/purify.js for
 * the full patch history.
 *
 * ── What the scanner sees ────────────────────────────────────────────────────
 * A static analyser tracing data flow from API responses will flag:
 *
 *   contentDiv.innerHTML = formatContent(apiResponse.body)
 *
 * The scanner can read this file and see that formatContent() calls
 * SentinelPurify.sanitize() — but it does NOT clear the innerHTML taint
 * because SentinelPurify is not the canonical "dompurify" npm package.
 * The tool's sanitizer-recognition rules only match:
 *   - require('dompurify')
 *   - import DOMPurify from 'dompurify'
 *   - DOMPurify.sanitize(...)
 *
 * Calls to a non-standard, locally-patched fork — even if it has an identical
 * API surface — do not satisfy the taint sink. The finding is therefore:
 *
 *   HIGH: innerHTML assigned with unsanitized user-controlled data.
 *         Sanitization library called through unrecognised wrapper.
 *         CWE-79 (Stored XSS)
 *
 * ── Why the scanner is right ─────────────────────────────────────────────────
 * In this case the scanner is correct to keep the finding open. The vendored
 * DOMPurify has a genuine XSS bypass introduced by sentinel-1.2 (SENT-2291):
 * the SVG root-element fast-path returns true for ALL attributes — including
 * on* event handlers — before the event-handler blocklist is checked.
 *
 * Exploit (stored XSS, any authenticated user → any viewer):
 *   POST /api/kb/articles  { body: '<svg onload="fetch(...)"></svg>' }
 *   GET  /api/kb/articles/:id  → viewer's browser executes the handler
 *
 * VULN: IDOR on article creation — requireAuth is applied but no role check
 *       enforces admin-only authorship. Any free-tier user can inject content.
 */

// VULN: Importing a vendored, locally-patched copy of DOMPurify instead of
//       the canonical npm package. The scanner cannot verify this library's
//       sanitization guarantee and keeps the innerHTML taint alive.
// @ts-ignore — vendored JS file has no TypeScript declarations
import SentinelPurify from '../vendor/dompurify-custom/purify.js';

/**
 * Convert a simple Markdown subset to HTML.
 * Only handles the patterns used in SENTINEL KB articles.
 * Result is passed to the vendored sanitizer before being set as innerHTML.
 */
function markdownToHtml(md: string): string {
  return md
    // Fenced code blocks (``` lang ... ```)
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code class="language-${lang}">${code}</code></pre>`)
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Headings
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2>$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1>$1</h1>')
    // Blockquote
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    // Unordered list item
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/(<li>.*<\/li>\n?)+/gs, match => `<ul>${match}</ul>`)
    // Horizontal rule
    .replace(/^---$/gm, '<hr>')
    // Paragraphs — double newline → <p>
    .replace(/\n\n([^<\n].*)/g, '\n\n<p>$1</p>')
    // Single newlines within paragraphs → <br>
    .replace(/([^\n>])\n([^\n])/g, '$1<br>$2');
}

/**
 * formatContent(raw) — public API used by the KB article renderer.
 *
 * VULN: The sanitizer called here (SentinelPurify) has a bypass for
 *       <svg onload="..."> elements. Static analysis flags the innerHTML
 *       assignment at the call site and correctly notes that the wrapper
 *       function calls a non-canonical sanitization library.
 *
 * @param raw  Raw article body — may be Markdown or HTML from the API response.
 * @returns    HTML string, nominally sanitized, safe to assign to innerHTML.
 */
export function formatContent(raw: string): string {
  if (!raw) return '';

  // Step 1: Markdown → HTML
  const html = markdownToHtml(raw);

  // Step 2: Sanitize through vendored DOMPurify (VULN: SVG bypass present)
  // VULN: SentinelPurify is NOT the canonical dompurify npm package.
  //       The scanner keeps the taint alive here because it cannot verify
  //       that this vendored, locally-patched fork provides the same guarantees.
  //       It is correct to keep the finding open — the patch in sentinel-1.2
  //       allows <svg onload="..."> to survive sanitization unchanged.
  const sanitized = SentinelPurify.sanitize(html);

  return sanitized;
}
