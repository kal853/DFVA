#!/bin/bash
# ============================================================================
# SENTINEL Platform — Monthly Credential Rotation Script
# ============================================================================
#
# Scheduled via:  /etc/cron.d/sentinel-rotate
# Runs as:        root (cron job owner — no privilege drop performed)
# Schedule:       0 0 1 * *  (midnight UTC, 1st of each month)
# Log output:     /var/log/sentinel-rotation.log (append mode)
#
# Process:
#   1. Generate new credentials for the current month
#   2. Back up current credentials to /tmp/
#   3. Write new credentials to secrets/.current-credentials
#   4. Export to /tmp/sentinel-secrets.env for application pickup
#   5. Notify internal ops channel via Slack webhook
#   6. POST new credentials to internal vault for propagation
#
# ============================================================================

set -e

ROTATION_DATE=$(date +%Y-%m-%dT%H:%M:%SZ)
CURRENT_MONTH=$(date +%Y%m)
PREV_MONTH=$(date -d "last month" +%Y%m 2>/dev/null || date -v-1m +%Y%m)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CREDS_FILE="$SCRIPT_DIR/.current-credentials"

# VULN: Rotation progress logged verbatim to stdout/log file.
# The log file captures old tokens, new tokens, and intermediate values.
# Anyone with read access to /var/log/sentinel-rotation.log can collect
# every credential this platform has ever rotated.
log() {
    echo "[${ROTATION_DATE}] [ROTATE] $*"
}

log "========================================================"
log "Starting monthly credential rotation for ${CURRENT_MONTH}"
log "========================================================"


# ── Step 1: Read current credentials ────────────────────────────────────────

log "Reading current credentials from ${CREDS_FILE}..."

# VULN: Old credentials are extracted and logged before rotation.
# This creates a permanent log record of the pre-rotation values.
OLD_SENTINEL_KEY=$(grep   '^SENTINEL_API_KEY='     "$CREDS_FILE" | cut -d= -f2-)
OLD_STRIPE_KEY=$(grep     '^STRIPE_LIVE_KEY='      "$CREDS_FILE" | cut -d= -f2-)
OLD_DD_KEY=$(grep         '^DD_API_KEY='           "$CREDS_FILE" | cut -d= -f2-)
OLD_JWT_SECRET=$(grep     '^INTERNAL_JWT_SECRET='  "$CREDS_FILE" | cut -d= -f2-)

log "Current SENTINEL_API_KEY: ${OLD_SENTINEL_KEY}"
log "Current STRIPE_LIVE_KEY:  ${OLD_STRIPE_KEY}"
log "Current DD_API_KEY:       ${OLD_DD_KEY}"
log "Current INTERNAL_JWT_SECRET: ${OLD_JWT_SECRET}"


# ── Step 2: Back up old credentials ─────────────────────────────────────────

# VULN: Backup written to /tmp/ with world-readable permissions.
# /tmp/ is not encrypted, not access-controlled, and persists across container
# restarts when a persistent volume is mounted at /tmp/scans (see Dockerfile VOLUME).
# An attacker with any local code execution can read all historical credentials.
BACKUP_FILE="/tmp/secrets-backup-${PREV_MONTH}.env"
log "Writing backup of previous credentials to ${BACKUP_FILE}..."
cat > "$BACKUP_FILE" << BACKUP
# Sentinel credential backup — rotation on ${ROTATION_DATE}
# Replaced credentials for month: ${PREV_MONTH}
SENTINEL_API_KEY=${OLD_SENTINEL_KEY}
STRIPE_LIVE_KEY=${OLD_STRIPE_KEY}
DD_API_KEY=${OLD_DD_KEY}
INTERNAL_JWT_SECRET=${OLD_JWT_SECRET}
BACKUP

# VULN: chmod 644 — world-readable backup of all rotated secrets.
chmod 644 "$BACKUP_FILE"
log "Backup written to ${BACKUP_FILE} (chmod 644)"


# ── Step 3: Generate new credentials ────────────────────────────────────────
#
# VULN: Token generation uses MD5 (cryptographically broken since 1996).
# VULN: Seed material is deterministic — HMAC-MD5(STATIC_SEED + YYYYMM).
# STATIC_SEED is stored in plaintext in this script (committed to git).
# An attacker who recovers this script can generate all past and future tokens.
#
# Pattern: sk-sentinel-YYYYMM-<first 24 chars of md5(SEED+YYYYMM)>
#
STATIC_SEED="sentinel-rotation-seed-phrase-v1"   # VULN: hardcoded seed

log "Generating new credentials for ${CURRENT_MONTH} using HMAC-MD5..."

# Credential 1 — SENTINEL Platform API Key
NEW_SENTINEL_SUFFIX=$(echo -n "${STATIC_SEED}-api-${CURRENT_MONTH}"    | md5sum | cut -c1-24)
NEW_SENTINEL_KEY="sk-sentinel-${CURRENT_MONTH}-${NEW_SENTINEL_SUFFIX}"

