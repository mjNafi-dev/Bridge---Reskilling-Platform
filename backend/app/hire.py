"""
Hiring: candidates' shared journeys, and how each one lines up with an HR brief.

A candidate's "Share my journey" snapshot is saved under a short code (data/journeys.db,
not committed), so HR can type codes instead of pasting long links. The made-up demo
candidates live in data/journeys_demo.json and always work.

fit() compares only what the candidate chose to share with what the brief asks for, and
returns the reasons with it. Name, age, country and other personal details never count.
It's a guide for the person hiring: Bridge doesn't make the decision.
"""

import hashlib
import json
import re
import secrets
import sqlite3
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

import numpy as np

from .embeddings import get_embeddings
from .similarity import similarity

DATA = Path(__file__).resolve().parents[1] / "data"
DB_PATH = DATA / "journeys.db"
ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # no 0/O, 1/I/L: codes read aloud cleanly
MAX_CHARS = 20_000  # a full snapshot is ~3,000
MAX_CODES = 30
KEYS = {
    "v", "name", "country", "situation", "role", "date", "hours", "done", "learning", "total", "strong",
    "education", "noExperience", "roles", "skills", "languages", "courses", "projects", "enjoys", "causes", "interests",
}

LEVELS = ["heard of it", "knows the basics", "comfortable", "could teach it"]
LEVEL_STRENGTH = [0.3, 0.55, 0.8, 1.0]  # same scale as the matcher's LEVEL_WEIGHT
# Raw cosines (measured on the demo candidates). Short phrases sit ~0.70 from loosely
# related ones ("Typography" ~ "Design user interface" 0.735), so the bar is high, and a
# shared word root lets a lower score through ("Wireframing" ~ "Create website wireframe" 0.711).
MATCH_MIN = 0.79
MATCH_ROOT_MIN = 0.68
ROLE_MIN = 0.86  # "UI designer" 0.91; "Web designer" 0.79 and "Graphic designer" 0.76 are other roles
HOBBY_MIN = 0.8  # "Photography" ~ "Photography walks" 0.81, "Sketching" ~ "Drawing" 0.88; unrelated < 0.62
FALLBACK_MIN = 0.5  # word-overlap scores, when the embedding files are missing
GENERIC = {"design", "designs", "user", "users", "skills", "software", "standards", "data", "work", "management", "create", "develop", "basic"}
EDU_RANK = {
    "SPM": 0, "STPM / A-Levels / Foundation": 1, "Certificate (TVET / SKM)": 1, "Diploma": 2,
    "Bachelor's degree": 3, "Master's degree": 4, "PhD": 5,
}
EXPERIENCE_YEARS = {"No experience needed": 0, "Some experience (1–2 years)": 1, "Experienced (3+ years)": 3}
LANGUAGE_ALIASES = {"malay": "bahasa melayu", "bm": "bahasa melayu", "chinese": "mandarin", "english language": "english"}
# How much each part of the brief counts towards the order. Parts the brief leaves empty are skipped.
WEIGHTS = {
    "must": 0.55, "nice": 0.1, "role": 0.12, "education": 0.06, "experience": 0.05,
    "languages": 0.04, "workTypes": 0.04, "hobbies": 0.02, "causes": 0.02,
}


# ---------- Codes ----------

def normalise(code):
    return re.sub(r"[^A-Z0-9]", "", str(code).upper())


def display(n):
    """A stored code as people see it: K7M2QX -> K7M-2QX."""
    return f"{n[:3]}-{n[3:]}"


def split_codes(text):
    """Codes typed or pasted together: commas, spaces or new lines between them (links work too)."""
    out = []
    for part in re.split(r"[\s,;]+", str(text or "")):
        m = re.search(r"[?&]c(?:odes?)?=([^&#]+)", part)
        for c in (m.group(1).split(",") if m else [part]):
            n = normalise(c)
            if 4 <= len(n) <= 16 and n not in out:
                out.append(n)
    return out[:MAX_CODES]


@lru_cache(maxsize=1)
def demo():
    doc = json.loads((DATA / "journeys_demo.json").read_text(encoding="utf-8"))
    return {normalise(code): (code, snap) for code, snap in doc["journeys"].items()}, doc["project"]


def demo_project():
    return demo()[1]


def _db():
    db = sqlite3.connect(DB_PATH)
    db.execute("CREATE TABLE IF NOT EXISTS journeys (code TEXT PRIMARY KEY, digest TEXT UNIQUE, snapshot TEXT NOT NULL, created TEXT NOT NULL)")
    return db


def clean_snapshot(snap):
    if not isinstance(snap, dict) or not isinstance(snap.get("role"), str) or not snap["role"].strip():
        raise ValueError("A journey needs the role being worked towards.")
    out = {k: v for k, v in snap.items() if k in KEYS}
    out["v"] = 2
    if len(json.dumps(out, ensure_ascii=False)) > MAX_CHARS:
        raise ValueError("That journey is too big to share.")
    return out


