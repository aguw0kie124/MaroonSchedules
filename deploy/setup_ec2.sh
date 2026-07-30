#!/usr/bin/env bash
# One-time EC2 bootstrap: moves the backend from an ad-hoc process to systemd.
# Run ON THE EC2 BOX from the repo root:  bash deploy/setup_ec2.sh
#
# Prerequisites:
#   - repo cloned on the box (this script run from its root) on the branch
#     the deploy workflow targets (`main`)
#   - .env / Backend/.env present with production values
#   - STOP the old hand-started uvicorn process first (tmux/screen/nohup) —
#     otherwise port 8000 will be taken and the service will crash-loop.
#
# VENV_PATH selects the Python environment the service runs under. It
# defaults to an existing sibling `fastapi-env` if present — the backend was
# hand-run from there before this script existed, so reusing it means the
# cutover changes only the supervisor, not the interpreter or the installed
# packages. Override explicitly with:  VENV_PATH=/some/venv bash deploy/setup_ec2.sh
# Keep it in sync with the EC2_VENV_PATH repo variable used by
# .github/workflows/deploy-backend.yml.
set -euo pipefail

DEPLOY_PATH="$(cd "$(dirname "$0")/.." && pwd)"
SERVICE_USER="${SUDO_USER:-$(whoami)}"

DEFAULT_VENV="$(dirname "$DEPLOY_PATH")/fastapi-env"
if [ -z "${VENV_PATH:-}" ]; then
  if [ -x "$DEFAULT_VENV/bin/uvicorn" ]; then
    VENV_PATH="$DEFAULT_VENV"
  else
    VENV_PATH="$DEPLOY_PATH/.venv"
  fi
fi

# Defaults to 1 to match the hand-started process this replaces (uvicorn's
# own default), so the cutover changes the supervisor and nothing else.
# Each worker held ~250MB, so check free memory before raising it:
#   WORKERS=2 bash deploy/setup_ec2.sh
WORKERS="${WORKERS:-1}"

echo "Deploy path:  $DEPLOY_PATH"
echo "Service user: $SERVICE_USER"
echo "Virtualenv:   $VENV_PATH"
echo "Workers:      $WORKERS"

if [ ! -f "$DEPLOY_PATH/Backend/.env" ] && [ ! -f "$DEPLOY_PATH/.env" ]; then
  echo "WARNING: no .env found at $DEPLOY_PATH/.env or $DEPLOY_PATH/Backend/.env" >&2
  echo "The backend will start without secrets. Create it before relying on the service." >&2
fi

# Python venv + deps
if [ ! -d "$VENV_PATH" ]; then
  python3 -m venv "$VENV_PATH"
fi
"$VENV_PATH/bin/pip" install --upgrade pip
"$VENV_PATH/bin/pip" install -r "$DEPLOY_PATH/Backend/requirements.txt"

# Fail before touching systemd if the venv can't actually serve the app —
# better to stop here than to install a unit that crash-loops on Restart=always.
"$VENV_PATH/bin/python" -c "import fastapi, uvicorn; from jwt.algorithms import RSAAlgorithm"

# Install the unit with real paths/user
sed -e "s|__DEPLOY_PATH__|$DEPLOY_PATH|g" \
    -e "s|__VENV_PATH__|$VENV_PATH|g" \
    -e "s|__USER__|$SERVICE_USER|g" \
    -e "s|__WORKERS__|$WORKERS|g" \
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
