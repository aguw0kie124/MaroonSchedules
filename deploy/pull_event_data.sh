#!/usr/bin/env bash
# Pull refreshed campus event data onto this box.
#
# The weekly Data Refresh workflow crawls, validates and commits fresh events
# to main, but GitHub's runners cannot SSH in here: allowlisting them would
# take ~7300 CIDR ranges against a 60-rule security group limit. So the box
# pulls instead of being pushed to. No inbound access, nothing to rotate when
# the instance's public IP changes.
#
# INSTALL (once, as the deploy user):
#   chmod +x deploy/pull_event_data.sh
#   crontab -e
#   */10 * * * * /home/ubuntu/MaroonSchedules/deploy/pull_event_data.sh
#
# Logs to syslog under the tag `maroon-data`:
#   journalctl -t maroon-data -n 20
#
# Safe to run at any frequency: it exits immediately when the committed data
# already matches what is on disk, so the common case costs one `git fetch`.
set -eu

REPO="${REPO:-/home/ubuntu/MaroonSchedules}"
DATA="TamuEventsCrawler/data/normalized/events.jsonl"
HEALTH_URL="${HEALTH_URL:-http://localhost:8000/campus/events?refresh=true&limit=1}"

log() { logger -t maroon-data "$*" 2>/dev/null || true; echo "$*"; }

cd "$REPO" || { log "ERROR: no repo at $REPO"; exit 1; }

# Never let two cron ticks overlap; a slow fetch must not race the rename.
# If flock is unavailable, proceed WITHOUT the lock rather than skipping: the
# rename below is atomic, so concurrent runs are merely wasteful, not unsafe.
# Skipping instead would make a missing tool look like a successful no-op --
# the update would silently never happen.
if command -v flock >/dev/null 2>&1; then
  exec 9>"/tmp/maroon-pull-data.lock"
  flock -n 9 || { echo "another run already in progress; skipping"; exit 0; }
else
  log "WARN: flock not found; running unlocked"
fi

git fetch --quiet origin main || { log "ERROR: git fetch failed"; exit 1; }

WANT="$(git rev-parse "FETCH_HEAD:$DATA")"
GOT="$(git hash-object -- "$DATA" 2>/dev/null || echo none)"

if [ "$WANT" = "$GOT" ]; then
  echo "already current at $WANT"
  exit 0
fi

# Write to a temp file and rename. rename(2) is atomic, so an in-flight
# request can never read a half-written file -- load_campus_events skips
# unparseable lines *silently*, so a torn read would poison the cache for
# 300s with no error. The rename also guarantees a fresh mtime, which is what
# the backend's event cache is keyed on.
git cat-file blob "$WANT" > "$DATA.tmp"
mv -f "$DATA.tmp" "$DATA"

CHECK="$(git hash-object -- "$DATA")"
if [ "$CHECK" != "$WANT" ]; then
  log "ERROR: $DATA hashes to $CHECK, expected $WANT"
  exit 1
fi

# Only the data file moves. HEAD stays on the last manually-deployed backend
# commit, so this never delivers undeployed code -- backend deploys are
# manual by design (see deploy-backend.yml / ENABLE_AUTO_DEPLOY).
log "updated events.jsonl to $WANT ($(wc -l < "$DATA" | tr -d ' ') rows); code still at $(git rev-parse --short HEAD)"

# Prime the cache so the new events are served immediately rather than after
# the 300s TTL. Best-effort: they go live either way.
if curl -sf -o /dev/null "$HEALTH_URL"; then
  log "event cache primed"
else
  log "WARN: cache prime failed; data goes live within 300s anyway"
fi
