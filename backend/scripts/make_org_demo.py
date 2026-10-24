"""
Builds the SYNTHETIC demo university for the organisation dashboard (data/org_demo.json).

"Demo University" is made up, and so is every student in it. Each programme has modules,
and each module is a set of real ESCO skills. Every student gets a made-up starting
profile (skills, coursework, a project or internship) and twelve weeks of learning on
Bridge: each week they start or finish some module topics, at their own pace. A module's
mastery is how much of its skills the student covers, measured with the same embeddings
and coverage threshold as the matcher; their likely next role comes from the real matcher.

Students join with consent to their staff seeing their progress by name (onboarding).

Run from the repo root:   python backend/scripts/make_org_demo.py
"""

import json
import random
import sys
from datetime import date
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.embeddings import get_embeddings  # noqa: E402
from app.matching import COVER_THRESHOLD, LEVEL_WEIGHT, load_catalogue, match  # noqa: E402

OUT = Path(__file__).resolve().parents[1] / "data" / "org_demo.json"
SEED = 2026
WEEKS = 12  # weeks of the semester so far
SEMESTER_WEEKS = 14
ORG = {"name": "Demo University", "unit": "Faculty of Applied Sciences", "code": "DEMO-UNI-2026"}

# Module -> real ESCO skill titles (looked up in bridge.db)
PROGRAMMES = [
    {
        "id": "bit", "hard": ["Computer networks", "Cyber security"], "name": "Bachelor of Information Technology", "short": "BIT", "n": 36,
        "edu": ("Bachelor's degree", "Information technology", "University"), "work": ["Analytical", "Hands-on"],
        "modules": {
            "Programming fundamentals": ["computer programming", "Python (computer programming)", "Java (computer programming)", "task algorithmisation"],
            "Database systems": ["design database scheme", "manage database", "database management systems", "operate relational database management system"],
            "Web development": ["web programming", "implement front-end website design", "create website wireframe", "web application security threats"],
            "Software engineering": ["create software design", "use software design patterns", "Agile development", "plan software testing"],
            "Computer networks": ["design computer network", "ICT network routing", "implement ICT network diagnostic tools"],
            "Data analytics": ["perform data analysis", "data quality assessment", "perform online data analysis"],
            "Cyber security": ["cyber security", "apply information security policies", "manage system security"],
        },
        "pool": ["Python", "Java", "SQL", "HTML and CSS", "JavaScript", "Git", "Linux", "Excel", "Debugging", "Data structures", "Networking basics"],
        "tasks": ["Built a web app for a class project", "Wrote SQL queries for a club database", "Set up a home network", "Fixed bugs in a group Java project"],
    },
    {
        "id": "bacc", "hard": ["Taxation", "Auditing"], "name": "Bachelor of Accounting", "short": "BAcc", "n": 32,
        "edu": ("Bachelor's degree", "Accounting", "University"), "work": ["Organising", "Analytical"],
        "modules": {
            "Financial accounting": ["accounting entries", "prepare financial statements", "prepare trial accounting balances", "international financial reporting standards"],
            "Management accounting": ["perform cost accounting activities", "cost management", "manage budgets", "budgetary principles"],
            "Auditing": ["conduct financial audits", "audit techniques", "prepare financial auditing reports", "internal auditing"],
            "Taxation": ["calculate tax", "prepare tax returns forms", "tax legislation"],
            "Financial analysis": ["interpret financial statements", "financial analysis", "create a financial report"],
            "Business law": ["business law", "contract law", "corporate law"],
            "Accounting systems": ["accounting techniques", "check accounting records", "identify accounting errors"],
        },
        "pool": ["Bookkeeping", "Excel", "Financial reporting", "Budgeting", "Payroll", "Bank reconciliation", "Data entry", "Invoicing", "Accounts payable"],
        "tasks": ["Reconciled the society's bank statements", "Prepared working papers in an audit internship", "Kept the books for a family shop", "Entered invoices for a small firm"],
    },
    {
        "id": "dgd", "hard": ["Motion graphics", "UI and UX design"], "name": "Diploma in Graphic Design", "short": "DGD", "n": 28,
        "edu": ("Diploma", "Graphic design", "College"), "work": ["Creative"],
        "modules": {
            "Design fundamentals": ["design graphics", "draw design sketches", "determine image composition"],
            "Typography": ["typography", "examine advertisement layout", "translate requirement concepts into visual design"],
            "Digital imaging": ["graphics editor software", "perform image editing", "edit photographs", "create digital images"],
            "Branding": ["graphic design", "brand marketing techniques"],
            "Motion graphics": ["motion graphics", "develop animations", "principles of animation", "perform video editing"],
            "UI and UX design": ["design user interface", "create website wireframe", "research website users"],
            "Photography": ["photography", "use photographic equipment", "colour grading"],
        },
        "pool": ["Photoshop", "Illustrator", "Canva", "Sketching", "Poster design", "Instagram content", "Photo retouching", "Video editing", "Figma"],
        "tasks": ["Designed posters for campus events", "Made a logo for a friend's cafe", "Edited short videos for TikTok", "Shot product photos for an online shop"],
    },
    {
        "id": "bme", "hard": ["Thermodynamics", "Control systems"], "name": "Bachelor of Mechanical Engineering", "short": "BME", "n": 30,
        "edu": ("Bachelor's degree", "Mechanical engineering", "University"), "work": ["Hands-on", "Analytical"],
        "modules": {
            "Engineering drawing": ["technical drawings", "use technical drawing software", "use CAD software"],
            "Thermodynamics": ["thermodynamics", "engineering principles"],
            "Mechanics of materials": ["material mechanics", "mechanics", "principles of mechanical engineering"],
            "Manufacturing processes": ["manufacturing processes", "plan manufacturing processes", "types of metal manufacturing processes"],
            "Control systems": ["control systems", "design control systems", "maintain control systems for automated equipment"],
            "Maintenance engineering": ["perform machine maintenance", "manage maintenance operations", "maintenance and repair"],
            "Health and safety": ["apply health and safety standards", "health and safety regulations", "safety engineering"],
        },
        "pool": ["AutoCAD", "SolidWorks", "MATLAB", "Technical drawing", "3D printing", "Workshop safety", "Machining", "Electrical wiring"],
        "tasks": ["Drew parts in SolidWorks", "Helped maintain lab machines", "Built a small robot for a competition", "Checked quality on a production line"],
    },
]