def save(snap):
    """Store a snapshot and return its code. Sharing the same snapshot again returns the same code."""
    snap = clean_snapshot(snap)
    text = json.dumps(snap, ensure_ascii=False, sort_keys=True)
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    db = _db()
    try:
        row = db.execute("SELECT code FROM journeys WHERE digest = ?", (digest,)).fetchone()
        if row:
            return display(row[0])
        while True:
            code = display("".join(secrets.choice(ALPHABET) for _ in range(6)))
            if normalise(code) not in demo()[0] and not db.execute("SELECT 1 FROM journeys WHERE code = ?", (normalise(code),)).fetchone():
                break
        db.execute(
            "INSERT INTO journeys VALUES (?, ?, ?, ?)",
            (normalise(code), digest, text, datetime.now(timezone.utc).isoformat(timespec="seconds")),
        )
        db.commit()
        return code
    finally:
        db.close()


def load(code):
    """(display code, snapshot) for a code, or None."""
    n = normalise(code)
    if n in demo()[0]:
        return demo()[0][n]
    if not DB_PATH.exists():
        return None
    db = _db()
    try:
        row = db.execute("SELECT snapshot FROM journeys WHERE code = ?", (n,)).fetchone()
    finally:
        db.close()
    return (display(n), json.loads(row[0])) if row else None


# ---------- Fit against a brief ----------

_cache = {}


def vectors(texts):
    """Embeddings for phrases, cached: the same candidates are compared again and again."""
    emb = get_embeddings()
    todo = [t for t in dict.fromkeys(texts) if t not in _cache]
    if todo:
        if len(_cache) > 5000:
            _cache.clear()
        _cache.update(zip(todo, emb.encode(todo)))
    return np.stack([_cache[t] for t in texts]) if texts else np.zeros((0, 384), dtype=np.float32)


def raw_sim(a_list, b_list):
    """Cosine (or the word-overlap fallback) between two lists of phrases, as a matrix."""
    if not a_list or not b_list:
        return np.zeros((len(a_list), len(b_list)))
    if get_embeddings() is None:
        return np.array([[similarity(a, b) for b in b_list] for a in a_list])
    return vectors(a_list) @ vectors(b_list).T


def roots(text):
    return {w[:6] for w in re.findall(r"[a-z]{4,}", text.lower()) if w not in GENERIC}


def matches(a, b, raw):
    """Do two phrases mean the same skill?"""
    if get_embeddings() is None:
        return raw >= FALLBACK_MIN
    return raw >= MATCH_MIN or (raw >= MATCH_ROOT_MIN and bool(roots(a) & roots(b)))


def evidence(snap):
    """What the candidate shared, as (phrase, strength 0..1, where it's from, self-rated level)."""
    ev = []
    for s in snap.get("skills") or []:
        lvl = min(3, max(0, int(s.get("level", 1) or 0)))
        ev.append((s.get("name"), LEVEL_STRENGTH[lvl], f"Skills: {LEVELS[lvl]}", lvl))
    ev += [(t, 0.85, "Already strong in, before Bridge", None) for t in snap.get("strong") or []]
    ev += [(t, 0.8, "Done on Bridge", None) for t in snap.get("done") or []]
    ev += [(t, 0.45, "Learning now on Bridge", None) for t in snap.get("learning") or []]
    for r in snap.get("roles") or []:
        where = f"Worked as {r.get('title', 'a role')}".strip()
        ev += [(t, 0.75, where, None) for t in r.get("tasks") or []]
        ev += [(t, 0.7, where, None) for t in r.get("tools") or []]
    for p in snap.get("projects") or []:
        where = f"Project: {p.get('what', '')}"
        ev += [(t, 0.6, where, None) for t in p.get("skills") or []]
        ev.append((p.get("what"), 0.45, where, None))
    ev += [(c.get("name"), 0.55, f"Course: {c.get('name')}", None) for c in snap.get("courses") or []]
    field = (snap.get("education") or {}).get("field")
    if field:
        ev.append((field, 0.45, f"Studied {field}", None))
    return [(str(t).strip(), w, where, lvl) for t, w, where, lvl in ev if t and str(t).strip()]


def skill_check(wanted, ev, sims):
    """For each skill the brief asks for: has it / partly / not shown, with the best evidence."""
    out = []
    for i, want in enumerate(wanted):
        need = LEVEL_STRENGTH[min(3, max(0, int(want.get("level", 1) or 0)))]
        best = None
        for j, (text, strength, where, _) in enumerate(ev):
            q = float(sims[i, j])
            if matches(want["name"], text, q) and (best is None or q * strength > best[0]):
                best = (q * strength, text, strength, where)
        if best is None:
            out.append({"skill": want["name"], "status": "missing"})
            continue
        _, text, strength, where = best
        out.append({"skill": want["name"], "status": "has" if strength >= need - 0.01 else "partial", "evidence": text, "where": where})
    return out


