#!/usr/bin/env bash
# One-time EC2 bootstrap: moves the backend from an ad-hoc process to systemd.
# Run ON THE EC2 BOX from the repo root:  bash deploy/setup_ec2.sh
#
# Prerequisites:
#   - repo cloned on the box (this script run from its root) on the branch
#     the deploy workflow targets (currently `cicd`)
#   - .env / Backend/.env present with production values
#   - STOP the old hand-started uvicorn process first (tmux/screen/nohup) —
#     otherwise port 8000 will be taken and the service will crash-loop.
set -euo pipefail

DEPLOY_PATH="$(cd "$(dirname "$0")/.." && pwd)"
SERVICE_USER="${SUDO_USER:-$(whoami)}"

echo "Deploy path: $DEPLOY_PATH"
echo "Service user: $SERVICE_USER"

if [ ! -f "$DEPLOY_PATH/Backend/.env" ] && [ ! -f "$DEPLOY_PATH/.env" ]; then
  echo "WARNING: no .env found at $DEPLOY_PATH/.env or $DEPLOY_PATH/Backend/.env" >&2
  echo "The backend will start without secrets. Create it before relying on the service." >&2
fi

# Python venv + deps
if [ ! -d "$DEPLOY_PATH/.venv" ]; then
  python3 -m venv "$DEPLOY_PATH/.venv"
fi
"$DEPLOY_PATH/.venv/bin/pip" install --upgrade pip
"$DEPLOY_PATH/.venv/bin/pip" install -r "$DEPLOY_PATH/Backend/requirements.txt"

# Install the unit with real paths/user
sed -e "s|__DEPLOY_PATH__|$DEPLOY_PATH|g" \
    -e "s|__USER__|$SERVICE_USER|g" \
    "$DEPLOY_PATH/deploy/maroonschedules.service" \
  | sudo tee /etc/systemd/system/maroonschedules.service > /dev/null

sudo systemctl daemon-reload
sudo systemctl enable maroonschedules
sudo systemctl restart maroonschedules

sleep 2
sudo systemctl --no-pager status maroonschedules
echo
echo "Done. Deploys can now restart with: sudo systemctl restart maroonschedules"
echo "Logs: journalctl -u maroonschedules -f"