FIRST = ["Aiman", "Nurul", "Wei Jie", "Priya", "Hakim", "Mei Xin", "Arjun", "Sofia", "Farah", "Jun Hao", "Kavitha", "Danial", "Aisyah",
         "Ethan", "Siew Ling", "Ravi", "Hannah", "Irfan", "Jia Yi", "Thivya", "Amir", "Chloe", "Zara", "Kumar", "Liyana", "Marcus",
         "Nadia", "Kai Wen", "Deepa", "Haziq", "Yasmin", "Ryan", "Shu Ting", "Vikram", "Alya", "Daniel", "Hui Min", "Sanjay", "Iman",
         "Jason", "Puteri", "Ken", "Anis", "Shalini", "Faiz", "Rachel", "Syafiq", "Grace", "Naveen", "Balqis"]
LAST = ["Rahman", "Tan", "Lim", "Kumar", "Abdullah", "Wong", "Raj", "Ismail", "Lee", "Nair", "Hassan", "Chong", "Ong", "Pillai",
        "Yusof", "Ng", "Menon", "Aziz", "Teoh", "Subramaniam", "Hamid", "Chan", "Goh", "Krishnan", "Razak", "Low", "Fernandez", "Osman"]

TOPIC_WEIGHT = {"learning": LEVEL_WEIGHT[1], "done": LEVEL_WEIGHT[2]}  # same as the matcher's learned topics


class Vectors:
    """Phrase embeddings, cached: the same phrases come up for many students."""

    def __init__(self, emb):
        self.emb = emb
        self.cache = {}

    def __call__(self, texts):
        todo = [t for t in dict.fromkeys(texts) if t not in self.cache]
        if todo:
            self.cache.update(zip(todo, self.emb.encode(todo)))
        return np.stack([self.cache[t] for t in texts])


def mastery(evidence, skill_matrix, vectors, emb):
    """Per skill, 0..1: the best evidence's similarity × its weight, like the matcher's coverage."""
    if not evidence:
        return np.zeros(skill_matrix.shape[0])
    texts = [t for t, _ in evidence]
    w = np.array([wt for _, wt in evidence], dtype=np.float32).reshape(-1, 1)
    sims = emb.rescale(vectors(texts) @ skill_matrix.T)
    return np.minimum(1.0, (np.where(sims >= COVER_THRESHOLD, sims, 0.0) * w).max(axis=0))


def student(rng, prog, names_used):
    while True:
        name = f"{rng.choice(FIRST)} {rng.choice(LAST)}"
        if name not in names_used:
            names_used.add(name)
            break
    year = rng.choices([1, 2, 3], weights=[4, 3, 3])[0]
    skills = rng.sample(prog["pool"], k=rng.randint(3, 6))
    base_level = min(3, year - 1 + rng.choice([0, 0, 1]))
    profile_skills = [{"name": s, "level": max(0, min(3, base_level + rng.choice([-1, 0, 0, 1]))), "lastUsed": "This year"} for s in skills]
    evidence = [(s["name"], LEVEL_WEIGHT[s["level"]]) for s in profile_skills]
    roles = []
    if rng.random() < 0.25 + 0.15 * year:
        roles = [{"title": "Intern", "tasks": rng.sample(prog["tasks"], k=2), "tools": []}]
        evidence += [(t, 0.75) for t in roles[0]["tasks"]]
    pace = rng.choice([0.01, 0.03, 0.05, 0.07, 0.08, 0.1, 0.13])  # chance per topic per week to move on
    return {
        "name": name, "year": year, "pace": pace, "evidence": evidence, "roles": roles,
        "skills": profile_skills, "hours": round(2 + pace * 70 + rng.uniform(-1, 1), 1),
    }


