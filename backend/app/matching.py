"""
Matching: turns one user profile into ranked, explainable recommendations.

Bridge score = weighted mix of four parts (all 0..1):
  F  Familiarity   share of the job's required skills the user already has
  D  Demand        future demand from the trend layer (balance of moderate + fast scenarios)
  E  Ease          how quickly the gap can be closed at the user's weekly hours
  I  Interest fit  match with the work types the user enjoys (Holland RIASEC, from O*NET)
Jobs that serve one of the user's chosen causes (UN SDGs, see sdg.py) get +3 points.
The comfort slider (0 = stay close, 1 = stretch) moves weight between F/E and D.
If no demand data exists yet, D is left out and the other weights are rescaled,
and the result says so. Skill similarity uses embeddings computed on a RunPod GPU
(falls back to word overlap if they're missing). No generative AI is used here.
"""

import json
import sqlite3
from pathlib import Path

import numpy as np

from .embeddings import get_embeddings
from .sdg import CAUSE_BOOST, CAUSES, cause_goals, tag
from .similarity import similarity, words

DB_PATH = Path(__file__).resolve().parents[1] / "data" / "bridge.db"

LEVEL_WEIGHT = [0.3, 0.55, 0.8, 1.0]  # heard of it / basics / comfortable / could teach it
RECENCY_WEIGHT = {"This year": 1.0, "1–3 years ago": 0.8, "3+ years ago": 0.55}
COVER_THRESHOLD = 0.2  # rescaled similarity below this counts as no evidence
ESSENTIAL_W, OPTIONAL_W = 1.0, 0.0  # familiarity counts essential skills; optional ones still show as overlaps

# Rough learning-time estimates per missing item (labelled as estimates in the UI)
HOURS_PER_SKILL = {"skill": 18, "knowledge": 12}

# Onboarding "kind of work you enjoy" -> Holland RIASEC type
WORKTYPE_RIASEC = {
    "Hands-on": "Realistic",
    "Analytical": "Investigative",
    "Creative": "Artistic",
    "Helping people": "Social",
    "Leading & persuading": "Enterprising",
    "Organising": "Conventional",
}

PEER_LEVEL = 0.8  # a typical worker is comfortable with their own job's essential skills
_peer_cache = {}  # target job uri -> familiarity of a typical worker from every other job

MAX_PER_CATEGORY = 2
TOP_N = 5


def load_catalogue(db_path=DB_PATH):
    db = sqlite3.connect(db_path)
    db.row_factory = sqlite3.Row
    occupations = {r["uri"]: dict(r) for r in db.execute("SELECT * FROM occupations")}
    for occ in occupations.values():
        occ["riasec"] = json.loads(occ["riasec"] or "[]")
        occ["riasec_scores"] = json.loads(occ["riasec_scores"] or "null")
        occ["alt_labels"] = json.loads(occ["alt_labels"] or "[]")
        occ["skills"] = []
        occ["sdgs"] = tag(occ)  # UN SDG goals this job serves, with a reason
    for r in db.execute(
        "SELECT os.occupation_uri, os.relation, s.uri, s.title, s.skill_type "
        "FROM occupation_skills os JOIN skills s ON s.uri = os.skill_uri"
    ):
        occupations[r["occupation_uri"]]["skills"].append(
            {"uri": r["uri"], "title": r["title"], "type": r["skill_type"], "relation": r["relation"]}
        )
    # Breadth: how many jobs need a skill (drives bubble size on the results page)
    breadth = {}
    for occ in occupations.values():
        for sk in occ["skills"]:
            breadth[sk["uri"]] = breadth.get(sk["uri"], 0) + 1
    for occ in occupations.values():
        for sk in occ["skills"]:
            sk["breadth"] = breadth[sk["uri"]]
    demand = {}
    if db.execute("SELECT name FROM sqlite_master WHERE name='demand'").fetchone():
        for r in db.execute("SELECT * FROM demand"):
            demand[r["occupation_uri"]] = dict(r)
    sample = None  # how many job ads the latest snapshot looked at
    if db.execute("SELECT name FROM sqlite_master WHERE name='trend_snapshots'").fetchone():
        row = db.execute("SELECT postings_total FROM trend_snapshots ORDER BY fetched_at DESC LIMIT 1").fetchone()
        sample = row[0] if row else None
    sources = [dict(r) for r in db.execute("SELECT * FROM sources")]
    db.close()
    return {"occupations": occupations, "demand": demand, "sources": sources, "postings_sample": sample}


