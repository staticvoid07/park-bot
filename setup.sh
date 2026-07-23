#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo "Installing park-bot..."
npm install
npx playwright install chromium

echo ""
echo "Setup complete!"
echo "Next: open config.json in a text editor, set your park name and dates, then run ./start.sh"
