#!/usr/bin/env bash
# Replit "Run" button: build, then serve the app and the API from one server on port 8000.
set -e
cd "$(dirname "$0")/.."

bash scripts/build.sh
cd backend
exec python -m uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