def as_int(value, default, lo, hi):
    """Read a number from user input without crashing on blanks or text."""
    try:
        return min(max(int(float(value)), lo), hi)
    except (TypeError, ValueError):
        return default


def user_evidence(profile):
    """Everything the user told us, as (text, weight, where-it-came-from)."""
    ev = []
    for s in profile.get("skills") or []:
        lvl = LEVEL_WEIGHT[as_int(s.get("level"), 1, 0, 3)]
        ev.append((s.get("name") or "", lvl * RECENCY_WEIGHT.get(s.get("lastUsed"), 0.8), "skill"))
    for role in profile.get("roles") or []:
        for t in role.get("tasks") or []:
            ev.append((t, 0.75, "task"))
        for t in role.get("tools") or []:
            ev.append((t, 0.6, "tool"))
        if role.get("title"):
            ev.append((role["title"], 0.5, "role"))
    for p in profile.get("projects") or []:
        for t in p.get("skills") or []:
            ev.append((t, 0.55, "project"))
        if p.get("what"):
            ev.append((p["what"], 0.4, "project"))
    for c in profile.get("courses") or []:
        if c.get("name"):
            ev.append((c["name"], 0.5, "course"))
    # Topics learned on Bridge (kept when switching pathway): learning = basics, done = comfortable
    for t in profile.get("learned") or []:
        if t.get("name"):
            ev.append((t["name"], LEVEL_WEIGHT[as_int(t.get("level"), 1, 0, 3)], "learned"))
    if profile.get("eduField"):
        ev.append((profile["eduField"], 0.45, "education"))
    return [(str(t).strip(), w, k) for t, w, k in ev if t and str(t).strip()]


def similarity_matrix(evidence, occ, user_vecs, emb):
    """Rows = user's evidence, columns = the job's skills, values 0..1."""
    if emb is not None and user_vecs is not None and all(sk["uri"] in emb.skill_vec for sk in occ["skills"]):
        return emb.rescale(user_vecs @ emb.skill_matrix([sk["uri"] for sk in occ["skills"]]).T)
    return np.array([[similarity(t, sk["title"]) for sk in occ["skills"]] for t, _, _ in evidence]).reshape(len(evidence), len(occ["skills"]))


def familiarity(occ, evidence, user_vecs=None, emb=None):
    """Share of the job's (weighted) skills the user already covers, plus the evidence."""
    sims = similarity_matrix(evidence, occ, user_vecs, emb)
    ev_w = np.array([w for _, w, _ in evidence], dtype=np.float32).reshape(-1, 1)
    strength = np.where(sims >= COVER_THRESHOLD, sims, 0.0) * ev_w if len(evidence) else np.zeros((0, len(occ["skills"])))
    total = covered = 0.0
    overlaps, gaps, topics = [], [], []
    for j, sk in enumerate(occ["skills"]):
        w = ESSENTIAL_W if sk["relation"] == "essential" else OPTIONAL_W
        if len(evidence):
            i = int(strength[:, j].argmax())
            best, best_ev = float(strength[i, j]), evidence[i]
        else:
            best, best_ev = 0.0, None
        total += w
        covered += w * min(1.0, best)
        # One entry per skill (essential and optional): what the results bubbles are drawn from
        topics.append({
            "title": sk["title"],
            "type": sk["type"],
            "relation": sk["relation"],
            "coverage": round(min(1.0, best), 2),
            "from": best_ev[0] if best_ev and best >= COVER_THRESHOLD else None,
            "breadth": sk.get("breadth", 1),
        })
        if best_ev and best >= 0.35:
            overlaps.append({"from": best_ev[0], "source": best_ev[2], "to": sk["title"], "strength": round(best, 2), "relation": sk["relation"]})
        elif sk["relation"] == "essential":
            gaps.append({"title": sk["title"], "type": sk["type"], "coverage": round(best, 2)})
    score = covered / total if total else 0.0
    overlaps.sort(key=lambda o: (o["relation"] != "essential", -o["strength"]))
    return score, overlaps, gaps, topics


def gap_hours(gaps):
    return sum(HOURS_PER_SKILL.get(g["type"], 15) * (1 - g["coverage"]) for g in gaps)


def interest_fit(occ, profile):
    picked = [WORKTYPE_RIASEC[w] for w in (profile.get("workTypes") or []) if w in WORKTYPE_RIASEC]
    scores = occ.get("riasec_scores")
    if not picked or not scores:
        return None
    # O*NET interest scores run 1..7
    return sum((scores.get(t, 1) - 1) / 6 for t in picked) / len(picked)