def same_things(wanted, theirs):
    """Pairs from the brief and the candidate that mean the same (hobbies, interests)."""
    if not wanted or not theirs:
        return []
    m = raw_sim(wanted, theirs)
    limit = HOBBY_MIN if get_embeddings() is not None else FALLBACK_MIN
    return [{"brief": w, "theirs": theirs[int(m[i].argmax())]} for i, w in enumerate(wanted) if m[i].max() >= limit]


def lang(x):
    x = x.strip().lower()
    return LANGUAGE_ALIASES.get(x, x)


def coverage(items):
    return sum(1 if c["status"] == "has" else 0.5 if c["status"] == "partial" else 0 for c in items) / len(items) if items else None


def fit(brief, snap):
    must = [s for s in brief.get("skills") or [] if s.get("name")]
    nice = [{"name": n, "level": 1} for n in brief.get("niceToHave") or [] if n]
    ev = evidence(snap)
    wanted = must + nice
    sims = raw_sim([w["name"] for w in wanted], [e[0] for e in ev])
    checks = skill_check(wanted, ev, sims)
    must_c, nice_c = checks[: len(must)], checks[len(must):]

    role = (brief.get("role") or "").strip()
    past = [r.get("title") for r in snap.get("roles") or [] if r.get("title")]
    aims = before = None
    if role:
        m = raw_sim([role], [snap["role"], *past])
        limit = ROLE_MIN if get_embeddings() is not None else FALLBACK_MIN
        aims = bool(m[0, 0] >= limit)
        before = bool(past and m[0, 1:].max() >= limit)

    edu = snap.get("education") or {}
    edu_ok = None
    if brief.get("eduLevel") in EDU_RANK:
        have = EDU_RANK.get(edu.get("level"))
        edu_ok = None if have is None else have >= EDU_RANK[brief["eduLevel"]]  # self-taught: no comparison

    years = sum(float(r.get("years") or 0) for r in snap.get("roles") or [])
    exp_need = EXPERIENCE_YEARS.get(brief.get("experience"))
    exp_ok = None if not exp_need else years >= exp_need

    langs_want = [l for l in brief.get("languages") or [] if l]
    theirs = {lang(l) for l in snap.get("languages") or []}
    langs_shared = [l for l in langs_want if lang(l) in theirs]

    work_shared = [w for w in brief.get("workTypes") or [] if w in (snap.get("enjoys") or [])]
    cause_shared = [c for c in brief.get("causes") or [] if c in (snap.get("causes") or [])]
    interests = snap.get("interests") or {}
    hobbies = same_things([h for h in brief.get("hobbies") or [] if h], [*interests.get("hobbies", []), *interests.get("sports", [])])

    parts = {
        "must": coverage(must_c),
        "nice": coverage(nice_c),
        "role": None if aims is None else 1.0 if aims or before else 0.0,
        "education": None if edu_ok is None else float(edu_ok),
        "experience": None if exp_ok is None else float(exp_ok),
        "languages": len(langs_shared) / len(langs_want) if langs_want else None,
        "workTypes": len(work_shared) / len(brief["workTypes"]) if brief.get("workTypes") else None,
        "hobbies": len(hobbies) / len(brief["hobbies"]) if brief.get("hobbies") else None,
        "causes": min(1.0, len(cause_shared)) if brief.get("causes") else None,
    }
    counted = {k: v for k, v in parts.items() if v is not None}
    total_w = sum(WEIGHTS[k] for k in counted)
    score = sum(WEIGHTS[k] * v for k, v in counted.items()) / total_w if total_w else 0.0

    return {
        "score": round(score, 4),  # only used to order candidates; the page shows the reasons
        "must": {"has": sum(c["status"] == "has" for c in must_c), "partial": sum(c["status"] == "partial" for c in must_c), "of": len(must_c), "items": must_c},
        "nice": {"has": sum(c["status"] == "has" for c in nice_c), "of": len(nice_c), "items": nice_c},
        "role": {"aims": aims, "before": before},
        "education": {"ok": edu_ok, "level": edu.get("level")},
        "experience": {"ok": exp_ok, "years": years},
        "languages": {"shared": langs_shared, "of": len(langs_want)},
        "workTypes": work_shared,
        "causes": cause_shared,
        "hobbies": hobbies,
    }


def candidates(codes, brief=None):
    """Journeys for a list of codes, each with its fit when there's a brief."""
    found, missing = [], []
    for code in codes[:MAX_CODES]:
        hit = load(code)
        if not hit:
            missing.append(display(code) if len(code) == 6 else code)
            continue
        shown, snap = hit
        found.append({"code": shown, "journey": snap, "fit": fit(brief, snap) if brief else None})
    return {"candidates": found, "missing": missing}
