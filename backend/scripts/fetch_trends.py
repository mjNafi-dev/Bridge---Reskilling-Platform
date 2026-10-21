"""
Trend signal layer: adds dated demand estimates to backend/data/bridge.db.
Re-run any time to refresh (each run is a new dated snapshot).

Signals (all public, all cited in the app with their date)
  1. Live job postings (refreshed every run)
       Remotive public API (remote jobs worldwide) + Arbeitnow public API (Europe).
       Each posting title is matched to our occupations by meaning (same embeddings
       as matching). Only counts are stored, never the postings themselves.
  2. Projected growth: O*NET "Bright Outlook" list (US Dept of Labor): Rapid Growth /
       Numerous Job Openings / New & Emerging. Linked via the ESCO-O*NET crosswalk.
  3. AI exposure: ILO 2025 refined Global Index of Occupational Exposure to
       Generative AI (Gmyrek et al., ILO Working Paper 140, CC BY 4.0), per ISCO-08
       occupation. Measures technical potential, NOT expected job loss.

Two scenarios (estimates, labelled as such in the app)
  moderate = 0.50 growth + 0.30 postings + 0.20 (1 - 0.5 * exposure)
  fast     = 0.45 growth + 0.25 postings + 0.30 (1 - exposure)
In the fast-disruption scenario, high AI exposure weighs more heavily.

Run from the repo root:   python backend/scripts/fetch_trends.py
Needs: numpy, fastembed, openpyxl
"""

import csv
import io
import json
import math
import sqlite3
import sys
import time
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.embeddings import get_embeddings  # noqa: E402

DATA = ROOT / "data"
RAW = DATA / "raw" / "trends"
DB_PATH = DATA / "bridge.db"

REMOTIVE_URL = "https://remotive.com/api/remote-jobs"
ARBEITNOW_URL = "https://www.arbeitnow.com/api/job-board-api?page={}"
ARBEITNOW_PAGES = 5
BRIGHT_URL = "https://www.onetonline.org/find/bright/All_Bright_Outlook_Occupations.csv?b=0&fmt=csv"
ILO_URL = "https://raw.githubusercontent.com/pgmyrek/2025_GenAI_scores_ISCO08/main/Final_Scores_ISCO08_Gmyrek_et_al_2025.xlsx"

TITLE_MATCH = 0.86  # cosine needed for a posting title to count towards an occupation

GROWTH_SCORE = {"Rapid Growth": 1.0, "New & Emerging": 0.85, "Numerous Job Openings": 0.8}
NO_FLAG, NO_DATA = 0.4, 0.5


def download(url, cache_name, daily=False):
    """Cached download. Daily sources get one file per day (polite to free APIs)."""
    RAW.mkdir(parents=True, exist_ok=True)
    name = f"{date.today().isoformat()}_{cache_name}" if daily else cache_name
    path = RAW / name
    if not path.exists():
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Bridge hackathon trend layer)"})
        with urllib.request.urlopen(req, timeout=60) as res:
            path.write_bytes(res.read())
        time.sleep(0.5)
    return path


def fetch_postings():
    titles = []
    remotive = json.loads(download(REMOTIVE_URL, "remotive.json", daily=True).read_text(encoding="utf-8"))
    titles += [("remotive", j["title"]) for j in remotive.get("jobs", [])]
    for page in range(1, ARBEITNOW_PAGES + 1):
        data = json.loads(download(ARBEITNOW_URL.format(page), f"arbeitnow_p{page}.json", daily=True).read_text(encoding="utf-8"))
        titles += [("arbeitnow", j["title"]) for j in data.get("data", [])]
        if not data.get("links", {}).get("next"):
            break
    return titles


def count_postings(titles, emb):
    """How many posting titles match each occupation (by meaning)."""
    vecs = emb.encode([t for _, t in titles])
    counts = {}
    occ_ids = list(emb.occ_vecs)
    for uri in occ_ids:
        best = (vecs @ emb.occ_vecs[uri].T).max(axis=1)
        counts[uri] = int((best >= TITLE_MATCH).sum())
    return counts


def load_bright():
    text = download(BRIGHT_URL, "onet_bright_outlook.csv").read_text(encoding="utf-8-sig")
    flags = {}
    for row in csv.DictReader(io.StringIO(text)):
        flags[row["Code"].strip()] = [c.strip() for c in row["Categories"].split(";") if c.strip()]
    return flags


def load_ilo():
    from openpyxl import load_workbook

    wb = load_workbook(download(ILO_URL, "ilo_genai_exposure_2025.xlsx"), read_only=True, data_only=True)
    ws = wb.active
    rows = ws.iter_rows(values_only=True)
    header = [str(h) for h in next(rows)]
    i_code, i_mean, i_cat = header.index("ISCO_08"), header.index("mean_score_2025"), header.index("potential25")
    exposure = {}
    for r in rows:
        if r[i_code] is None:
            continue
        exposure[str(r[i_code]).strip().zfill(4)] = (float(r[i_mean]), str(r[i_cat]))
    return exposure


