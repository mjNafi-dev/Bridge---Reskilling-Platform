"""
Bridge API (FastAPI).
Run from the backend folder:   uvicorn app.main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .matching import load_catalogue, match

app = FastAPI(title="Bridge API", version="0.1.0")

# The React app runs on another port during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

CATALOGUE = load_catalogue()  # loaded once at startup


class MatchRequest(BaseModel):
    profile: dict
    comfort: float = 0.5  # 0 = stay close to what I know, 1 = open to brand-new


@app.get("/api/health")
def health():
    return {"ok": True, "occupations": len(CATALOGUE["occupations"])}


@app.get("/api/sources")
def sources():
    """Every data source, with the date it was retrieved (shown on the Data sources page)."""
    return CATALOGUE["sources"]


@app.post("/api/match")
def run_match(req: MatchRequest):
    return match(req.profile, req.comfort, CATALOGUE)