def main():
    rng = random.Random(SEED)
    cat = load_catalogue()
    emb = get_embeddings()
    vectors = Vectors(emb)
    titles = {sk["title"]: sk["uri"] for o in cat["occupations"].values() for sk in o["skills"]}
    import sqlite3

    db = sqlite3.connect(Path(__file__).resolve().parents[1] / "data" / "bridge.db")
    titles.update({t: u for u, t in db.execute("SELECT uri, title FROM skills")})
    db.close()

    names_used = set()
    programmes = []
    for prog in PROGRAMMES:
        modules = [{"name": m, "skills": sk} for m, sk in prog["modules"].items()]
        topics = [(mi, t) for mi, m in enumerate(modules) for t in m["skills"]]
        missing = [t for _, t in topics if t not in titles or titles[t] not in emb.skill_vec]
        if missing:
            raise SystemExit(f"{prog['id']}: no ESCO vector for {missing}")
        skill_matrix = np.stack([emb.skill_vec[titles[t]] for _, t in topics])
        module_of = np.array([mi for mi, _ in topics])

        def by_module(per_skill):
            return [round(100 * float(per_skill[module_of == mi].mean())) for mi in range(len(modules))]

        students = []
        for s_i in range(prog["n"]):
            st = student(rng, prog, names_used)
            # Coursework already done counts as topics known at the start (more for later years)
            state = {}
            for _, t in topics:
                r = rng.random()
                if r < 0.04 * st["year"]:
                    state[t] = "done"
                elif r < 0.1 * st["year"]:
                    state[t] = "learning"
            # Some modules come easier to a student than others; the hard ones are slower for everyone
            knack = [rng.uniform(0.4, 1.6) * (0.45 if m["name"] in prog["hard"] else 1.0) for m in modules]
            weekly, modules_week1 = [], None
            for week in range(1, WEEKS + 1):
                if week > 1:
                    for mi, t in topics:
                        if rng.random() < st["pace"] * knack[mi]:
                            state[t] = {None: "learning", "learning": "done"}.get(state.get(t), state.get(t))
                ev = st["evidence"] + [(t, TOPIC_WEIGHT[v]) for t, v in state.items()]
                per_module = by_module(mastery(ev, skill_matrix, vectors, emb))
                if week == 1:
                    modules_week1 = per_module
                weekly.append(round(sum(per_module) / len(per_module)))
            now = per_module
            profile = {
                "skills": st["skills"], "roles": st["roles"],
                "eduLevel": prog["edu"][0], "eduField": prog["edu"][1], "eduType": prog["edu"][2],
                "workTypes": prog["work"], "hoursPerWeek": st["hours"],
                "learned": [{"name": t, "level": 2 if v == "done" else 1} for t, v in state.items()],
            }
            top = match(profile, 0.5, cat)["results"][0]
            recent = weekly[-1] - weekly[-5]
            overall = weekly[-1]
            status = "support" if overall < 35 or (overall < 50 and recent < 3) else "ahead" if overall >= 65 else "on-track"
            students.append({
                "id": f"{prog['id']}-{s_i + 1:03d}",
                "name": st["name"],
                "year": st["year"],
                "hours": st["hours"],
                "active_days_ago": 0 if st["pace"] >= 0.07 and rng.random() < 0.6 else rng.randint(1, 4 if st["pace"] >= 0.05 else 21),
                "topics_done": sum(v == "done" for v in state.values()),
                "topics_total": len(topics),
                "modules": now,
                "modules_week1": modules_week1,
                "weekly": weekly,
                "status": status,
                "heading": {"role": top["title"], "familiarity": top["familiarity"]},
            })
        programmes.append({
            "id": prog["id"], "name": prog["name"], "short": prog["short"], "intake": "2026",
            "modules": modules, "students": students,
        })
        print(prog["short"], len(students), "students | mean now", round(np.mean([s["weekly"][-1] for s in students])),
              "| week 1", round(np.mean([s["weekly"][0] for s in students])),
              "| support", sum(s["status"] == "support" for s in students))

    out = {
        "org": {**ORG, "synthetic": True, "generated": date.today().isoformat(), "students": sum(len(p["students"]) for p in programmes),
                "week": WEEKS, "semester_weeks": SEMESTER_WEEKS},
        "programmes": programmes,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("wrote", OUT, f"{OUT.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
