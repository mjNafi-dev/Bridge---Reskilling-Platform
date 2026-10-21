"""
Builds backend/data/bridge.db from official, public sources. Nothing is invented.

Sources
  1. ESCO (European Commission) API: occupations, descriptions, ISCO codes,
     and the essential/optional skills each occupation needs.
  2. ESCO-O*NET crosswalk (ESCO Secretariat + US Dept of Labor, 2022):
     links each ESCO occupation to a US O*NET occupation.
  3. O*NET 31.0 "career_interest_types" (US Dept of Labor): Holland RIASEC
     interest scores per occupation. We use the top interest type to sort
     roles into categories (Technical, Creative, ...).

Raw downloads are cached in backend/data/raw/ (not committed; re-downloaded when missing).
Run from the repo root:   python backend/scripts/build_db.py
"""

import csv
import json
import sqlite3
import sys
import time
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]  # backend/
DATA = ROOT / "data"
RAW = DATA / "raw"
DB_PATH = DATA / "bridge.db"

ESCO_API = "https://ec.europa.eu/esco/api"
CROSSWALK_URL = "https://esco.ec.europa.eu/system/files/2023-08/ONET_%28Occupations%29_0_updated.csv"
ONET_INTERESTS_URL = "https://www.onetcenter.org/dl_files/database/db_31_0_csv/career_interest_types.csv"

# Holland RIASEC type -> the category shown to users
RIASEC_CATEGORY = {
    "Realistic": "Hands-on",
    "Investigative": "Technical",
    "Artistic": "Creative",
    "Social": "People & care",
    "Enterprising": "Business & organising",
    "Conventional": "Business & organising",
}

# Prefer the closest crosswalk match
MATCH_RANK = {"exactMatch": 0, "closeMatch": 1, "narrowMatch": 2, "broadMatch": 3}


def fetch(url, cache_file, as_json=True):
    """Download once, then reuse the cached copy."""
    cache_file.parent.mkdir(parents=True, exist_ok=True)
    if not cache_file.exists():
        for attempt in range(3):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "Bridge-hackathon-builder"})
                with urllib.request.urlopen(req, timeout=30) as res:
                    cache_file.write_bytes(res.read())
                time.sleep(0.15)  # be polite to public APIs
                break
            except Exception as err:  # network hiccup: retry
                if attempt == 2:
                    raise RuntimeError(f"Could not download {url}: {err}")
                time.sleep(2)
    text = cache_file.read_text(encoding="utf-8-sig")
    return json.loads(text) if as_json else text


def safe_name(text):
    return "".join(c if c.isalnum() else "_" for c in text)[:80]


def load_seed_roles():
    lines = (DATA / "seed_roles.txt").read_text(encoding="utf-8").splitlines()
    return [l.strip() for l in lines if l.strip() and not l.startswith("#")]


def fetch_occupations(seeds):
    occupations = {}
    for i, term in enumerate(seeds, 1):
        q = urllib.parse.urlencode({"text": term, "type": "occupation", "language": "en", "limit": 1})
        found = fetch(f"{ESCO_API}/search?{q}", RAW / "esco" / "search" / f"{safe_name(term)}.json")
        results = found.get("_embedded", {}).get("results", [])
        if not results:
            print(f"  ! no ESCO match for '{term}'")
            continue
        uri = results[0]["uri"]
        if uri in occupations:
            continue
        q = urllib.parse.urlencode({"uri": uri, "language": "en"})
        occ = fetch(f"{ESCO_API}/resource/occupation?{q}", RAW / "esco" / "occupation" / f"{safe_name(uri.rsplit('/', 1)[-1])}.json")
        links = occ.get("_links", {})
        isco = (links.get("broaderIscoGroup") or [{}])[0]
        occupations[uri] = {
            "uri": uri,
            "seed": term,
            "title": occ.get("title", ""),
            "description": occ.get("description", {}).get("en", {}).get("literal", ""),
            # Some ESCO jobs sit under another ESCO job instead of an ISCO group;
            # their own ESCO code ("2654.4") still starts with the ISCO code.
            "isco_code": isco.get("code") or str(occ.get("code", "")).split(".")[0],
            "isco_title": isco.get("title", ""),
            "alt_labels": occ.get("alternativeLabel", {}).get("en", []),
            "skills": [
                {"uri": s["uri"], "title": s["title"], "type": s.get("skillType", "").rsplit("/", 1)[-1], "relation": rel}
                for rel, key in (("essential", "hasEssentialSkill"), ("optional", "hasOptionalSkill"))
                for s in links.get(key, [])
            ],
        }
        print(f"  [{i}/{len(seeds)}] {term} -> {occupations[uri]['title']} ({len(occupations[uri]['skills'])} skills)")
    return occupations