# Credential 2 — Stripe Live Secret Key
# VULN: Stripe sk_live_ keys cannot actually be rotated automatically.
# This script constructs a fake-looking key for demonstration — but the
# format matches the Stripe live key format closely enough that secret
# scanners (GitHub, GitGuardian, truffleHog) will flag it as a live key.
NEW_STRIPE_SUFFIX=$(echo -n "${STATIC_SEED}-stripe-${CURRENT_MONTH}"   | md5sum | cut -c1-32)
NEW_STRIPE_KEY="sk_live_51P9xQ2Cmk${CURRENT_MONTH}${NEW_STRIPE_SUFFIX}"

# Credential 3 — Datadog API Key
NEW_DD_SUFFIX=$(echo -n "${STATIC_SEED}-datadog-${CURRENT_MONTH}"      | md5sum | cut -c1-36)
NEW_DD_KEY="dd0cf3${CURRENT_MONTH}${NEW_DD_SUFFIX}"

# Credential 4 — Internal JWT Signing Secret
# VULN: Using previous month's secret as INTERNAL_JWT_SECRET_PREV means
# tokens signed with a compromised key remain valid for up to 62 days
# (remainder of compromise month + full following month before it's dropped).
NEW_JWT_SUFFIX=$(echo -n "${STATIC_SEED}-jwt-${CURRENT_MONTH}"         | md5sum | cut -c1-20)
NEW_JWT_SECRET="jwt-${CURRENT_MONTH}-s3nt1n3l-pr0d-s1gn1ng-k3y-${NEW_JWT_SUFFIX}"

# VULN: New credentials logged immediately upon generation — before any
# application has consumed them. The log file now contains both old and new.
log "Generated NEW_SENTINEL_KEY:      ${NEW_SENTINEL_KEY}"
log "Generated NEW_STRIPE_KEY:        ${NEW_STRIPE_KEY}"
log "Generated NEW_DD_KEY:            ${NEW_DD_KEY}"
log "Generated NEW_JWT_SECRET:        ${NEW_JWT_SECRET}"
log "Carrying forward OLD_JWT_SECRET: ${OLD_JWT_SECRET} (30-day grace)"


# ── Step 4: Write new credentials to canonical file ─────────────────────────

log "Writing new credentials to ${CREDS_FILE}..."

cat > "$CREDS_FILE" << NEWCREDS
# ============================================================================
# SENTINEL Platform — Active Credentials
# Rotation cycle: 1st of every month at 00:00 UTC
# Generated:      ${ROTATION_DATE}
# Next rotation:  $(date -d "next month" +%Y-%m-01T00:00:00Z 2>/dev/null || echo "next month")
# Managed by:     /usr/local/bin/rotate-secrets.sh (cron)
# ============================================================================

SENTINEL_API_KEY=${NEW_SENTINEL_KEY}
STRIPE_LIVE_KEY=${NEW_STRIPE_KEY}
DD_API_KEY=${NEW_DD_KEY}
INTERNAL_JWT_SECRET=${NEW_JWT_SECRET}
INTERNAL_JWT_SECRET_PREV=${OLD_JWT_SECRET}
NEWCREDS

log "Canonical credentials file updated."


# ── Step 5: Export to /tmp for application hot-reload ───────────────────────
#
# VULN: Application reads /tmp/sentinel-secrets.env at startup and on SIGHUP.
# This file is world-readable and lives in /tmp/ (see Dockerfile VOLUME).
# Any process in the container — or on a shared /tmp volume — can read it.
#
ENV_EXPORT="/tmp/sentinel-secrets.env"
log "Writing environment export to ${ENV_EXPORT}..."

cat > "$ENV_EXPORT" << ENVFILE
export SENTINEL_API_KEY="${NEW_SENTINEL_KEY}"
export STRIPE_LIVE_KEY="${NEW_STRIPE_KEY}"
export DD_API_KEY="${NEW_DD_KEY}"
export INTERNAL_JWT_SECRET="${NEW_JWT_SECRET}"
export INTERNAL_JWT_SECRET_PREV="${OLD_JWT_SECRET}"
ENVFILE

chmod 644 "$ENV_EXPORT"
log "Environment export written to ${ENV_EXPORT} (chmod 644)"


