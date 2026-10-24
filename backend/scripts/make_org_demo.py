"""
Builds the SYNTHETIC demo university for the organisation dashboard (data/org_demo.json).

"Demo University" is made up, and so is every student in it. Each programme has modules,
and each module is a set of real ESCO skills (checked against bridge.db).

Every student gets an overall ability, how much drive they have, and a knack for each
module (some come easier than others; the programme's hard modules are harder for
everyone). Week 1 mastery follows from those and their year of study; after that, each
week closes part of the gap to the top, so progress is quick early and slows later, like
real learning curves. Mastery here is a made-up score; the live product measures it from
what a student marks done on Bridge, like the matcher.

A student's best fit is the job whose key modules they're strongest in compared with their
classmates (each programme lists the jobs its graduates go into, with the modules that
matter for each), so it always agrees with their module scores, and a student who shines
in a hard module (say networks) can still head for the job it leads to.

Students join with consent to their staff seeing their progress by name (onboarding).

Run from the repo root:   python backend/scripts/make_org_demo.py
"""

import json
import random
import sqlite3
from collections import Counter
from datetime import date
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
OUT = BACKEND / "data" / "org_demo.json"
SEED = 2026
WEEKS = 12  # weeks of the semester so far
SEMESTER_WEEKS = 14
ORG = {"name": "Demo University", "unit": "Faculty of Applied Sciences", "code": "DEMO-UNI-2026"}

# Modules -> real ESCO skill titles. Careers: ESCO job -> {module: weight}.
PROGRAMMES = [
    {
        "id": "bit", "name": "Bachelor of Information Technology", "short": "BIT", "n": 36, "level": 0,
        "hard": ["Computer networks", "Cyber security"],
        "modules": {
            "Programming fundamentals": ["computer programming", "Python (computer programming)", "Java (computer programming)", "task algorithmisation"],
            "Database systems": ["design database scheme", "manage database", "database management systems", "operate relational database management system"],
            "Web development": ["web programming", "implement front-end website design", "create website wireframe", "web application security threats"],
            "Software engineering": ["create software design", "use software design patterns", "Agile development", "plan software testing"],
            "Computer networks": ["design computer network", "ICT network routing", "implement ICT network diagnostic tools"],
            "Data analytics": ["perform data analysis", "data quality assessment", "perform online data analysis"],
            "Cyber security": ["cyber security", "apply information security policies", "manage system security"],
        },
        "careers": {
            "software developer": {"Programming fundamentals": 3, "Software engineering": 2},
            "web developer": {"Web development": 3, "Programming fundamentals": 2, "Database systems": 1},
            "data analyst": {"Data analytics": 3, "Database systems": 2},
            "data scientist": {"Data analytics": 3, "Programming fundamentals": 2, "Database systems": 1},
            "database administrator": {"Database systems": 3, "Data analytics": 1},
            "ICT network engineer": {"Computer networks": 3, "Cyber security": 1},
            "ICT system administrator": {"Computer networks": 2, "Cyber security": 2, "Database systems": 1},
            "ICT test analyst": {"Software engineering": 2, "Programming fundamentals": 1, "Web development": 1},
        },
    },
    {
        "id": "bacc", "name": "Bachelor of Accounting", "short": "BAcc", "n": 32, "level": 3,
        "hard": ["Taxation", "Auditing"],
        "modules": {
            "Financial accounting": ["accounting entries", "prepare financial statements", "prepare trial accounting balances", "international financial reporting standards"],
            "Management accounting": ["perform cost accounting activities", "cost management", "manage budgets", "budgetary principles"],
            "Auditing": ["conduct financial audits", "audit techniques", "prepare financial auditing reports", "internal auditing"],
            "Taxation": ["calculate tax", "prepare tax returns forms", "tax legislation"],
            "Financial analysis": ["interpret financial statements", "financial analysis", "create a financial report"],
            "Business law": ["business law", "contract law", "corporate law"],
            "Accounting systems": ["accounting techniques", "check accounting records", "identify accounting errors"],
        },
        "careers": {
            "accountant": {"Financial accounting": 3, "Management accounting": 2, "Accounting systems": 1},
            "financial auditor": {"Auditing": 3, "Financial accounting": 1, "Business law": 1},
            "tax compliance officer": {"Taxation": 3, "Business law": 1},
            "financial analyst": {"Financial analysis": 3, "Management accounting": 1},
            "bookkeeper": {"Accounting systems": 3, "Financial accounting": 1},
            "payroll clerk": {"Accounting systems": 2, "Business law": 1},
        },
    },
    {
        "id": "dgd", "name": "Diploma in Graphic Design", "short": "DGD", "n": 28, "level": 1,
        "hard": ["Motion graphics", "UI and UX design"],
        "modules": {
            "Design fundamentals": ["design graphics", "draw design sketches", "determine image composition"],
            "Typography": ["typography", "examine advertisement layout", "translate requirement concepts into visual design"],
            "Digital imaging": ["graphics editor software", "perform image editing", "edit photographs", "create digital images"],
            "Branding": ["graphic design", "brand marketing techniques"],
            "Motion graphics": ["motion graphics", "develop animations", "principles of animation", "perform video editing"],
            "UI and UX design": ["design user interface", "create website wireframe", "research website users"],
            "Photography": ["photography", "use photographic equipment", "colour grading"],
        },
        "careers": {
            "graphic designer": {"Design fundamentals": 2, "Typography": 2, "Branding": 2},
            "user interface designer": {"UI and UX design": 3, "Typography": 1},
            "animator": {"Motion graphics": 3, "Design fundamentals": 1},
            "video and motion picture editor": {"Motion graphics": 2, "Digital imaging": 1, "Photography": 1},
            "photographer": {"Photography": 3, "Digital imaging": 1},
            "drawing artist": {"Design fundamentals": 3, "Digital imaging": 1},
            "art director": {"Branding": 2, "Typography": 1, "Design fundamentals": 1},
        },
    },
    {
        "id": "bme", "name": "Bachelor of Mechanical Engineering", "short": "BME", "n": 30, "level": -1,
        "hard": ["Thermodynamics", "Control systems"],
        "modules": {
            "Engineering drawing": ["technical drawings", "use technical drawing software", "use CAD software"],
            "Thermodynamics": ["thermodynamics", "engineering principles"],
            "Mechanics of materials": ["material mechanics", "mechanics", "principles of mechanical engineering"],
            "Manufacturing processes": ["manufacturing processes", "plan manufacturing processes", "types of metal manufacturing processes"],
            "Control systems": ["control systems", "design control systems", "maintain control systems for automated equipment"],
            "Maintenance engineering": ["perform machine maintenance", "manage maintenance operations", "maintenance and repair"],
            "Health and safety": ["apply health and safety standards", "health and safety regulations", "safety engineering"],
        },
        "careers": {
            "mechatronics engineer": {"Control systems": 3, "Mechanics of materials": 1},
            "automation engineer": {"Control systems": 2, "Manufacturing processes": 2},
            "instrumentation engineer": {"Control systems": 2, "Thermodynamics": 2},
            "industrial machinery mechanic": {"Maintenance engineering": 3, "Health and safety": 1},
            "product quality controller": {"Manufacturing processes": 2, "Health and safety": 2},
            "3D modeller": {"Engineering drawing": 3, "Mechanics of materials": 1},
            "packing machinery engineer": {"Mechanics of materials": 2, "Manufacturing processes": 2},
        },
    },
]