def load_crosswalk():
    text = fetch(CROSSWALK_URL, RAW / "esco_onet_crosswalk.csv", as_json=False)
    rows = list(csv.reader(text.splitlines()))
    start = next(i for i, r in enumerate(rows) if r and r[0] == "O*NET Id")
    best = {}
    for r in rows[start + 1:]:
        if len(r) < 7:
            continue
        onet_id, _, _, esco_uri, _, _, match = r[:7]
        rank = MATCH_RANK.get(match.strip(), 9)
        if esco_uri not in best or rank < best[esco_uri][1]:
            best[esco_uri] = (onet_id.strip(), rank, match.strip())
    return best


def load_interests():
    text = fetch(ONET_INTERESTS_URL, RAW / "onet_career_interest_types.csv", as_json=False)
    scores = {}
    for row in csv.DictReader(text.splitlines()):
        if row.get("Scale ID") != "OI":
            continue
        scores.setdefault(row["O*NET-SOC Code"], {})[row["Element Name"]] = float(row["Data Value"])
    return scores


def interests_for(onet_code, interests):
    if onet_code in interests:
        return interests[onet_code]
    base = onet_code[:7]  # e.g. 15-2051.01 -> 15-2051 (codes shift between O*NET versions)
    for code, s in interests.items():
        if code.startswith(base):
            return s
    return None


def build():
    seeds = load_seed_roles()
    print(f"Fetching {len(seeds)} roles from ESCO...")
    occupations = fetch_occupations(seeds)
    crosswalk = load_crosswalk()
    interests = load_interests()

    DB_PATH.unlink(missing_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.executescript((ROOT / "schema.sql").read_text(encoding="utf-8"))

    today = date.today().isoformat()
    db.executemany(
        "INSERT INTO sources(id, name, publisher, url, version, retrieved_on, license) VALUES (?,?,?,?,?,?,?)",
        [
            ("esco", "ESCO occupations & skills", "European Commission", "https://esco.ec.europa.eu", "API (v1.2)", today, "Free reuse with attribution (Commission Decision 2011/833/EU)"),
            ("esco_onet", "ESCO-O*NET crosswalk", "ESCO Secretariat & US Dept of Labor", CROSSWALK_URL, "v1, Sep 2022", today, "Free reuse with attribution"),
            ("onet", "O*NET career interest types (RIASEC)", "US Dept of Labor / O*NET Center", ONET_INTERESTS_URL, "O*NET 31.0", today, "CC BY 4.0"),
        ],
    )

    missing_category = 0
    for occ in occupations.values():
        onet = crosswalk.get(occ["uri"])
        scores = interests_for(onet[0], interests) if onet else None
        riasec = sorted(scores, key=scores.get, reverse=True)[:2] if scores else []
        category = RIASEC_CATEGORY.get(riasec[0]) if riasec else None
        if not category:
            missing_category += 1
        db.execute(
            "INSERT INTO occupations VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (
                occ["uri"], occ["title"], occ["description"], occ["isco_code"], occ["isco_title"],
                onet[0] if onet else None, onet[2] if onet else None,
                json.dumps(riasec), json.dumps(scores) if scores else None, category, json.dumps(occ["alt_labels"]),
            ),
        )
        for s in occ["skills"]:
            db.execute("INSERT OR IGNORE INTO skills(uri, title, skill_type) VALUES (?,?,?)", (s["uri"], s["title"], s["type"]))
            db.execute("INSERT OR IGNORE INTO occupation_skills VALUES (?,?,?)", (occ["uri"], s["uri"], s["relation"]))

    db.commit()
    n_occ = db.execute("SELECT COUNT(*) FROM occupations").fetchone()[0]
    n_sk = db.execute("SELECT COUNT(*) FROM skills").fetchone()[0]
    n_links = db.execute("SELECT COUNT(*) FROM occupation_skills").fetchone()[0]
    cats = db.execute("SELECT category, COUNT(*) FROM occupations GROUP BY category").fetchall()
    db.close()
    print(f"\nBuilt {DB_PATH.name}: {n_occ} occupations, {n_sk} skills, {n_links} occupation-skill links")
    print("Categories:", dict(cats))
    if missing_category:
        print(f"{missing_category} occupations had no O*NET interest data (category left empty)")


if __name__ == "__main__":
    sys.exit(build())
