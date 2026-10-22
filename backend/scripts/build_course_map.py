"""
Links every skill the catalogue's jobs need to the best courses in data/courses.json.

Each course lists what it teaches in short phrases. Those phrases are embedded with the
same model as the ESCO skills (BAAI/bge-small-en-v1.5), and each skill keeps the courses
whose closest phrase is similar enough. Skills with no good course get none, and the
app shows a YouTube search for them instead.

Run from the backend folder after editing courses.json:
    python scripts/build_course_map.py            (writes data/course_map.json)
    python scripts/build_course_map.py --check    (also checks every course link is alive)

Note for --check: HubSpot Academy and Cisco Networking Academy answer 200 even for course
addresses that don't exist, so a 200 there proves nothing; OpenLearn blocks scripts (403) and
Android Developers redirects them. Open those pages in a browser to check them.
"""

import json
import sqlite3
import sys
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.embeddings import get_embeddings  # noqa: E402

DATA = Path(__file__).resolve().parents[1] / "data"
# Raw cosine, not the rescaled 0-1 score: rescaling clips every close match to 1.0 and
# loses the order. Thresholds were set by checking good and bad pairs by eye:
# below 0.822 (0.88 rescaled) wrong pairs crept in (e.g. tax law -> a copyright course).
MIN_RAW = 0.822
NEAR_BEST = 0.04  # also drop courses clearly weaker than the skill's best one
PER_SKILL = 4
# Pairs that pass the threshold but are wrong in meaning (found by reading the output).
# A skill mapped to "*" gets no course at all (the app offers a YouTube search instead).
BLOCK = {
    "analyse score": "*",  # a music score, not a data score
    "test electronic units": "*",  # hardware testing, not software unit tests
    "test mechatronic units": "*",
    "assemble goods": "*",
    "assembly (computer programming)": "*",
    "perform manual work autonomously": "*",
    "perform risk analysis": "*",
    "business analysis": "*",
    "building construction principles": "*",
    "develop digital educational materials": "*",
    "maintain customer records": "*",
    "maintain professional records": "*",
    "debt collection techniques": "*",
    "gather feedback from employees": {"coursera-clinical-teaching"},
    "aircraft mechanics": {"mit-design-mfg"},
    "solder electronics": {"mit-circuits"},
    "develop software prototype": {"mit-design-mfg"},
}


def check_links(courses):
    ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36"

    def status(c):
        try:
            req = urllib.request.Request(c["url"], headers={"User-Agent": ua})
            with urllib.request.urlopen(req, timeout=25) as r:
                return c["id"], r.status
        except Exception as e:  # some sites block scripts: check those by hand
            return c["id"], str(e)[:60]

    with ThreadPoolExecutor(12) as ex:
        bad = [(i, s) for i, s in ex.map(status, courses) if s != 200]
    for i, s in bad:
        print("  check by hand:", i, s)
    print(f"links: {len(courses) - len(bad)} of {len(courses)} answered 200")


def main():
    courses = json.loads((DATA / "courses.json").read_text(encoding="utf-8"))["courses"]
    if "--check" in sys.argv:
        check_links(courses)

    emb = get_embeddings()
    phrases, owner = [], []
    for i, c in enumerate(courses):
        for p in c["teaches"]:
            phrases.append(p)
            owner.append(i)
    owner = np.array(owner)
    pvecs = emb.encode(phrases)

    db = sqlite3.connect(DATA / "bridge.db")
    skills = db.execute(
        "SELECT DISTINCT s.uri, s.title FROM skills s JOIN occupation_skills o ON o.skill_uri = s.uri"
    ).fetchall()

    out, used = {}, Counter()
    for uri, title in skills:
        if uri not in emb.skill_vec:
            continue
        sims = pvecs @ emb.skill_vec[uri]
        top = sims.max()
        best = {}
        for k in np.argsort(-sims):
            if sims[k] < max(MIN_RAW, top - NEAR_BEST):
                break
            blocked = BLOCK.get(title.lower(), ())
            if blocked == "*":
                break
            if courses[int(owner[k])]["id"] in blocked:
                continue
            best.setdefault(int(owner[k]), float(sims[k]))  # a course's score = its closest phrase
            if len(best) == PER_SKILL:
                break
        if best:
            out[title.lower()] = [[courses[i]["id"], round(s, 3)] for i, s in best.items()]
            used.update(courses[i]["id"] for i in best)

    (DATA / "course_map.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    unused = [c["id"] for c in courses if c["id"] not in used]
    print(f"{len(out)} of {len(skills)} skills have a course; {len(unused)} courses matched nothing: {unused}")


if __name__ == "__main__":
    main()