FIRST = ["Aiman", "Nurul", "Wei Jie", "Priya", "Hakim", "Mei Xin", "Arjun", "Sofia", "Farah", "Jun Hao", "Kavitha", "Danial", "Aisyah",
         "Ethan", "Siew Ling", "Ravi", "Hannah", "Irfan", "Jia Yi", "Thivya", "Amir", "Chloe", "Zara", "Kumar", "Liyana", "Marcus",
         "Nadia", "Kai Wen", "Deepa", "Haziq", "Yasmin", "Ryan", "Shu Ting", "Vikram", "Alya", "Daniel", "Hui Min", "Sanjay", "Iman",
         "Jason", "Puteri", "Ken", "Anis", "Shalini", "Faiz", "Rachel", "Syafiq", "Grace", "Naveen", "Balqis"]
LAST = ["Rahman", "Tan", "Lim", "Kumar", "Abdullah", "Wong", "Raj", "Ismail", "Lee", "Nair", "Hassan", "Chong", "Ong", "Pillai",
        "Yusof", "Ng", "Menon", "Aziz", "Teoh", "Subramaniam", "Hamid", "Chan", "Goh", "Krishnan", "Razak", "Low", "Fernandez", "Osman"]

CEILING = 95  # nobody masters everything in one semester


def clamp(x, lo, hi):
    return max(lo, min(hi, x))


def new_name(rng, used):
    while True:
        name = f"{rng.choice(FIRST)} {rng.choice(LAST)}"
        if name not in used:
            used.add(name)
            return name


