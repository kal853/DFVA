# SENTINEL — Security Tools Subscription Platform

## Project Purpose
A deliberately insecure subscription SaaS platform for DepthFirst security demo. Looks like a real product; contains real, exploitable vulnerabilities across multiple classes. Built for demonstrating T=0 deep scan, PR bot, reachability analysis, and contextual patching.

## Stack
- **Frontend**: React + Vite + TypeScript + TailwindCSS + shadcn/ui + TanStack Query + wouter
- **Backend**: Express + TypeScript + Drizzle ORM
- **Database**: PostgreSQL (Replit managed)
- **Theme**: Dark hacker aesthetic, neon green primary

## Pages (all public-facing)
| Route | Page | Description |
|-------|------|-------------|
| `/` | Home | Hero, featured tools, stats, how-it-works |
| `/tools` | Tools | Full catalog with category + tier filters |
| `/tools/:slug` | Tool Detail | Specs, get-access CTA → Pricing |
| `/pricing` | Pricing | Plan cards + subscription management demo |

## Vulnerability Map

### Backend routes (no UI links — hidden from frontend)
| Route | Class | Package / Method |
|-------|-------|-----------------|
| `GET /api/search?query=` | SQL Injection | Raw string concat in pg query |
| `POST /api/ping` | Command Injection | `exec()` with unsanitised host |
| `POST /api/fetch` | SSRF | `axios.get(url)` unrestricted |
| `GET /api/files?filename=` | Path Traversal | `fs.readFileSync` with user path |
| `POST /api/admin/config` | Insecure Deserialization | `eval()` on user data |
| `GET /api/admin/stats` | Broken Auth | Header bypass `x-admin-bypass` |
| `POST /api/profile/update` | Reflected XSS | Unescaped bio in JSON response |
| `GET /api/debug` | Info Exposure | Hardcoded AWS/Stripe keys |
| `GET /api/invoice/:id` | IDOR | No ownership check |
| `POST /api/admin/deactivate` | Broken AuthZ | No role check |
| `GET /api/redirect?next=` | Open Redirect | Unvalidated redirect |
| `POST /api/checkout/discount` | Business Logic | Coupon stacking / re-application |
| `GET /api/generate-token` | Weak Randomness | `Math.random()` tokens |
| `POST /api/process-file` | Prototype Pollution | `Object.assign` with user ops |
| `POST /api/tools/render-advisory` | XSS | `marked@0.3.6` no sanitisation (CVE-2022-21681) |
| `POST /api/preferences/save` | RCE | `node-serialize@0.0.4` IIFE (CVE-2017-5941) |
| `POST /api/tools/merge-config` | Prototype Pollution | `lodash@4.17.15` `_.merge` (CVE-2019-10744) |

### Billing logic (server/billing.ts)
| Function | Class |
|----------|-------|
| `applyCreditsToOrder` | Race Condition — read-modify-write without lock |
| `finalizeUpgrade` | Logic Bug — refund before charge; fail_test still credits wallet |
| `processDowngrade` | Non-atomic — 50ms gap between credit write and plan change |

### Vulnerable dependency versions
| Package | Version | CVE |
|---------|---------|-----|
| `marked` | 0.3.6 | CVE-2022-21681, CVE-2022-21680 |
| `lodash` | 4.17.15 | CVE-2019-10744 |
| `node-serialize` | 0.0.4 | CVE-2017-5941 |

## Seed Users
| Username | Password | Plan | Wallet |
|----------|----------|------|--------|
| admin | super_secret_password_123 | enterprise | $0 |
| jdoe | password1 | pro | $50 |
| asmith | password1 | free | $0 |

## Key Files
- `server/routes.ts` — all API routes including all vuln routes
- `server/billing.ts` — race conditions and logic bugs
- `server/storage.ts` — DB layer including raw SQL injection method
- `shared/schema.ts` — Drizzle schema (users, products, invoices, wallet_transactions, coupons)
- `client/src/pages/` — Home, Tools, ToolDetail, Pricing