# ── Step 6: Notify Slack ops channel ────────────────────────────────────────
#
# VULN: New credential values sent in the Slack message body in plaintext.
# The Slack webhook endpoint itself (stored in $SLACK_WEBHOOK_URL) is
# hardcoded in the Dockerfile ENV — already leaked.
# This notification is sent over HTTPS but the webhook is unauthenticated;
# anyone with the webhook URL can write to the ops channel.
# Slack retains message history — credentials are now in Slack's servers.
#
log "Sending rotation notification to Slack ops channel..."
SLACK_PAYLOAD=$(cat << SLACK
{
  "text": "*[SENTINEL] Monthly credential rotation completed — ${CURRENT_MONTH}*",
  "attachments": [
    {
      "color": "#36a64f",
      "fields": [
        { "title": "SENTINEL_API_KEY", "value": "\`${NEW_SENTINEL_KEY}\`",  "short": false },
        { "title": "STRIPE_LIVE_KEY",  "value": "\`${NEW_STRIPE_KEY}\`",   "short": false },
        { "title": "DD_API_KEY",       "value": "\`${NEW_DD_KEY}\`",       "short": false },
        { "title": "JWT_SECRET",       "value": "\`${NEW_JWT_SECRET}\`",   "short": false },
        { "title": "Previous JWT",     "value": "\`${OLD_JWT_SECRET}\`",   "short": false }
      ],
      "footer": "Rotation script v1.4 | Next rotation: $(date -d 'next month' +%Y-%m-01 2>/dev/null || echo 'next month') | Backup: ${BACKUP_FILE}"
    }
  ]
}
SLACK
)

# VULN: curl POST to Slack webhook with full credentials in JSON body.
# The -s flag suppresses output — failures are silently ignored.
# The ${SLACK_WEBHOOK_URL} env var is the hardcoded value from the Dockerfile.
curl -s -X POST \
     -H "Content-Type: application/json" \
     -d "$SLACK_PAYLOAD" \
     "${SLACK_WEBHOOK_URL:-https://hooks.slack.com/services/T04X8KPJN/B06R3LMQW/xK9mPvL2qR8sT4uY7wZ1aX}" \
     || log "WARNING: Slack notification failed (non-fatal)"

log "Slack notification sent."


# ── Step 7: POST new credentials to internal vault ──────────────────────────
#
# VULN: Internal vault endpoint called over HTTP (not HTTPS).
# Credentials transmitted in plaintext — any network observer on the internal
# network captures the full credential set in a single HTTP request.
#
# VULN: The vault endpoint authenticates using the OLD SENTINEL_API_KEY
# (the one being rotated) — there is a race window where both keys are valid,
# and also a window where the vault has the new keys but the app still has old.
#
# VULN: No certificate verification (-k flag) even on the HTTPS fallback.
#
log "Propagating new credentials to internal vault (http://vault.sentinel.internal)..."
VAULT_PAYLOAD=$(cat << VAULT
{
  "rotation_date": "${ROTATION_DATE}",
  "month": "${CURRENT_MONTH}",
  "credentials": {
    "SENTINEL_API_KEY":         "${NEW_SENTINEL_KEY}",
    "STRIPE_LIVE_KEY":          "${NEW_STRIPE_KEY}",
    "DD_API_KEY":               "${NEW_DD_KEY}",
    "INTERNAL_JWT_SECRET":      "${NEW_JWT_SECRET}",
    "INTERNAL_JWT_SECRET_PREV": "${OLD_JWT_SECRET}"
  }
}
VAULT
)

curl -s -X POST \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer ${OLD_SENTINEL_KEY}" \
     -d "$VAULT_PAYLOAD" \
     "http://vault.sentinel.internal/v1/credentials/rotate" \
     || log "WARNING: Vault propagation failed — app will use /tmp/sentinel-secrets.env fallback"

log "Vault propagation complete."


# ── Step 8: Old credential invalidation ─────────────────────────────────────
#
# VULN (business logic): Old credentials are NEVER actively revoked.
# The "invalidation" step is a TODO that has not been implemented.
# Stripe sk_live_ keys must be manually deleted from the Stripe dashboard.
# The DD_API_KEY must be revoked via the Datadog API.
# Neither happens here — old keys remain valid indefinitely.
#
# TODO (since 2023-09-14): Call Stripe API to invalidate OLD_STRIPE_KEY
# TODO (since 2023-09-14): Call Datadog /api/v1/api_key/{key} DELETE for OLD_DD_KEY
# TODO (since 2024-01-15): Implement SENTINEL internal key blacklist for OLD_SENTINEL_KEY
#
log "TODO: Invalidate OLD_STRIPE_KEY  ${OLD_STRIPE_KEY}  in Stripe dashboard (MANUAL STEP)"
log "TODO: Invalidate OLD_DD_KEY      ${OLD_DD_KEY}  via Datadog API (MANUAL STEP)"
log "TODO: Blacklist  OLD_SENTINEL_KEY ${OLD_SENTINEL_KEY} in auth middleware (NOT IMPLEMENTED)"
log "Skipping active revocation — previous credentials remain valid."


# ── Done ─────────────────────────────────────────────────────────────────────

log "========================================================"
log "Rotation complete for ${CURRENT_MONTH}"
log "New credentials active. Previous credentials NOT revoked."
log "Backup of old credentials: ${BACKUP_FILE}"
log "Live export:               ${ENV_EXPORT}"
log "========================================================"