def semester(rng, prog, year, ability, drive):
    """Mastery per module for each week: a start from year, ability and knack, then a learning curve."""
    names = list(prog["modules"])
    start, rate = [], []
    for m in names:
        hard = m in prog["hard"]
        knack = rng.gauss(0, 0.8)
        s = 34 + prog["level"] + 6 * (year - 1) + 7 * ability + 6 * knack - (9 if hard else 0) + rng.gauss(0, 3)
        start.append(clamp(s, 8, 72))
        rate.append(max(0.004, drive * (1 + 0.25 * knack) * (0.7 if hard else 1.0)))
    weeks = [start[:]]
    now = start[:]
    for _ in range(2, WEEKS + 1):
        for i in range(len(now)):
            if rng.random() < 0.85:  # most weeks they put some time into each module
                now[i] += (CEILING - now[i]) * rate[i] * rng.uniform(0.5, 1.5)
        weeks.append(now[:])
    return [[round(x) for x in w] for w in weeks]


def best_fit(prog, modules_now, cohort_mean):
    """The job whose key modules this student is strongest in, next to classmates; how ready
    they are for it (their weighted mastery of those modules) and which modules say so."""
    score = dict(zip(prog["modules"], modules_now))
    lead = {m: score[m] - cohort_mean[m] for m in score}
    wmean = lambda key, val: sum(val[m] * w for m, w in key.items()) / sum(key.values())  # noqa: E731
    job = max(prog["careers"], key=lambda j: wmean(prog["careers"][j], lead))
    key = prog["careers"][job]
    because = sorted(key, key=lambda m: -key[m] * (lead[m] + 50))[:2]
    return {"role": job, "familiarity": round(wmean(key, score)), "because": because}


def main():
    rng = random.Random(SEED)
    db = sqlite3.connect(BACKEND / "data" / "bridge.db")
    esco_skills = {t for (t,) in db.execute("SELECT title FROM skills")}
    esco_jobs = {t for (t,) in db.execute("SELECT title FROM occupations")}
    db.close()

    names_used = set()
    programmes = []
    for prog in PROGRAMMES:
        missing = [t for sk in prog["modules"].values() for t in sk if t not in esco_skills] + [j for j in prog["careers"] if j not in esco_jobs]
        if missing:
            raise SystemExit(f"{prog['id']}: not in the ESCO catalogue: {missing}")
        n_topics = sum(len(sk) for sk in prog["modules"].values())

        students = []
        for s_i in range(prog["n"]):
            year = rng.choices([1, 2, 3], weights=[4, 3, 3])[0]
            ability = clamp(rng.gauss(0, 1), -2.2, 2.2)
            drive = clamp(0.03 + 0.008 * ability + rng.gauss(0, 0.012), 0.004, 0.07)  # share of the gap closed a week
            weeks = semester(rng, prog, year, ability, drive)
            weekly = [round(sum(w) / len(w)) for w in weeks]
            now, overall, recent = weeks[-1], weekly[-1], weekly[-1] - weekly[-5]
            status = "support" if overall < 36 or (overall < 44 and recent < 3) else "ahead" if overall >= 65 else "on-track"
            students.append({
                "id": f"{prog['id']}-{s_i + 1:03d}",
                "name": new_name(rng, names_used),
                "year": year,
                "hours": round(clamp(1.5 + drive * 140 + rng.uniform(-1, 1), 1, 14), 1),
                "active_days_ago": 0 if drive >= 0.035 and rng.random() < 0.6 else rng.randint(1, 5 if drive >= 0.02 else 21),
                "topics_done": round(n_topics * clamp((overall - 12) / 85, 0, 1)),  # a few done even when struggling
                "topics_total": n_topics,
                "modules": now,
                "modules_week1": weeks[0],
                "weekly": weekly,
                "status": status,
            })
        cohort_mean = {m: sum(s["modules"][i] for s in students) / len(students) for i, m in enumerate(prog["modules"])}
        for s in students:
            s["heading"] = best_fit(prog, s["modules"], cohort_mean)
        programmes.append({
            "id": prog["id"], "name": prog["name"], "short": prog["short"], "intake": "2026",
            "modules": [{"name": m, "skills": sk} for m, sk in prog["modules"].items()], "students": students,
        })
        heads = Counter(s["heading"]["role"] for s in students)
        print(f"{prog['short']:5} mean now {round(sum(s['weekly'][-1] for s in students) / len(students))}"
              f" | week 1 {round(sum(s['weekly'][0] for s in students) / len(students))}"
              f" | support {sum(s['status'] == 'support' for s in students)} | ahead {sum(s['status'] == 'ahead' for s in students)}"
              f" | {dict(heads.most_common())}")

    out = {
        "org": {**ORG, "synthetic": True, "generated": date.today().isoformat(), "students": sum(len(p["students"]) for p in programmes),
                "week": WEEKS, "semester_weeks": SEMESTER_WEEKS},
        "programmes": programmes,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("wrote", OUT, f"{OUT.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