def peer_familiarities(target, cat, emb):
    """
    A synthetic comparison group built from ESCO, not real people: for every other job,
    a typical worker who knows that job's essential skills. Returns how familiar each
    of them would be with `target`, using the same familiarity measure as for the user.
    """
    if target["uri"] in _peer_cache:
        return _peer_cache[target["uri"]]
    out = []
    for occ in cat["occupations"].values():
        if occ["uri"] == target["uri"]:
            continue
        known = [sk for sk in occ["skills"] if sk["relation"] == "essential" and (emb is None or sk["uri"] in emb.skill_vec)]
        if not known:
            continue
        evidence = [(sk["title"], PEER_LEVEL, "peer") for sk in known]
        vecs = emb.skill_matrix([sk["uri"] for sk in known]) if emb is not None else None
        out.append(familiarity(target, evidence, vecs, emb)[0])
    _peer_cache[target["uri"]] = out
    return out


def add_peer_rank(result, cat, emb):
    peers = peer_familiarities(cat["occupations"][result["uri"]], cat, emb)
    if peers:
        ahead = sum(round(p * 100) < result["familiarity"] for p in peers)
        result["peers"] = {"ahead_of": round(100 * ahead / len(peers)), "group_size": len(peers), "is_estimate": True}


def is_current_role(occ, role_vecs, role_titles, emb):
    """Skip jobs the user already does (by meaning if embeddings exist)."""
    if not role_titles:
        return False
    if emb is not None and occ["uri"] in emb.occ_vecs:
        return bool((role_vecs @ emb.occ_vecs[occ["uri"]].T).max() >= 0.93)
    names = [occ["title"], *occ["alt_labels"]]
    return any(similarity(t, n) >= 0.9 for t in role_titles for n in names)


EYED_MIN = 0.80  # raw cosine: "Video editor" -> video and motion picture editor is 1.0; "doctor" (not in the catalogue) peaks ~0.70
EYED_TIE = 0.01  # near-ties go to the role sharing more words ("product manager" -> product development manager)


def find_role(text, cat, emb):
    """The catalogue role a typed role means (onboarding's "A role you're already eyeing"), or None."""
    text = (text or "").strip()
    if not text:
        return None
    occs = cat["occupations"]
    if emb is None:
        best = max(occs.values(), key=lambda o: max(similarity(text, n) for n in [o["title"], *o["alt_labels"]]))
        return best["uri"] if max(similarity(text, n) for n in [best["title"], *best["alt_labels"]]) >= 0.5 else None
    v = emb.encode([text])[0]
    scores = {u: float((emb.occ_vecs[u] @ v).max()) for u in occs if u in emb.occ_vecs}
    if not scores or max(scores.values()) < EYED_MIN:
        return None
    top = max(scores.values())
    close = [u for u, s in scores.items() if s >= top - EYED_TIE]
    # main title first: "product manager" shares 2 words with product development manager's title,
    # but only 1 with marketing manager's (whose other names include "product marketing manager")
    in_title = lambda u: len(words(text) & words(occs[u]["title"]))
    in_any = lambda u: max(len(words(text) & words(n)) for n in [occs[u]["title"], *occs[u]["alt_labels"]])
    return max(close, key=lambda u: (in_title(u), in_any(u), scores[u]))


def weights(comfort, has_demand, has_interest):
    c = min(max(comfort, 0.0), 1.0)
    w = {"F": 0.40 - 0.20 * c, "E": 0.20 - 0.10 * c, "D": 0.25 + 0.30 * c, "I": 0.15}
    if not has_demand:
        w.pop("D")
    if not has_interest:
        w.pop("I")
    total = sum(w.values())
    return {k: v / total for k, v in w.items()}


