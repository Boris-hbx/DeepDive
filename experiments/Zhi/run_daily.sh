#!/bin/bash
# DeepDive Daily Brief Pipeline - Zhi
# Runs: fetch → LLM relevance filter → summarize → validate → build HTML site
# Scheduled via macOS launchd, runs daily at 9:00 AM

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Load API credentials (launchd doesn't inherit shell env)
if [ -f "$SCRIPT_DIR/.env" ]; then
    export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)
fi

# Ensure logs directory exists
mkdir -p "$SCRIPT_DIR/logs"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting daily brief pipeline..."

# Run main pipeline (fetch → filter → summarize → validate)
python3 src/main.py 2>&1

if [ $? -ne 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Pipeline failed!"
    exit 1
fi

# Build static HTML site
python3 build_site.py 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Pipeline complete."
