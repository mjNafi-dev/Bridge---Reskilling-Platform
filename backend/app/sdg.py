"""
UN Sustainable Development Goal tags for each job, with a one-line reason.

Rule-based and explainable:
  1. the job's ISCO-08 group (ILO classification, from ESCO) gives a base goal, e.g.
     22 health professionals -> SDG 3, 23 teaching professionals -> SDG 4;
  2. words in the job title can add a more specific goal first, e.g. "solar" -> SDG 7.
At most two goals per job. The onboarding question "Which of these would you like your
work to help with?" maps to goals too; jobs that serve one of the user's causes get a
small boost (CAUSE_BOOST points) in matching. Goal names: https://sdgs.un.org/goals
"""

import re

GOALS = {
    2: "Zero hunger",
    3: "Good health and well-being",
    4: "Quality education",
    6: "Clean water and sanitation",
    7: "Affordable and clean energy",
    8: "Decent work and economic growth",
    9: "Industry, innovation and infrastructure",
    10: "Reduced inequalities",
    11: "Sustainable cities and communities",
    12: "Responsible consumption and production",
    13: "Climate action",
    16: "Peace, justice and strong institutions",
}

REASONS = {
    2: "Works on how food is grown and made.",
    3: "Helps keep people healthy and cared for.",
    4: "Helps people learn and build skills.",
    6: "Keeps water clean and flowing.",
    7: "Works on clean, reliable energy.",
    8: "Keeps businesses running and creates jobs.",
    9: "Builds the digital and industrial systems others rely on.",
    10: "Widens access and support for more people.",
    11: "Shapes buildings, transport and the places people live.",
    12: "Shapes how goods are made, moved, used and reused.",
    13: "Works on protecting the environment.",
    16: "Supports fair rules, information and trustworthy institutions.",
}

# Most specific first: 4-digit ISCO codes, then 2-digit sub-major groups
ISCO = {
    "1330": 9, "1343": 3, "2163": 8, "2166": 8, "2651": 8, "2654": 8, "1345": 4, "1342": 3, "2133": 13, "2161": 11, "2164": 11, "2423": 8, "2424": 4,
    "2635": 10, "2634": 3, "2642": 16, "2643": 10, "3111": 13, "3141": 3, "3142": 2, "3153": 11, "3253": 3,
    "3352": 16, "3423": 3, "3434": 8, "3512": 9, "5120": 8, "5312": 4, "5321": 3, "7126": 6, "7411": 11,
    "7412": 7, "8322": 11, "8344": 12, "9333": 12,
    "11": 16, "12": 8, "13": 9, "14": 8, "21": 9, "22": 3, "23": 4, "24": 8, "25": 9, "26": 16, "31": 9,
    "32": 3, "33": 8, "34": 8, "35": 9, "41": 8, "42": 8, "43": 8, "44": 8, "51": 8, "52": 8, "53": 3,
    "54": 16, "61": 2, "62": 2, "63": 2, "71": 11, "72": 9, "73": 8, "74": 7, "75": 12, "81": 9, "82": 9,
    "83": 11, "91": 6, "92": 2, "93": 11, "94": 2, "95": 8, "96": 12,
}

# Words in the job TITLE that point to a more specific goal (checked in this order)
TITLE_RULES = [
    (7, r"solar|wind|energy|renewable"),
    (13, r"environment|sustainab|climate|conservation"),
    (12, r"waste|recycl|supply chain|quality|distribution|buyer"),
    (6, r"water|plumb"),
    (2, r"agricult|farm|food"),
    (3, r"health|nurs|\bcare\b|pharmac|physio|therap|psycholog|trainer"),
    (4, r"teach|lectur|instructional|education|training|career"),
    (10, r"social|community|counsell|translat"),
    (11, r"architect|construction|building|town|urban|property|letting"),
    (16, r"tax|audit|legal|journalist|security"),
    (9, r"\bict\b|data|software|developer|systems?|network|automation|engineer|3d|digital|web"),
]

# Onboarding causes -> goals
CAUSES = {
    "People's health": {3},
    "The environment": {6, 7, 12, 13},
    "Education": {4},
    "Fair opportunities": {10, 16},
    "Better cities": {9, 11},
    "Local businesses & jobs": {8},
}
CAUSE_BOOST = 3  # Bridge score points (out of 100) when a job serves one of the user's causes


def tag(occ):
    """[{goal, name, reason}] for one job, at most two, most specific first."""
    title = (occ.get("title") or "").lower()
    code = str(occ.get("isco_code") or "")
    goals = [g for g, rx in TITLE_RULES if re.search(rx, title)]
    base = ISCO.get(code[:4]) or ISCO.get(code[:2])
    if base:
        goals.append(base)
    out = []
    for g in goals:
        if g not in [x["goal"] for x in out]:
            out.append({"goal": g, "name": GOALS[g], "reason": REASONS[g]})
    return out[:2]


def cause_goals(profile):
    goals = set()
    for cause in profile.get("causes") or []:
        goals |= CAUSES.get(cause, set())
    return goals
