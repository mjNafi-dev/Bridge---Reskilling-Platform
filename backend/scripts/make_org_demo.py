"""
Builds the SYNTHETIC demo organisation for the Org heatmap (data/org_demo.json).

"Demo University" is made up, and so are its ~240 members: each one is a random profile
drawn from a department's skill pool, run through the real matcher. Only combined,
anonymous numbers are saved (no member-level rows), the same way a real organisation
would see its people: groups under MIN_GROUP are hidden.

Run from the repo root:   python backend/scripts/make_org_demo.py
"""

import json
import random
import sys
from collections import Counter
from datetime import date
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.embeddings import get_embeddings  # noqa: E402
from app.matching import COVER_THRESHOLD, load_catalogue, match, user_evidence  # noqa: E402

OUT = Path(__file__).resolve().parents[1] / "data" / "org_demo.json"
SEED = 2026
MIN_GROUP = 5  # smaller groups are hidden so nobody can be singled out
COLUMNS = 10  # skills shown in the heatmap
MIN_BREADTH = 3  # only skills at least this many roles need (transferable, worth a workshop)

ORG = {"name": "Demo University", "unit": "Faculty view", "code": "DEMO-UNI-2026"}

DEPTS = {
    "Computer Science": dict(n=64, edu=("Bachelor's degree", "Computer science", "University"), work=["Analytical", "Hands-on"], pool=[
        "Python", "Java", "SQL", "Web development", "Data structures", "Algorithms", "Git", "Database design", "JavaScript",
        "Software testing", "Linux", "Cloud computing", "Machine learning", "Mobile app development", "Computer networking"],
        tasks=["Built a web app for a class project", "Fixed bugs in a Java codebase", "Wrote SQL reports", "Set up a Linux server"]),
    "Business & Marketing": dict(n=58, edu=("Bachelor's degree", "Business administration", "University"), work=["Leading & persuading", "Organising"], pool=[
        "Marketing", "Social media marketing", "Sales", "Excel", "Market research", "Customer service", "Presentations",
        "Project management", "Budgeting", "Business writing", "Negotiation", "Event planning", "Branding", "Google Analytics", "Content writing"],
        tasks=["Ran social media for a student club", "Organised a charity event", "Helped with market research surveys", "Sold products at a pop-up stall"]),
    "Design & Media": dict(n=44, edu=("Diploma", "Graphic design", "College"), work=["Creative"], pool=[
        "Photoshop", "Illustrator", "Typography", "Photo retouching", "Video editing", "Layout design", "Branding", "Animation",
        "Photography", "Figma", "UI design", "Colour correction", "Storyboarding", "3D modelling", "Copywriting"],
        tasks=["Designed posters for campus events", "Edited short videos for Instagram", "Shot product photos", "Made a brand kit for a cafe"]),
    "Accounting & Finance": dict(n=40, edu=("Bachelor's degree", "Accounting", "University"), work=["Organising", "Analytical"], pool=[
        "Bookkeeping", "Financial reporting", "Excel", "Auditing", "Taxation", "Budgeting", "Accounts payable", "Payroll",
        "Financial analysis", "Cost accounting", "Data entry", "Compliance", "Risk assessment", "Forecasting", "Bank reconciliation"],
        tasks=["Reconciled bank statements", "Prepared working papers for an audit", "Entered invoices", "Helped with year-end accounts"]),
    "Engineering": dict(n=38, edu=("Bachelor's degree", "Mechanical engineering", "University"), work=["Hands-on", "Analytical"], pool=[
        "AutoCAD", "SolidWorks", "Technical drawing", "Machine maintenance", "Quality control", "MATLAB", "Electrical wiring",
        "Project management", "Health and safety", "Manufacturing processes", "Thermodynamics", "PLC programming",
        "Troubleshooting", "Lean manufacturing", "3D printing"],
        tasks=["Drew parts in SolidWorks", "Checked product quality on a line", "Maintained lab equipment", "Wired a control panel"]),
}
CAUSES = ["People's health", "The environment", "Education", "Fair opportunities", "Better cities", "Local businesses & jobs"]
RECENCY = ["This year", "This year", "1–3 years ago", "3+ years ago"]


def member(rng, dept, cfg):
    pool = cfg["pool"]
    k = rng.randint(4, 9)
    # earlier skills in a pool are the core ones, so they're picked more often
    picked = rng.sample(pool, k=min(len(pool), k)) if rng.random() < 0.3 else sorted(
        set(rng.choices(pool, weights=[len(pool) - i for i in range(len(pool))], k=k)), key=pool.index)
    profile = {
        "eduLevel": cfg["edu"][0], "eduField": cfg["edu"][1], "eduType": cfg["edu"][2],
        "skills": [{"name": s, "level": rng.choice([0, 1, 1, 2, 2, 3]), "lastUsed": rng.choice(RECENCY)} for s in picked],
        "workTypes": rng.sample(cfg["work"], k=min(len(cfg["work"]), rng.randint(1, 2))),
        "hoursPerWeek": rng.randint(3, 12),
        "causes": rng.sample(CAUSES, k=rng.randint(0, 2)),
        "department": dept,
    }
    if rng.random() < 0.4:  # some had an internship
        profile["roles"] = [{"title": "Intern", "tasks": rng.sample(cfg["tasks"], k=2), "tools": []}]
    return profile, rng.choice([0, 0.25, 0.5, 0.5, 0.75, 1])