def match(profile, comfort=0.5, catalogue=None, pin=None):
    """pin: a job uri to always return as `pinned` (the user's chosen pathway, for recalibration).
    The role the user is eyeing is always returned as `eyed`, with its real rank, even outside the top 5."""
    cat = catalogue or load_catalogue()
    evidence = user_evidence(profile)
    hours_per_week = as_int(profile.get("hoursPerWeek"), 5, 1, 167)
    comfort = min(max(float(0.5 if comfort is None else comfort), 0.0), 1.0)  # 0 is a real answer
    emb = get_embeddings()
    role_titles = [r["title"] for r in profile.get("roles") or [] if r.get("title")]
    user_vecs = emb.encode([t for t, _, _ in evidence]) if emb else None
    role_vecs = emb.encode(role_titles) if emb and role_titles else None
    wanted = cause_goals(profile)
    eyeing = (profile.get("eyeing") or "").strip()
    eyed_uri = find_role(eyeing, cat, emb)
    results = []

    for occ in cat["occupations"].values():
        # Skip jobs the user already does, unless it's the one they asked about
        if not occ["skills"] or (occ["uri"] != eyed_uri and is_current_role(occ, role_vecs, role_titles, emb)):
            continue
        F, overlaps, gaps, topics = familiarity(occ, evidence, user_vecs, emb)
        hours = gap_hours(gaps)
        weeks = hours / hours_per_week
        E = 1 / (1 + weeks / 12)  # ~12 weeks of learning = 0.5
        I = interest_fit(occ, profile)
        d = cat["demand"].get(occ["uri"])
        D = None
        if d:
            D = (d["moderate"] + d["fast"]) / 2
        w = weights(comfort, D is not None, I is not None)
        parts = {"F": F, "E": E, "D": D, "I": I}
        score = sum(w[k] * parts[k] for k in w)
        causes = [c for c in profile.get("causes") or [] if CAUSES.get(c, set()) & {g["goal"] for g in occ["sdgs"]}]
        boost = CAUSE_BOOST if causes and wanted else 0
        results.append({
            "uri": occ["uri"],
            "title": occ["title"],
            "description": occ["description"],
            "category": occ["category"],
            "isco": occ["isco_code"],
            "score": min(100, round(score * 100) + boost),
            "sdgs": occ["sdgs"],
            "cause_boost": boost,
            "causes_matched": causes,
            "familiarity": round(F * 100),
            "hours": round(hours),
            "weeks": round(weeks, 1),
            "overlaps": overlaps[:6],
            "gaps": sorted(gaps, key=lambda g: g["coverage"])[:8],
            "topics": topics,
            "demand": None if not d else {
                "moderate": round(d["moderate"] * 100),
                "fast": round(d["fast"] * 100),
                "balanced": round(D * 100),
                "growth_flags": json.loads(d.get("growth_flags") or "[]"),  # O*NET Bright Outlook
                "postings_today": d.get("postings"),  # live postings matched in today's snapshot
                "postings_sample": cat.get("postings_sample"),  # ...out of this many looked at
                "ai_exposure": None if d.get("exposure") is None else round(d["exposure"], 2),  # ILO 2025, 0..1
                "ai_exposure_category": d.get("exposure_category"),
                "sources": (d.get("source_id") or "").split(","),
                "as_of": d.get("as_of"),
                "is_estimate": True,
            },
            "interest_fit": None if I is None else round(I * 100),
            "breakdown": {k: {"weight": round(w[k], 2), "value": round(parts[k] * 100)} for k in w},
        })

    results.sort(key=lambda r: r["score"], reverse=True)
    picked, per_cat = [], {}
    for r in results:  # keep variety: at most 2 per category
        key = r["category"] or "Other"
        if per_cat.get(key, 0) >= MAX_PER_CATEGORY:
            continue
        picked.append(r)
        per_cat[key] = per_cat.get(key, 0) + 1
        if len(picked) == TOP_N:
            break

    pinned = next((r for r in results if r["uri"] == pin), None) if pin else None
    eyed_rank = next((i for i, r in enumerate(results) if r["uri"] == eyed_uri), None) if eyed_uri else None
    eyed = results[eyed_rank] if eyed_rank is not None else None
    if eyed:  # same object as in `picked` when it's already a top match
        eyed["eyed"] = {"query": eyeing, "rank": eyed_rank + 1, "of": len(results)}
    for r in {id(r): r for r in picked + [pinned, eyed] if r}.values():
        add_peer_rank(r, cat, emb)

    return {
        "results": picked,
        "pinned": pinned,
        "eyed": eyed,
        "eyed_unmatched": eyeing if eyeing and not eyed else None,  # typed a role we don't cover
        "comfort": comfort,
        "demand_available": bool(cat["demand"]),
        "similarity_method": f"embeddings ({emb.model_name})" if emb else "word overlap",
        "notes": [] if cat["demand"] else ["Trend data not loaded yet: scores use familiarity, ease and interest fit only."],
        "sources": cat["sources"],
    }
