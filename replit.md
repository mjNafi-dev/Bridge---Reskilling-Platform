# Running on Replit

- Press **Run** to execute `bash scripts/start.sh`.
- The existing script installs backend dependencies, builds the frontend,
  warms the embedding model cache, and starts one FastAPI/Uvicorn server
  on `0.0.0.0:8000`. Port 8000 maps to external port 80.
- The `Run` workflow uses this exact command; no second server is needed.
- Development configuration sets `PIP_CONSTRAINT` to
  `/home/runner/workspace/replit-constraints.txt` for the compatible Pillow pin.
- Development configuration sets `SSL_CERT_FILE` and `REQUESTS_CA_BUNDLE`
  to `/etc/ssl/certs/ca-certificates.crt`.
- No API keys or AI integrations are configured. AI-assisted CV reading is off.

Verified: frontend renders, embedding warm-up succeeds, `/api/health`
and `/api/data` return HTTP 200. App source, build/start scripts, README,
and original backend/frontend dependency manifests were not changed.