def coverage(profile, skill_uris, emb):
    """For each skill: how much of it this person already has, 0..1 (same measure as familiarity)."""
    ev = user_evidence(profile)
    vecs = emb.encode([t for t, _, _ in ev])
    w = np.array([wt for _, wt, _ in ev], dtype=np.float32).reshape(-1, 1)
    sims = emb.rescale(vecs @ emb.skill_matrix(skill_uris).T)
    strength = np.where(sims >= COVER_THRESHOLD, sims, 0.0) * w
    return np.minimum(1.0, strength.max(axis=0))


def main():
    rng = random.Random(SEED)
    cat = load_catalogue()
    emb = get_embeddings()
    occ = cat["occupations"]
    people = []
    for dept, cfg in DEPTS.items():
        for _ in range(cfg["n"]):
            profile, comfort = member(rng, dept, cfg)
            res = match(profile, comfort, cat)["results"]
            people.append({"dept": dept, "profile": profile, "top": res[0], "top3": [r["uri"] for r in res[:3]]})
        print(dept, "done")

    # Columns: each department's most-needed essential skills (for its members' top-3 roles),
    # taken in turn so every department is represented; near-duplicates are skipped
    breadth = {sk["uri"]: sk["breadth"] for o in occ.values() for sk in o["skills"]}
    per_dept = {}
    for dept in DEPTS:
        need = Counter()
        for p in people:
            if p["dept"] == dept:
                for uri in p["top3"]:
                    need.update(sk["uri"] for sk in occ[uri]["skills"] if sk["relation"] == "essential")
        per_dept[dept] = [u for u, _ in need.most_common(60) if u in emb.skill_vec and breadth.get(u, 0) >= MIN_BREADTH]
    cols = []
    while len(cols) < COLUMNS and any(per_dept.values()):
        for dept in DEPTS:
            while per_dept[dept]:
                u = per_dept[dept].pop(0)
                if u not in cols and all(float(emb.skill_vec[u] @ emb.skill_vec[c]) < 0.9 for c in cols):
                    cols.append(u)
                    break
            if len(cols) == COLUMNS:
                break
    titles = {sk["uri"]: sk["title"] for o in occ.values() for sk in o["skills"]}

    have = {p_i: coverage(p["profile"], cols, emb) for p_i, p in enumerate(people)}
    needs = {p_i: [any(c in {sk["uri"] for sk in occ[u]["skills"] if sk["relation"] == "essential"} for u in p["top3"]) for c in cols]
             for p_i, p in enumerate(people)}

    depts = []
    for dept in DEPTS:
        idx = [i for i, p in enumerate(people) if p["dept"] == dept]
        n = len(idx)
        hidden = n < MIN_GROUP
        fams = [people[i]["top"]["familiarity"] for i in idx]
        heading = Counter(people[i]["top"]["title"] for i in idx).most_common(3)
        depts.append({
            "name": dept,
            "members": n,
            "have": None if hidden else [round(100 * sum(have[i][j] for i in idx) / n) for j in range(len(cols))],
            "need": None if hidden else [round(100 * sum(needs[i][j] for i in idx) / n) for j in range(len(cols))],
            "median_familiarity": None if hidden else int(np.median(fams)),
            "heading": [{"role": r, "count": c} for r, c in heading if c >= MIN_GROUP],
        })

    all_fam = [p["top"]["familiarity"] for p in people]
    buckets = [(0, 19), (20, 39), (40, 59), (60, 79), (80, 100)]
    heading = Counter(p["top"]["title"] for p in people)
    sdgs = Counter(g["goal"] for p in people for g in p["top"]["sdgs"][:1])
    goal_names = {g["goal"]: g["name"] for p in people for g in p["top"]["sdgs"]}
    total_have = [round(100 * sum(have[i][j] for i in range(len(people))) / len(people)) for j in range(len(cols))]
    total_need = [round(100 * sum(needs[i][j] for i in range(len(people))) / len(people)) for j in range(len(cols))]

    out = {
        "org": {**ORG, "synthetic": True, "members": len(people), "generated": date.today().isoformat(), "min_group": MIN_GROUP},
        "columns": [{"uri": u, "skill": titles[u], "have": h, "need": nd} for u, h, nd in zip(cols, total_have, total_need)],
        "departments": depts,
        "heading": [{"role": r, "count": c} for r, c in heading.most_common(8) if c >= MIN_GROUP],
        "readiness": [{"range": f"{a}–{b}%", "count": sum(a <= f <= b for f in all_fam)} for a, b in buckets],
        "median_familiarity": int(np.median(all_fam)),
        "avg_hours": round(float(np.mean([p["profile"]["hoursPerWeek"] for p in people])), 1),
        "sdgs": [{"goal": g, "name": goal_names[g], "count": c} for g, c in sdgs.most_common() if c >= MIN_GROUP],
    }
    OUT.write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    print("wrote", OUT, "|", len(people), "members |", [c["skill"] for c in out["columns"]])


if __name__ == "__main__":
    main()
