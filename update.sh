#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

if ! command -v git >/dev/null 2>&1; then
  echo "Git isn't installed, so this folder can't be auto-updated."
  echo "Please install git, or just download the latest copy from GitHub and redo setup."
  exit 1
fi

if [ ! -d ".git" ]; then
  echo "This folder wasn't set up with git, so it can't be auto-updated."
  echo "Please download the latest copy from GitHub and redo setup."
  exit 1
fi

# config.json holds your personal watch settings - keep it safe across the update
# even if the update itself changed the example/default config.json in the repo.
cp config.json config.json.mine

echo "Checking for updates..."
git fetch origin
git reset --hard origin/main

mv config.json.mine config.json

echo ""
echo "Updating dependencies..."
npm install

echo ""
echo "Update complete! Your config.json was left untouched."
echo "If the README mentions new config options you want to use, add them yourself."
