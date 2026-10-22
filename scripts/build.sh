#!/usr/bin/env bash
# Builds the whole app for Replit: Python deps, the React app, and the embedding model
# (downloaded once here so the first visitor doesn't wait for it).
set -e
cd "$(dirname "$0")/.."

python -m pip install -r backend/requirements.txt
(cd frontend && npm ci && npm run build)
(cd backend && python -c "from app.embeddings import get_embeddings; e = get_embeddings(); e and e.encode(['warm up']); print('embedding model ready')")
