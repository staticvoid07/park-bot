#!/usr/bin/env bash
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js isn't installed yet. Please run ./setup.sh first."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "It looks like setup hasn't been run yet. Please run ./setup.sh first."
  exit 1
fi

node src/index.js
