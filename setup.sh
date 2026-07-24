#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

node_major_version() {
  command -v node >/dev/null 2>&1 || return 1
  node -v | sed 's/^v//' | cut -d. -f1
}

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js was not found on this computer. Trying to install it automatically..."
  echo "(this may ask for your password to install system packages)"
  echo ""

  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y nodejs npm
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y nodejs npm
  elif command -v pacman >/dev/null 2>&1; then
    sudo pacman -Sy --noconfirm nodejs npm
  else
    echo "Could not find a supported package manager (apt/dnf/pacman) to install it automatically."
    echo "Please install Node.js yourself from https://nodejs.org/ and then re-run this script."
    exit 1
  fi
fi

MAJOR="$(node_major_version || true)"
if [ -z "$MAJOR" ] || [ "$MAJOR" -lt 18 ]; then
  echo ""
  echo "Found $(node -v 2>/dev/null || echo 'no usable Node.js'), but version 18 or newer is required."
  echo "Please install a newer Node.js from https://nodejs.org/ (or via https://github.com/nvm-sh/nvm),"
  echo "then re-run this script."
  exit 1
fi

echo "Installing park-bot..."
npm install

echo ""
echo "Installing the browser used to check availability."
echo "(this may ask for your password to install a few system libraries it needs)"
npx playwright install --with-deps chromium

echo ""
echo "Setup complete!"
echo "Next: open config.json in a text editor, set your park name and dates, then run ./start.sh"