def growth_for(onet_code, bright):
    if not onet_code:
        return NO_DATA, []
    flags = bright.get(onet_code) or next((v for k, v in bright.items() if k[:7] == onet_code[:7]), None)
    if flags is None:
        return NO_FLAG, []
    return max(GROWTH_SCORE.get(f, NO_FLAG) for f in flags), flags


def exposure_for(isco, ilo):
    if not isco:
        return None, None
    code = isco.split(".")[0].zfill(4)[:4]
    if code in ilo:
        return ilo[code]
    # fall back to the average of the same 3-digit group
    group = [v[0] for k, v in ilo.items() if k[:3] == code[:3]]
    return (sum(group) / len(group), "group average") if group else (None, None)


def main():
    emb = get_embeddings()
    if emb is None:
        sys.exit("Embeddings missing: run the RunPod job first (see runpod/).")
    print("Fetching live postings...")
    titles = fetch_postings()
    print(f"  {len(titles)} postings ({sum(1 for s, _ in titles if s == 'remotive')} Remotive, "
          f"{sum(1 for s, _ in titles if s == 'arbeitnow')} Arbeitnow)")
    counts = count_postings(titles, emb)
    bright = load_bright()
    ilo = load_ilo()
    print(f"  O*NET Bright Outlook: {len(bright)} occupations | ILO exposure: {len(ilo)} ISCO occupations")

    db = sqlite3.connect(DB_PATH)
    db.executescript("""
        DROP TABLE IF EXISTS demand;
        CREATE TABLE demand (
          occupation_uri TEXT PRIMARY KEY REFERENCES occupations(uri),
          growth REAL, growth_flags TEXT,          -- O*NET Bright Outlook
          postings INTEGER, postings_score REAL,   -- live postings matched today
          exposure REAL, exposure_category TEXT,   -- ILO 2025 GenAI exposure
          moderate REAL, fast REAL,                -- the two scenarios (0..1)
          as_of TEXT, source_id TEXT
        );
        CREATE TABLE IF NOT EXISTS trend_snapshots (
          fetched_at TEXT, postings_total INTEGER, remotive INTEGER, arbeitnow INTEGER
        );
    """)
    today = date.today().isoformat()
    db.executemany(
        "INSERT OR REPLACE INTO sources(id, name, publisher, url, version, retrieved_on, license) VALUES (?,?,?,?,?,?,?)",
        [
            ("postings", "Live job postings (counts only)", "Remotive & Arbeitnow public APIs", "https://remotive.com · https://www.arbeitnow.com", f"Snapshot {today}", today, "Free public APIs; jobs credited to Remotive and Arbeitnow"),
            ("onet_bright", "O*NET Bright Outlook occupations", "US Dept of Labor / O*NET", BRIGHT_URL, "O*NET 31.0", today, "CC BY 4.0"),
            ("ilo_genai", "Generative AI and Jobs: refined global index of occupational exposure", "International Labour Organization (Gmyrek et al., WP 140)", ILO_URL, "2025", today, "CC BY 4.0"),
        ],
    )

    occs = db.execute("SELECT uri, onet_code, isco_code FROM occupations").fetchall()
    top = max(counts.values()) if counts else 0
    for uri, onet_code, isco in occs:
        g, flags = growth_for(onet_code, bright)
        n = counts.get(uri, 0)
        p = math.log1p(n) / math.log1p(top) if top else 0.0  # log scale: a few postings already matter
        x, x_cat = exposure_for(isco, ilo)
        x_val = 0.3 if x is None else x  # neutral-ish when unknown
        moderate = 0.50 * g + 0.30 * p + 0.20 * (1 - 0.5 * x_val)
        fast = 0.45 * g + 0.25 * p + 0.30 * (1 - x_val)
        db.execute(
            "INSERT INTO demand VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (uri, g, json.dumps(flags), n, round(p, 3), x, x_cat, round(moderate, 3), round(fast, 3), today, "postings,onet_bright,ilo_genai"),
        )
    db.execute(
        "INSERT INTO trend_snapshots VALUES (?,?,?,?)",
        (datetime.now(timezone.utc).isoformat(timespec="seconds"), len(titles),
         sum(1 for s, _ in titles if s == "remotive"), sum(1 for s, _ in titles if s == "arbeitnow")),
    )
    db.commit()
    rows = db.execute(
        "SELECT o.title, d.postings, d.growth, d.exposure, d.moderate, d.fast FROM demand d JOIN occupations o ON o.uri=d.occupation_uri ORDER BY (d.moderate+d.fast) DESC LIMIT 8"
    ).fetchall()
    db.close()
    print(f"\nDemand saved for {len(occs)} occupations (as of {today}). Top by balanced demand:")
    for t, n, g, x, m, f in rows:
        print(f"  {t[:40]:40} postings {n:3}  growth {g:.2f}  AI-exposure {x if x is None else round(x, 2)}  moderate {m:.2f}  fast {f:.2f}")


if __name__ == "__main__":
    main()
