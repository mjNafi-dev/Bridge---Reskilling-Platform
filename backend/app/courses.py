"""
Course suggestions for pathway topics.

data/courses.json is a hand-checked catalogue of real courses (official pages only).
data/course_map.json links each ESCO skill to its closest courses by meaning
(scripts/build_course_map.py). Here we only filter and order them for one person:
their budget answer decides what's allowed, their learning style breaks near-ties.
Topics with no course get none: the app offers a YouTube search for those.
"""

import json
from functools import lru_cache
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "data"

STYLE_FORMAT = {"Videos": "video", "Reading": "reading", "Hands-on practice": "hands-on"}
STYLE_BONUS = 0.012  # map scores are raw cosines a few hundredths apart, so nudges stay small
FREE_BONUS = {"Low-cost": 0.012, "HRD Corp claimable": 0.004, "Any": 0.004}
LONG_HOURS = 80  # a whole certificate for one topic is a lot: shorter courses go first
LONG_PENALTY = 0.008
PER_TOPIC = 3
FIELDS = ("id", "title", "provider", "url", "cost", "price", "hours", "level", "format")


@lru_cache(maxsize=1)
def catalogue():
    try:
        doc = json.loads((DATA / "courses.json").read_text(encoding="utf-8"))
        links = json.loads((DATA / "course_map.json").read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None
    return {"checked": doc["checked"], "courses": {c["id"]: c for c in doc["courses"]}, "map": links}


def overview():
    """Numbers for the Data sources page."""
    cat = catalogue()
    if not cat:
        return None
    courses = cat["courses"].values()
    return {
        "count": len(cat["courses"]),
        "free": sum(c["cost"] == "free" for c in courses),
        "providers": len({c["provider"] for c in courses}),
        "skills": len(cat["map"]),
        "checked": cat["checked"],
    }


def rank(course, score, budget, styles):
    s = score
    if course["cost"] == "free":
        s += FREE_BONUS.get(budget, 0)
    if course["format"] in {STYLE_FORMAT[x] for x in styles if x in STYLE_FORMAT}:
        s += STYLE_BONUS
    if course.get("community") and "Learning with others" in styles:
        s += STYLE_BONUS
    if course["hours"] > LONG_HOURS:
        s -= LONG_PENALTY
    return s


def suggest(topics, budget=None, styles=()):
    """{topic: {"courses": [...], "hidden": n}} for every topic asked about.
    "Free only" leaves paid courses out and says how many were hidden."""
    cat = catalogue()
    out = {}
    for topic in topics:
        found = [(cat["courses"][cid], score) for cid, score in (cat["map"].get(topic.strip().lower(), []) if cat else [])]
        allowed = [(c, s) for c, s in found if budget != "Free only" or c["cost"] == "free"]
        allowed.sort(key=lambda cs: -rank(cs[0], cs[1], budget, styles))
        out[topic] = {
            "courses": [{**{k: c[k] for k in FIELDS}, "hoursEstimate": c.get("hoursEstimate", False)} for c, _ in allowed[:PER_TOPIC]],
            "hidden": len(found) - len(allowed),
        }
    return {"checked": cat["checked"] if cat else None, "topics": out}
