#!/bin/bash
set -euo pipefail

# Pull the latest code from GitHub, build, and reload Nginx.
# Configure your repo URL either here or in /root/.customtextx-env

APP_DIR="${APP_DIR:-/var/www/customslinksurl}"
BRANCH="${BRANCH:-main}"
LOG_FILE="${LOG_FILE:-/var/log/customtextx-deploy.log}"
ENV_FILE="/root/.customtextx-env"

# Load optional local env overrides
[ -f "$ENV_FILE" ] && source "$ENV_FILE"

REPO_URL="${GITHUB_REPO_URL:-${REPO_URL:-}}"

exec >> "$LOG_FILE" 2>&1
echo ""
echo "=== $(date '+%Y-%m-%d %H:%M:%S') ==="

if [ -z "$REPO_URL" ]; then
  echo "ERROR: Set REPO_URL in /root/.customtextx-env or pass GITHUB_REPO_URL. Example:"
  echo "REPO_URL=https://github.com/youruser/customslinksurl.git"
  exit 1
fi

if [ ! -d "$APP_DIR/.git" ]; then
  echo "Cloning $REPO_URL into $APP_DIR ..."
  rm -rf "$APP_DIR"
  mkdir -p "$(dirname "$APP_DIR")"
  git clone -b "$BRANCH" --single-branch "$REPO_URL" "$APP_DIR"
else
  echo "Pulling latest $BRANCH into $APP_DIR ..."
  cd "$APP_DIR"
  git fetch origin "$BRANCH"
  git reset --hard "origin/$BRANCH"
fi

cd "$APP_DIR"

echo "Installing dependencies ..."
if command -v bun >/dev/null 2>&1; then
  bun install
  bun run build
elif command -v npm >/dev/null 2>&1; then
  npm ci
  npm run build
else
  echo "ERROR: bun or npm not found"
  exit 1
fi

echo "Reloading Nginx ..."
systemctl reload nginx || true

echo "Deploy complete."
