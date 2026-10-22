"""
Bridge API (FastAPI).
Run from the backend folder:   uvicorn app.main:app --reload --port 8000
If the React app has been built (frontend/dist), this server also serves it, so one
process is the whole app (that's how it runs on Replit).
"""

from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from . import courses, cv_ai
from .cv import MAX_BYTES, CvError, read_cv
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
    pin: str | None = None  # chosen job's uri: always sent back (recalibrating the dashboard)


class CoursesRequest(BaseModel):
    topics: list[str] = Field(max_length=300)  # pathway topic names (ESCO skill titles)
    budget: str | None = None  # onboarding answer: Free only / Low-cost / HRD Corp claimable / Any
    learnStyle: list[str] = []  # onboarding answer: Videos / Reading / Hands-on practice / Learning with others


@app.get("/api/health")
def health():
    return {"ok": True, "occupations": len(CATALOGUE["occupations"]), "cvAi": cv_ai.enabled()}


@app.get("/api/sources")
def sources():
    """Every data source, with the date it was retrieved (shown on the Data sources page)."""
    return CATALOGUE["sources"]


@app.get("/api/data")
def data_overview():
    """Everything the Data sources page shows: sources with dates, catalogue size, the RunPod job, live snapshot."""
    import json
    import sqlite3

    from .matching import DB_PATH

    db = sqlite3.connect(DB_PATH)
    counts = {
        "occupations": len(CATALOGUE["occupations"]),
        "skills": db.execute("SELECT COUNT(*) FROM skills").fetchone()[0],
        "links": db.execute("SELECT COUNT(*) FROM occupation_skills").fetchone()[0],
        "with_demand": len(CATALOGUE["demand"]),
    }
    snap = db.execute("SELECT fetched_at, postings_total, remotive, arbeitnow FROM trend_snapshots ORDER BY fetched_at DESC LIMIT 1").fetchone()
    db.close()
    meta_path = Path(__file__).resolve().parents[1] / "data" / "embeddings" / "embeddings_meta.json"
    emb = None
    if meta_path.exists():
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        emb = {k: meta.get(k) for k in ("model", "dimensions", "count", "device", "gpu", "seconds", "created_utc")}
    return {
        "sources": CATALOGUE["sources"],
        "counts": counts,
        "snapshot": dict(zip(("fetched_at", "postings_total", "remotive", "arbeitnow"), snap)) if snap else None,
        "embeddings": emb,
        "courses": courses.overview(),
        "cv_ai": cv_ai.enabled(),
    }


@app.get("/api/org/{code}")
def org_view(code: str):
    """Anonymous, combined numbers for an organisation. Demo: one SYNTHETIC organisation (scripts/make_org_demo.py)."""
    import json

    path = Path(__file__).resolve().parents[1] / "data" / "org_demo.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="No organisation data yet.")
    data = json.loads(path.read_text(encoding="utf-8"))
    if code.strip().upper() != data["org"]["code"]:
        raise HTTPException(status_code=404, detail="No organisation with that code.")
    return data


@app.post("/api/match")
def run_match(req: MatchRequest):
    return match(req.profile, req.comfort, CATALOGUE, req.pin)


@app.post("/api/courses")
def course_suggestions(req: CoursesRequest):
    """Checked courses for each pathway topic, filtered by budget and ordered by learning style."""
    return courses.suggest(req.topics, req.budget, req.learnStyle)


@app.post("/api/cv")
def read_cv_upload(file: UploadFile = File(...)):
    """Read a CV into onboarding answers. The file stays in memory and is never stored or logged."""
    data = file.file.read(MAX_BYTES + 1)  # sync endpoint: FastAPI runs it off the event loop
    try:
        return read_cv(file.filename or "", data)
    except CvError as e:
        raise HTTPException(status_code=422, detail=str(e))


# ---- Built React app (keep this LAST: its catch-all route would shadow anything after it)
DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"

if DIST.is_dir():

    @app.get("/{path:path}", include_in_schema=False)
    def frontend(path: str):
        if path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        file = (DIST / path).resolve()
        if path and file.is_file() and DIST.resolve() in file.parents:
            return FileResponse(file)
        return FileResponse(DIST / "index.html")  # app routes (/onboarding, /results...) load the app

